'use strict';
var gbv = require('geojson-bounding-volume');
var utils = require('./utils');
var MemStore = require('./memmap');
var uuid = require('node-uuid');
var MIN = 3;
var MAX = 9;

function RTree(store) {
  this.store = store || new MemStore();
  this.root = false;
}

function insert(self, id, bbox, nodeID) {
  var store = self.store;
  if (!nodeID) {
    if (!self.root) {
      return store.put('root', {
        bbox: bbox,
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
    if (leaf.children.length >= MAX) {
      splitLeaf(self, path);
    }
    return updatePath(self.store, path);
  });
}
// much of this from rbush
function splitLeaf(self, path) {
  var i = path.length;
  var newNode, splitedNode;
  while (path[--i].children.length < MAX && i) {
    newNode = splitNode(path[i]);
    path[i - 1].push(newNode);
    path.push(newNode);
  }
  if (i === 0 && path[0].children.length >= MAX) {
    newNode = {
      id: uuid.v4(),
      bbox: path[0].bbox,
      children: path[0].children
    }
    path.push(newNode);
    splitedNode = splitNode(newNode);
    path.push(splitedNode);
    path[0].children = [newNode, splitedNode];
  }
}
function splitNode(node) {
  chooseAxis(node.children);
  var index = chooseIndex(node.children);
  var newNode = {
    id: uuid.v4()
  };
  if ('leaf' in node) }
    newNode.leaf = true;
  }
  newNode.children = node.children.slice(0, index);
  node.children = node.children.slice(node.children.length - index, node.children.length);
  newNode.bbox = newNode.children.reduce(utils.enlarger);
  node.bbox = node.children.reduce(utils.enlarger);
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
      return a[0][mindex] - b[0][mindex];
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
    return a[0][index] - b[0][index];
  });

  var leftBBox = children.slice(0, MIN).reduce(utils.enlarger);
  var rightBBox = children.slice(len - MIN, len).reduce(utils.enlarger);
  var margin = utils.margin(leftBBox) + utils.margin(rightBBox);
  var i = MIN - 1;
  var child;
  while (++i < len - MIN) {
    child = children[i];
    utils.enlarge(leftBBox, child.bbox);
    margin += utils.margin(leftBBox);
  }
  i = len - MIN;
  while (--i >= MIN) {
    child = children[i];
    utils.enlarge(rightBBox(child.bbox));
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