level-tree
===

An experiment in spatial indexing with [(hyper)leveldb](https://github.com/rvagg/node-leveldown/tree/hyper-leveldb) via geohashing type scheme. It implements a nontree with a ternary Hilbert curve.  In other words instead of using a 2x2 grid each level we use a 3x3 one, and the hibertish curve is created by ordering the tiles with the top row abc, the middle row fed and the bottom row ghi, positions in the middle row are flipped on the vertical axis and the middle column flipped on the horizontal axis (with the center position flipped both ways which is the equivalent of rotating it 180 degrees).

Points are storied by finding the full key for the point, multipoints have a key inserted for each point, and line and polygon features are broken up into a number of bboxes which cover it.

References 
===

- [Spatial indexing with Quadtrees and Hilbert Curves](http://blog.notdot.net/2009/11/Damn-Cool-Algorithms-Spatial-indexing-with-Quadtrees-and-Hilbert-Curves)

API
===

All operation return promises

import
----

```javascript
var Tree = require('level-tree');
```

create
---

```javascript
var db = new Tree('dbName'[, options]);
```

creates (or opens) the physical database, options include 

- `range` with specifies the overall extent of the data (Defaults to [-180,-90,180,90])
- `maxDepth` which specifies how many levels to go down before calling it precise enough, default is 10
- `maxPieces` which specifies how many pieces (at most) a bounding box should be broken up into when turning into keys for either line and polygon bboxes or for searches.

insert
----

insert a geojson feature, returns a promise for an id, the id is needed if you want to delete the point latter, the id is also added to the geojson so if you search for it latter it will be there, you can also add your own id property and it will be used. Same with bbox which will be added if not there.

```javascript
db.insert(geojsonFeature).then(function(id){
  //do something with id, or don't
});
```

load
---

same as insert but takes an array of features or a feature collection object and the ids aren't returned, you can get them with a search.  The promise resolves when they are all inserted.

```javascript
db.load(geojsonFeatureCollection).then(function(){
  //do something, or don't
});
```

search
---

search based on a bbox, returns a promise for an array of geojson features

```javascript
db.search([x1,y1,x2,y2]).then(function(features){
  //do stuff
});
```

close
---

closes the db, this is important if you are done with it

```javascript
db.close().then(function(){
  //db is closed now
});
```

destroy
---

deletes the db from the file system.

```javascript
db.destroy().then(function(){
  //db is destroyed now
});
```

fetch
---

get a feature by id

```javascript
db.fetch(id).then(function(feature){
  //dance
});
```

remove
---

remove a feature by id

```javascript
db.remove(id).then(function(feature){
  //is gone now.
});