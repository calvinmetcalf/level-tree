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
```

adds a treeQuery method, which either takes a bbox and returns a stream, or a bbox and a callback.

Caveats:
====
- it's all by bbox so sometimes a polygon will not intersect but it's bbox will.