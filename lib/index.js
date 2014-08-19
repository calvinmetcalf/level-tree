var AsyncRtree = require('async-rtree');
var gbv = require('geojson-bounding-volume');
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
   if (ch.type === 'del') {
    keys.get(ch.key, function (err, bbox) {
      rtree.remove(ch.key, bbox, function () {});
    });
    return;
   }
   var bbox = gbv(ch.value.geometry);
   keys.get(ch.key, function (err, obbox) {
    if (!err) {
      if (areEqual(bbox, obbox)) {
        return;
      }
      rtree.remove(ch.key, obbox, function() {});
    }
    rtree.insert(ch.key, bbox, function() {});
    keys.put(ch.key, bbox);
   });
  });
  return db;
};