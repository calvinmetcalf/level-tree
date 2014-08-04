'use strict';
var gbv = require('geojson-bounding-volume');
var Promise = require('bluebird');
var utils = require('./utils');
var MemStore = require('./memmap');
var uuid = require('node-uuid');
var MIN = 3;
var MAX = 9;

module.exports = RTree;
function RTree(store) {
  this.store = store || new MemStore();
  this.root = false;
  this.queue = [];
  this.inProgress = false;
}
RTree.prototype.insert = function (id, bbox) {
  if (bbox.length !== 2) {
    bbox = [[bbox[0], bbox[2]], [bbox[1], bbox[3]]];
  }
  var self = this;
  if (!this.inProgress) {
    this.inProgress = true;
    return insert(this, id, bbox).then(function (resp) {
      if (self.queue.length) {
        self.queue.shift()();
        return resp;
      } else {
        self.inProgress = false;
      }
    });
  } else {
    return new Promise (function (fulfill, reject) {
      self.queue.push(function () {
        fulfill(insert(self, id, bbox).then(function (resp) {
          if (self.queue.length) {
            self.queue.shift()();
            return resp;
          } else {
            self.inProgress = false;
          }
        }));
      });
    });
  }
};
RTree.prototype.query = function (bbox) {
  if (bbox.length === 2) {
    return query(this, bbox);
  } else {
    return query(this, [[bbox[0], bbox[2]], [bbox[1], bbox[3]]]);
  }
};
function query(self, bbox) {
  if (self.root) {
    return self.store.get(self.root).then(function (root) {
      return queryChildren(self, bbox, root).then(function (things) {
        var done = [];
        var todo = things;
        var curTodo = [];
        var i, len;
        while (todo.length) {
          len = todo.length;
          i = -1;
          while (++i < len) {
            if (Array.isArray(todo[i])) {
              curTodo = curTodo.concat(todo[i]);
            } else {
              done.concat(todo[i]);
            }
          }
          todo = curTodo;
          curTodo = [];
        }
        return done;
      });
    });
  } else {
    return Promise.reject(new Error('nothing in here yet'));
  }
}
function queryChildren(self, bbox, node) {
  var out = [];
  node.children.forEach(function (child) {
    if (utils.intersects(bbox, child.bbox)) {
      if (node.leaf) {
        out.push(self.store.get(node.id));
      } else {
        out.push(self.store.get(node.id).then(function (n) {
          return queryChildren(self, bbox, n);
        }));
      }
    }
  });
  return Promise.all(out);
}
function insert(self, id, bbox, nodeID) {
  var store = self.store;
  if (!nodeID) {
    if (!self.root) {
      return store.put('root', {
        bbox: bbox,
        id: 'root',
        leaf: true,
        children: [{
          id: id,
          bbox: bbox
        }]
      }).then(function (resp){
        self.root = 'root';
        return resp;
      });
    } else {
      return insert(self, id, bbox, self.root);
    }
  }
  return choosePath(self, bbox, nodeID).then(function (path) {
    var leaf = path[path.length - 1];
    leaf.children.push({
      id: id,
      bbox: bbox
    });
    leaf.bbox = utils.enlarge(bbox, leaf.bbox);
    if (leaf.children.length < MAX) {
      return updatePath(self.store, path);
    } else {
      return splitLeaf(self, path);
    }
  });
}
// much of this from rbush
function splitLeaf(self, path) {
  var node = path[path.length - 1];
  chooseAxis(node.children);
  var splitIndex = chooseIndex(node.children);
}
function chooseAxis(children) {
  var indices = children[0].bbox[0].length;
  var i = 0;
  var minMargin = allDistMargin(children, 0);
  var mindex = 0;
  var margin;
  while (++i < indices) {
    margin = allDistMargin(children, i);
    if (margin < minMargin) {
      mindex = i;
      minMargin = margin;
    }
  }
  if (mindex !== (i - 1)) {
    children.sort(function (a, b) {
      return a.bbox[0][mindex] - b.bbox[0][mindex];
    });
  }
}
function chooseIndex(children) {
  var len = children.length;

  var i = MIN;
  var leftBBox = children.slice(0, i).reduce(utils.enlarger);
  var rightBBox = children.slice(len - i, len).reduce(utils.enlarger);
  var area, overlap;
  var minOverlap = utils.area(utils.intersection(leftBBox, rightBBox));
  var minArea = utils.area(leftBBox) + utils.area(rightBBox);
  var mindex = i;
  while (++i < len) {
    leftBBox = children.slice(0, i).reduce(utils.enlarger);
    rightBBox = children.slice(len - i, len).reduce(utils.enlarger);
    overlap = utils.area(utils.intersection(leftBBox, rightBBox));
    area = utils.area(leftBBox) + utils.area(rightBBox);
    if (overlap < minOverlap || (overlap === minOverlap && area < minArea)) {
      minOverlap = overlap;
      mindex = i;

      minArea = area < minArea ? area : minArea;
    }
  }
  return mindex;
}
function allDistMargin(children, index) {
  var len = children.length;

  children.sort(function (a, b) {
    return a.bbox[0][index] - b.bbox[0][index];
  });

  var leftBBox = children.slice(0, MIN).reduce(utils.enlarger);
  var rightBBox = children.slice(len - MIN, len).reduce(utils.enlarger);
  var margin = utils.margin(leftBBox) + utils.margin(rightBBox);
  var i = MIN - 1;
  var child;
  while (++i < len - MIN) {
    child = children[i];
    leftBBox = utils.enlarge(leftBBox, child.bbox);
    margin += utils.margin(leftBBox);
  }
  i = len - MIN;
  while (--i >= MIN) {
    child = children[i];
    rightBBox = utils.enlarge(rightBBox, child.bbox);
    margin += utils.margin(rightBBox);
  }

  return margin;
}
function updatePath (store, path) {
  return store.batch(path.map(function (item) {
    return {
      type: 'put',
      key: item.id,
      value: item
    };
  }));
}
function choosePath(self, bbox, rootID, path) {
  path = path || [];
  return self.store.get(rootID).then(function (node) {
    path.push(node);
    if (node.leaf) {
      return path;
    }
    var bestFit = findBestFit(bbox, node.children);
    node.children[bestFit.index].bbox = bestFit.index;
    node.bbox = utils.enlarge(bbox, node.bbox);
    return choosePath(self, bbox, bestFit.id, path);
  });
}

function findBestFit(bbox, children) {
  var i = 0;
  var bestFitNode = children[0];
  var lastEnlargment = utils.enlarge(bbox, children[0].bbox);
  var bestArea = utils.area(lastEnlargment);
  var index = 0;
  var len = children.length;
  var area, enlarged;
  while (++i < len) {
    enlarged = utils.enlarge(bbox, children[i].bbox);
    area = utils.area(enlarged);
    if (area < bestArea) {
      index = i;
      bestFitNode = children[i];
      bestArea = area;
    }
  }
  return {
    id: bestFitNode.id,
    bbox: lastEnlargment,
    index: index
  };
}