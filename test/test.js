var test = require('tape');
var level = require('levelup');
var tree = require('../lib');
var sublevel = require('level-sublevel');
var schools = require('./schools.json');

test('load', function (t) {
  t.plan(4);
  var db = tree(sublevel(level('./test_db',  { db: require('memdown') })));
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