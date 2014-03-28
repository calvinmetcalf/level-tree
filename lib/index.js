'use strict';
var gbv = require('geojson-bounding-volume');
var utils = require('./utils');
var Eset = require('es6-set');
var through = require('through2').obj;
var sublevel = require('level-sublevel');
var mapReduce = require('map-reduce');

function format(geometry) {
  var coords = gbv(geometry);
  // transform from gbv which gives [[min1, min2, ...],[max1, max2, ...]]
  //to rbush which wants [min1, min2, max1, max2]
  return [coords[0][0], coords[0][1], coords[1][0], coords[1][1]];
}

function toArray(v) {
  var out = [];
  var i = -1;
  var len = v.length;
  while (++i < len) {
    out[i] = v[i];
  }
  return out;
}
function makeTree(db, options) {
  options = options || {};
  db = sublevel(db);
  var mapDB = mapReduce(db, 'rtree', function (key, oValue, emit) {
    var value = JSON.parse(oValue);
    if (!value.type || value.type !== 'Feature' || !value.geometry) {
      return;
    }
    tree.makeExtent(value).forEach(function (v) {
      emit(toArray(v), '1');
    });
  });
  var tree = new Tree(mapDB, options);
  db.queryTree = tree.queryTree.bind(tree);
  return db;
}
module.exports = makeTree;

function Tree(db, options) {
  this.db = db;
  this.range = options.range || [-180, -90, 180, 90];
  this.maxDepth = options.depth || 10;
  this.maxPieces = options.maxPieces || 20;
}
Tree.prototype.toQuad = function (coords) {
  var depth = -1;
  var out = '';
  var current, mid, prev;
  var box = this.range;
  while (depth++ < this.maxDepth) {
    mid = utils.getMid(box);
    prev = current;
    current = utils.whichQuad(coords, mid, out);
    box = utils.newBox(current, box, mid, out);
    out += current;
  }
  return out;
};
Tree.prototype.next = function (quad) {
  if (!quad.length) {
    return quad;
  }
  var i = quad.length;
  while (i) {
    i--;
    if (quad.charCodeAt(i) < 105) {
      return quad.slice(0, i) + String.fromCharCode(quad.charCodeAt(i) + 1) + quad.slice(i + 1);
    } else if (quad.charCodeAt(i) === 105) {
      quad = quad.slice(0, i) + 'a' + quad.slice(i + 1);
    } else {
      throw new Error('invalid tile name');
    }
  }
};

Tree.prototype.fromQuad = function (quad) {
  var depth = quad.length;
  var i = -1;
  var current, letter, prev, mid;
  var range = this.range;
  while (++i < depth) {
    prev = letter;
    letter = quad[i];
    mid = utils.getMid(range);
    range = utils.newBox(letter, range, mid, quad.slice(0, i));
  }
  return range;
};
Tree.prototype.whichChildren = function (quad, bbox) {
  var children = [
    quad + 'a',
    quad + 'b',
    quad + 'c',
    quad + 'd',
    quad + 'e',
    quad + 'f',
    quad + 'g',
    quad + 'h',
    quad + 'i'
  ];
  var full = [];
  var partial = [];
  var change = [];
  children.forEach(function (child) {
    var childBox = this.fromQuad(child);
    if (utils.contains(bbox, childBox)) {
      full.push(child);
    } else if (utils.intersects(childBox, bbox)) {
      if (child.length === this.maxDepth) {
        full.push(child);
      } else {
        partial.push(child);
      }
    }
  }, this);
  return {
    full: full,
    partial: partial,
    id: quad
  };
};
function sortFunc(a, b) {
  return a.num - b.num;
}
Tree.prototype.extent = function (bbox) {
  var todo = [''];
  var done = [];
  var current, output, newTodo, tempTodo;
  function mapFunc(v) {
     /*jshint validthis:true */
    return this.whichChildren(v, bbox);
  }
  function forEachFunc(v) {
    if (v.full.length === 1 && !v.partial.length) {
      done.push(v.full[0]);
    } else if (!v.full.length && v.partial.length === 1) {
      todo.push(v.partial[0]);
    } else {
      v.num = v.full.length + v.partial.length;
      tempTodo.push(v);
    }
  }
  while (todo.length) {
    newTodo = todo.map(mapFunc, this);
    todo = [];
    tempTodo = [];
    newTodo.forEach(forEachFunc);
    if (tempTodo.length) {
      tempTodo.sort(sortFunc);
      while (tempTodo.length) {
        current = tempTodo.shift();
        if ((current.num + todo.length + done.length) > this.maxPieces) {
          done.push(current.id);
        } else {
          done = done.concat(current.full);
          todo = todo.concat(current.partial);
        }
      }
    }
  }
  return done;
};
Tree.prototype.makeExtent = function (item) {
  switch (item.geometry.type) {
    case 'Point':
      return [this.toQuad(item.geometry.coordinates)];
    case 'MultiPoint':
      return item.geometry.coordinates.map(this.toQuad, this);
    default:
      return this.extent(format(item.geometry));
  }
};
Tree.prototype.getExtents = function (bbox) {
  return this.extent(bbox).sort().map(function (v) {
    return [v, this.next(v)];
  }, this).reduce(function (a, b) {
    if (!a.length) {
      return [b];
    }
    if (a[a.length - 1][1] === b[0]) {
      a[a.length - 1][1] = b[1];
    } else {
      a.push(b);
    }
    return a;
  }, []);
};
Tree.prototype.queryTree = function (bbox) {
  var self = this;
  var set = new Eset();
  var stream = through(function (chunk, _, next) {
    if (!set.has(chunk.value)) {
      console.log(chunk.key);
      set.add(chunk.value);
      this.push(chunk);
    }
    next();
  });
  var extents = this.extent(bbox);
  var len = extents.length - 1;
  stream.setMaxListeners(0);
  extents.forEach(function (extent, i) {
    var quads = toArray(extent);
    quads.push(true);
    //console.log(quads);
    self.db.createViewStream({tail: false}).pipe(stream, {end: i === len ? true:false});
  });
  return stream;
};