var test = require('tape');
var level = require('levelup');
var tree = require('../lib');
var sublevel = require('level-sublevel');
var schools = require('./schools.json');
var towns = require('./towns.json');
test('load', function (t) {
  t.plan(4);
  var db = tree(sublevel(level('./test_db',  {valueEncoding:'json', db: require('memdown') })));
  db.put('1', schools.features[0], function (err) {
    t.error(err);
    db.del('1', function (err) {
      t.error(err);
      db.batch([{
        key: '1',
        value: schools.features[0]
      },{
        key: '2',
        value: schools.features[1]
      }], function (err) {
        t.error(err);
        db.once('uptodate', function () {
          db.treeQuery([-180, 0, 0, 90], function (err, resp) {
            t.equals(resp.length, 2, 'got both');
          });
        });
      });
    });
  });
});
test('big query', function (t) {
  t.plan(3);
  var db = tree(sublevel(level('./test_db',  {valueEncoding:'json', db: require('memdown') })));
   db.batch(schools.features.map(function (item) {
    return {
      key: item.id,
      value: item
    };
   }), function (err) {
    t.error(err);
    db.once('uptodate', function () {
      db.treeQuery([-100,0,0,80], function (err, resp) {
        t.error(err);
        t.equals(resp.length, 330, 'got then all');
      });
    });
   });
});
test('actual query', function (t) {
  t.plan(3);
  var db = tree(sublevel(level('./test_db',  {valueEncoding:'json', db: require('memdown') })));
   db.batch(schools.features.map(function (item) {
    return {
      key: item.id,
      value: item
    };
   }), function (err) {
    t.error(err);
    db.once('uptodate', function () {
      db.treeQuery([ -73.050957972443328, 41.813217236760636, -71.941805307670336,  42.95940187161159], function (err, resp) {
        t.error(err);
        t.equals(resp.length, 82, 'got right number');
      });
    });
   });
});

test('point query', function (t) {
  t.plan(4);
  var db = tree(sublevel(level('./test_db',  {valueEncoding:'json', db: require('memdown') })));
   db.batch(towns.features.map(function (item) {
    return {
      key: item.properties.TOWN,
      value: item,
      valueEncoding: 'json'
    };
   }), function (err) {
    t.error(err);
    db.once('uptodate', function () {
      db.treeQuery([ -70.98495,42.24867,-70.98495,42.24867], function (err, resp) {
        t.error(err);
        t.equals(resp.length, 2, 'we get 2')
        var nr = resp.map(function (i) {
          return i.properties.TOWN;
        });
        nr.sort();
        t.deepEqual(nr, ['BOSTON', 'QUINCY'], 'boston and quincy');
      });
    });
   });
});