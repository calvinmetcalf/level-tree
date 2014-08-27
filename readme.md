Level Tree [![Build Status](https://travis-ci.org/calvinmetcalf/level-tree.svg)](https://travis-ci.org/calvinmetcalf/level-tree)
====

An RTree index for levelup, usage

```bash
npm install --save level-tree
```

```js
var level = require('level');
var sublevel = require('level-sublevel');
var levelTree = require('level-tree');
var db = levelTree(sublevel(level('./name')));
// load in some geojson
db.treeQuery([xmin, ymin, xmax, ymax]).pipe();
db.treeQuery([xmin, ymin, xmax, ymax], callback);
// nonstrict query
db.treeQuery([xmin, ymin, xmax, ymax], false).pipe();
db.treeQuery([xmin, ymin, xmax, ymax], false, callback);
```

adds a treeQuery method, which either takes a bbox and returns a stream, or a bbox and a callback. 

you can also pass false as the second argument to treeQuery, this turns off checks to make sure that the bbox you query actually intersects the feature that is returned and not just it's bbox. These checks can be very expensive especially for polygons so turning them off when you have mostly rectangular features or when you just don't care will speed things up.