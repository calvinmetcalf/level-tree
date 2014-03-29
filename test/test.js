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
test('all', function (t) {
  t.test('query all docs', function (t) {
    db = tree(levelup(dbName));
    var done = 0;
    t.plan(1);
    db.on('tree', function (v) {
      db.queryTree([
        -180,
        0,
        0,
        80
      ]).pipe(through(function (chunk, _, next) {
        done++;
        next();
      }, function (next) {
        t.equals(done, 386);
        next();
      }));
    });
    var batch = db.batch();
    data.features.forEach(function (v, i) {
      batch.put('s' + i, JSON.stringify(v));
    });
    var i = 0;

    batch.write(function () {
    });
  });
  t.test('clean up', after);
});
test('some', function (t) {
  t.test('query some docs', function (t) {
    var done = 0;
    db = tree(levelup(dbName));
    t.plan(1);
    db.on('tree', function (v) {
      db.queryTree([
        -71.6802978515625,
        42.18579390537848,
        -71.16943359375,
        42.45588764197166
      ]).pipe(through(function (chunk, _, next) {
        done++;
        next();
      }, function (next) {
        t.equals(done, 38, 'correct ammount');
      }));
    });
    var batch = db.batch();
    data.features.forEach(function (v, i) {
      batch.put('s' + i, JSON.stringify(v));
    });
    var i = 0;

    batch.write(function () {
    });
  });
  t.test('clean up', after);
});