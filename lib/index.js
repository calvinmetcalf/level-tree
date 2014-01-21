
var Sublevel = require('level-sublevel')
var gbv = require('geojson-bounding-volume');

function hash(data){
  return crypto.createHash('sha224').update(data).digest('base64');
}

function format(geometry){
  var coords = gbv(geometry);
  // transform from gbv which gives [[min1, min2, ...],[max1, max2, ...]]
  //to rbush which wants [min1, min2, max1, max2]
  return [coords[0][0],coords[0][1],coords[1][0],coords[1][1]];
}
function insertChange(key, bbox, done, sub){
  //magic here
}
function makeTree (odb, options){
  var db = Sublevel(obd);
  var rtree = db.sublevel('rtree');
  db.pre(function (ch, add){
    if(!ch.value.type || ch.value.type !== 'feature' || !ch.value.geometry)
      return;
    }
    var bbox = ch.value.bbox || format(ch.value.geometry);
    var type = ch.type || 'put';
    if(type === 'put'){
      insertChange(ch.key, bbox, add, rtree)
    }
  });
  return odb;
}
module.exports = makeTree;