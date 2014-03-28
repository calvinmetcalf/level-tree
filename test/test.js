'use strict';
var tree = require('../');
var test = require('tape');
var levelup = require('levelup');
var leveldown = require('leveldown');
var data = require('./trails.json');
var dbName = 'testdb';
var db;
var through = require('through2').obj;
function after(t) {
  db.close(function () {
    leveldown.destroy(dbName, function (err) {
      t.error(err, 'deleted db');
      t.end();
    });
  });
}
test('basic', function (t) {
  t.test('do stuff', function (t) {
    db = tree(levelup(dbName));
    var batch = db.batch();
    data.features.forEach(function (v, i) {
      batch.put(String(i), JSON.stringify(v));
    });
    var i = 0;
    batch.write(function () {
      db.queryTree([
        -71.6802978515625,
        42.18579390537848,
        -71.16943359375,
        42.45588764197166
      ]).pipe(through(function (chunk, _, next) {
        t.ok(chunk, i++);
        next();
      }, function (next) {
        t.end();
      }));
    });
  });
  //t.test('clean up', after);
});