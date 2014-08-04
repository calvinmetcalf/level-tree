//from rbush
'use strict';
exports.contains = contains;
function contains(a, b) {
  var i = -1;
  var len = a[0].length;
  while (++i < len) {
    if (a[0][i] <= b[0][i] &&
         a[1][i] <= b[1][i]) {

    } else {
      return false;
    }
  }
  return true;
}
exports.intersects = intersects;
function intersects(a, b) {
  var i = -1;
  var len = b[0].length;
  while (++i < len) {
    if (b[0][i] > a[1][i] || a[0][i] > b[1][i]) {
      return false;
    }
  }
  return true;
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
exports.intersection = intersection;
function intersection(a, b) {
  var len = min(a[0].length, b[0].length);
  var out = [
    new Array(len),
    new Array(len)
  ];
  var i = -1;
  while (++i < len) {
    out[0][i] = max(a[0][i], b[0][i]);
    out[1][i] = min(a[1][i], b[1][i]);
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
exports.margin = margin;
function margin(box) {
  var len = box[0].length;
  var out = 0;
  var i = -1;
  while (++i < len) {
    out += (box[1][i] - box[0][i]);
  }
  return out;
}

exports.enlarger = enlarger;
function enlarger (a, b) {
  if (a.bbox) {
    a = a.bbox;
  }
  return enlarge(a, b.bbox);
}