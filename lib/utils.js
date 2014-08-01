//from rbush
'use strict';
exports.contains = contains;
function contains(a, b) {
  return a[0] <= b[0] &&
         a[1] <= b[1] &&
         b[2] <= a[2] &&
         b[3] <= a[3];
}
exports.intersects = intersects;
function intersects(a, b) {
  return b[0] <= a[2] &&
         b[1] <= a[3] &&
         b[2] >= a[0] &&
         b[3] >= a[1];
}

exports.min = min;
function min(a, b) {
  if (a < b) {
    return a;
  } else {
    return b;
  }
}
exports.max = max;
function max(a, b) {
  if (a > b) {
    return a;
  } else {
    return b;
  }
}
exports.enlarge = enlarge;
function enlarge(a, b) {
  var len = min(a[0].length, b[0].length);
  var out = [
    new Array(len),
    new Array(len)
  ];
  var i = -1;
  while (++i < len) {
    out[0][i] = min(a[0][i], b[0][i]);
    out[1][i] = max(a[1][i], b[1][i]);
  }
  return out;
}
exports.area = area;
function area(box) {
  var len = box[0].length;
  var out = 1;
  var i = -1;
  while (++i < len) {
    out *= (box[1][i] - box[0][i]);
  }
  return out;
}