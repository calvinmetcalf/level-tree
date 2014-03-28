//from rbush
'use strict';
exports.contains = function contains(a, b) {
  return a[0] <= b[0] &&
         a[1] <= b[1] &&
         b[2] <= a[2] &&
         b[3] <= a[3];
};
exports.intersects = function intersects(a, b) {
  return b[0] <= a[2] &&
         b[1] <= a[3] &&
         b[2] >= a[0] &&
         b[3] >= a[1];
};
exports.getMid = function getMid(box) {
  var dif = [
    (box[2] - box[0]) / 3,
    (box[3] - box[1]) / 3
  ];
  return [
    [box[0] + dif[0], box[1] + dif[1]],
    [box[2] - dif[0], box[3] - dif[1]]
  ];
};
exports.newBox = function newBox(quad, oldBox, mid, prev) {
  var out = [0, 0, 0, 0];
  var normilizedQuad = normilize(prev, quad);
  if (~['a', 'b', 'c'].indexOf(normilizedQuad)) {
    out[1] = mid[1][1];
    out[3] = oldBox[3];
  } else if (~['f', 'e', 'd'].indexOf(normilizedQuad)) {
    out[1] = mid[0][1];
    out[3] = mid[1][1];
  } else {
    out[1] = oldBox[1];
    out[3] = mid[0][1];
  }
  if (~['a', 'f', 'g'].indexOf(normilizedQuad)) {
    out[0] = oldBox[0];
    out[2] = mid[0][0];
  } else if (~['b', 'e', 'h'].indexOf(normilizedQuad)) {
    out[0] = mid[0][0];
    out[2] = mid[1][0];
  } else {
    out[0] = mid[1][0];
    out[2] = oldBox[2];
  }
  return out;
};
var tiles = [
  ['a', 'b', 'c'],
  ['f', 'e', 'd'],
  ['g', 'h', 'i']
];
exports.whichQuad = whichQuad;
function whichQuad(coord, mid, prev) {
  var x, y;
  if (coord[0] < mid[0][0]) {
    x = 0;
  } else if (coord[0] > mid[1][0]) {
    x = 2;
  } else {
    x = 1;
  }
  if (coord[1] < mid[0][1]) {
    y = 2;
  } else if (coord[1] > mid[1][1]) {
    y = 0;
  } else {
    y = 1;
  }
  return normilize(prev, tiles[y][x]);
}
function normilize(prev, current) {
  var flipx = 0;
  var flipy = 0;
  var i = 0;
  var len = prev.length;
  while (i < len) {
    if (~['b', 'e', 'h'].indexOf(prev[i])) {
      flipy += 1;
    }
    if (~['f', 'e', 'd'].indexOf(prev[i])) {
      flipx += 1;
    }
    i++;
  }
  return normalization[flipx % 2][flipy % 2][current];
}
var normalization = [
  [
    {
      a: 'a',
      b: 'b',
      c: 'c',
      d: 'd',
      e: 'e',
      f: 'f',
      g: 'g',
      h: 'h',
      i: 'i'
    },
    {
      a: 'g',
      b: 'h',
      c: 'i',
      d: 'd',
      e: 'e',
      f: 'f',
      g: 'a',
      h: 'b',
      i: 'c'
    }
  ],
  [
    {
      c: 'a',
      b: 'b',
      a: 'c',
      f: 'd',
      e: 'e',
      d: 'f',
      i: 'g',
      h: 'h',
      g: 'i'
    },
    {
      c: 'g',
      b: 'h',
      a: 'i',
      f: 'd',
      e: 'e',
      d: 'f',
      i: 'a',
      h: 'b',
      g: 'c'
    }
  ]
];