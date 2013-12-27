level-tree
===

An experiment in combining [rBush](https://github.com/mourner/rbush) spatial indexing with [(hyper)leveldb](https://github.com/rvagg/node-leveldown/tree/hyper-leveldb) persistence. Currently it works by having an in memory rtree and the features are all in the leveldb, the rtree is periodically serialized to the leveldb and if a db is re opened the rtree is loaded from the db. The next step is to store the rtree in the leveldb, this is why I have a slightly modified version of rbush in here, I plan on modifiying it beyond recognition. 

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
var db = new Tree('dbName');
```

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