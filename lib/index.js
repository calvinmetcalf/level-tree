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
    if (leaf.children.length < MAX) {
      return updatePath(self.store, path);
    } else {
      return splitLeaf(self, path);
    }
  });
}
function splitLeaf(self, path) {
  
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