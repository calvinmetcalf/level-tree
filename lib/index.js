'use strict';
var gbv = require('geojson-bounding-volume');
var utils = require('./utils');
var Eset = require('es6-set');
var through = require('through2').obj;
var sublevel = require('level-sublevel');
var trigger = require('level-trigger');
var CombinedStream = require('combined-stream');

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
  var keys = db.sublevel('level-tree-keys');
  var rtree = db.sublevel('level-tree-values');
  var inProgress = 0;
  db.on('tree:start', function () {
    inProgress++;
  });
  db.on('tree:indexed', function (v) {
    inProgress--;
    inProgress = Math.max(inProgress, 0);
    if (!inProgress) {
      db.emit('tree');
    }
  });
  trigger(db, 'level-tree', function (ch) {
      if (ch.key === '[]' || Array.isArray(ch.key)) {
        return null;
      }
      db.emit('tree:start', ch.key);
      return ch.key;
    }, function (id, next) {
    if (id === '[]' || Array.isArray(id)) {
      return next();
    }
    db.get(id, function (err1, oValue) {
      var value = JSON.parse(oValue);
      keys.get(id, function (err2, oldKeys) {
        var batch = [], newKeys;
        if (err2 || typeof oldKeys === 'string') {
          oldKeys = [];
        }
        if (err1 || !value.type || value.type !== 'Feature' || !value.geometry) {
          newKeys = [];
        } else {
          newKeys = tree.makeExtent(value);
        }
        oldKeys.forEach(function (v) {
          if (~newKeys.indexOf(v)) {
            batch.push({
              key: v,
              type: 'del',
              prefix: rtree
            });
          }
        });
        newKeys.forEach(function (v) {
          batch.push({
            key: v + 'z' + id,
            value: {
              quad: v,
              id: id
            },
            type: 'put',
            prefix: rtree,
            valueEncoding: 'json'
          });
        });
        batch.push({
          key: id,
          value: newKeys,
          type: 'put',
          prefix: keys,
          valueEncoding: 'json'
        });
        db.batch(batch, function () {
          db.emit('tree:indexed', id);
          next();
        });
      });
    });
  });
  var tree = new Tree(rtree, db, options);
  db.queryTree = tree.queryTree.bind(tree);
  return db;
}
module.exports = makeTree;

function Tree(db, orig, options) {
  this.db = db;
  this.odb = orig;
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
    if (!set.has(chunk.value.id)) {
      set.add(chunk.value.id);
      var self2 = this;
      self.odb.get(chunk.value.id, function (err, resp) {
        if (err) {
          return next();
        }
        self2.push(JSON.parse(resp));
        next();
      });
    } else {
      next();
    }
  });
  var extents = this.getExtents(bbox);
  var len = extents.length - 1;
  var combinedStream = CombinedStream.create();
  extents.forEach(function (extent, i) {
    combinedStream.append(function (next) {
      next(self.db.createReadStream({valueEncoding: 'json', start: extent[0], end: extent[1]}));
    });
  });
  combinedStream.pipe(stream);
  return stream;
};