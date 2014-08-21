var AsyncRtree = require('async-rtree');
var gbv = require('geojson-bounding-volume');
var through = require('through2').obj;
function areEqual(a, b) {
  if (a[0].length !== b[0].length || a[1].length !== b[1].length|| a[0].length !== b[0].length) {
    return false;
  }
  var len = a[0].length;
  var i = -1;
  while (++i) {
    if (a[0][i] !== b[0][i] || a[1][i] !== b[1][i]) {
      return false;
    }
  }
  return true;
}
module.exports = function (db) {
  var inProgress = 0;
  var storage = db.sublevel('level-tree');
  var tree = storage.sublevel('tree', {
    valueEncoding: 'json'
  });
  var keys = storage.sublevel('keys', {
    valueEncoding: 'json'
  });
  var rtree = new AsyncRtree(tree);
  db.pre(function (ch, add) {
   if (ch.prefix.length) {
    return;
   }
   inProgress++;
   if (ch.type === 'del') {
    keys.get(ch.key, function (err, bbox) {
      rtree.remove(ch.key, bbox, function () {
          keys.del(ch.key, function () {
            inProgress--;
            if (!inProgress) {
              db.emit('uptodate');
            }
          });
      });
    });
    return;
   }
   var bbox = gbv(ch.value.geometry);
   keys.get(ch.key, function (err, obbox) {
    if (!err) {
      if (areEqual(bbox, obbox)) {
        inProgress--;
        if (!inProgress) {
          db.emit('uptodate');
        }
        return;
      }
      rtree.remove(ch.key, obbox, function() {
        rtree.insert(ch.key, bbox, function() {
          keys.put(ch.key, bbox, function () {
            inProgress--;
            if (!inProgress) {
              db.emit('uptodate');
            }
          });
        });
      });
    } else {
      rtree.insert(ch.key, bbox, function() {
        keys.put(ch.key, bbox, function () {
            inProgress--;
            if (!inProgress) {
              db.emit('uptodate');
            }
          });
        });
      }
   });
  });
  function treeStream(bbox) {
    return rtree.query(bbox).pipe(through(function (chunk, _, next) {
      db.get(chunk.id, next);
    }));
  }
  function treequery(bbox, cb) {
    var out = [];
    treeStream(bbox)
      .on('error',cb)
      .pipe(through(function (chunk, _, next) {
        out.push(chunk);
        next();
      }, function (next) {
        cb(null, out);
      })).on('error', cb);
  }
  db.treeQuery = function (bbox, cb) {
    if (bbox.length === 4) {
      bbox = [[bbox[0], bbox[1]], [bbox[2], bbox[3]]];
    } else {
      throw new Error('thats all we do');
    }
    if (cb) {
      return treequery(bbox, cb);
    } else {
      return treeStream(bbox);
    }
  };
  return db;
};