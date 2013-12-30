var level = require('level-hyper');
var gbv = require('geojson-bounding-volume');
var Promise = require('lie');
var Rbush = require('./rbush');
var all = require('lie-all');
var crypto = require('crypto');
function hash(data){
  return crypto.createHash('sha224').update(data).digest('base64');
}
function makeID(json){
  return hash(JSON.stringify((json)));
}
function format(coords){
  // transform from gbv which gives [[min1, min2, ...],[max1, max2, ...]]
  //to rbush which wants [min1, min2, max1, max2]
  return [coords[0][0],coords[0][1],coords[1][0],coords[1][1]];
}
function makeBbox(thing){
  if(thing.geometry){
    return format(gbv(thing.geometry));
  }
}

function Tree(name, options){
  options = options || {};
  var self = this;
  this.range = options.range || [-180,-90,180,90];
  this.maxDepth = options.depth || 10;
  self.fullname = '__tree__'+name;
  self.then = new Promise(function(yes,no){
    self.db = level(self.fullname, {valueEncoding:'json'},function(err){
      if(err){
        no(err);
      }else{
        yes(self.db);
      }
    });
  }).then;
}
Tree.prototype.mid = function(box){
  var dif = [(box[2]-box[0])/3,(box[3]-box[1])/3];
  return [[box[0]+dif[0],box[1]+dif[1]],[box[2]-dif[0],box[3]-dif[1]]];
}
Tree.prototype.tiles = [
  ['a','b','c'],
  ['d','e','f'],
  ['g','h','i']
];
Tree.prototype.fTiles = [
  ['a','d','g'],
  ['b','e','h'],
  ['c','f','i']
];
Tree.prototype.rTiles = {
  a : [0,0],
  b : [0,1],
  c : [0,2],
  d : [1,0],
  e : [1,1],
  f : [1,2],
  g : [2,0],
  h : [2,1],
  i : [2,2],
}
Tree.prototype.whichQuad = function(coord,mid){
  var x,y;
  if(coord[0]<mid[0][0]){
    x = 0;
  }else if(coord[0]>mid[1][0]){
    x = 2;
  }else{
    x = 1;
  }
  if(coord[1]<mid[0][1]){
    y = 2;
  }else if(coord[1]>mid[1][1]){
    y = 0;
  }else{
    y = 1;
  }
  return this.tiles[y][x];
}
Tree.prototype.newBox = function(quad,oldBox,mid){
  var out = [0,0,0,0];
  if(~['a','b','c'].indexOf(quad)){
    out[1]=mid[1][1];
    out[3]=oldBox[3];
  }else if(~['d','e','f'].indexOf(quad)){
    out[1]=mid[0][1];
    out[3]=mid[1][1];
  }else{
    out[1]=oldBox[1];
    out[3]=mid[0][1];
  }
  if(~['a','d','g'].indexOf(quad)){
    out[0]=oldBox[0];
    out[2]=mid[0][0]
  }else if(~['b','e','h'].indexOf(quad)){
    out[0] = mid[0][0];
    out[2] = mid[1][0];
  }else{
    out[0] = mid[1][0];
    out[2] = oldBox[2];
  }
  return out;
}
Tree.prototype.toQuad = function(coords){
  var depth = 0;
  var out = "";
  var box = this.range;
  var current,mid;
  while(++depth<this.maxDepth){
    mid = this.mid(box);
    current = this.whichQuad(coords,mid);
    box = this.newBox(current,box,mid);
    out+=current;
  }
  return out;
}
Tree.prototype.fromQuad = function(quad){
  var depth = quad.length;
  var out = this.range;
  var i = -1;
  var current,letter,mid;
  while(++i<depth){
    letter = quad[i];
    mid = this.mid(out);
    out = this.newBox(letter,out,mid);
  }
  return out;
}
Tree.prototype.up = function(quad){
  return quad.slice(0,-1);
}
Tree.prototype.contains = function(a, b) {
  return a[0] <= b[0] &&
         a[1] <= b[1] &&
         b[2] <= a[2] &&
         b[3] <= a[3];
}
Tree.prototype.intersects = function (a, b) {
  return b[0] <= a[2] &&
         b[1] <= a[3] &&
         b[2] >= a[0] &&
         b[3] >= a[1];
}
Tree.prototype.whichChildren = function(quad, bbox){
  var searchDepth = this.maxDepth;
  var children = [quad+'a',quad+'b',quad+'c',quad+'d',quad+'e',quad+'f',quad+'g',quad+'h',quad+'i'];
  var full = [];
  var partial = [];
  var change = [];
  children.forEach(function(child){
    var childBox = this.fromQuad(child);
    if(this.contains(bbox,childBox)){
      full.push(child);
    }else if(this.intersects(bbox,childBox)){
      if(child.length===searchDepth){
        full.push(child);
      }else{
        partial.push(child);
      }
    }
  },this);
  if((quad.length+1 === searchDepth && partial.length === 9)||(full.length+partial.length > 6)){
    return [[quad],[]];
  }
  if(full.length+partial.length >5){
    return [full.concat(partial),[]]
  }
  return [full,partial];
}
Tree.prototype.extent = function(bbox){
  bbox = this.fromQuad(this.toQuad([bbox[0],bbox[1]])).slice(0,2)
    .concat(this.fromQuad(this.toQuad([bbox[2],bbox[3]])).slice(-2));
    var todo = [''];
    var done = [];
    var current, output;
    while(todo.length){
      current = todo.pop();
      output = this.whichChildren(current,bbox);
      if(output[0].length){
        done = done.concat(output[0]);
      }
      if(output[1].length){
        todo = todo.concat(output[1]);
      }
    }
    return done;
}
Tree.prototype.neighbour = function(quad,direction){
  var bbox = this.fromQuad(quad);
  var dif;
  switch(direction){
    case 'north':
      dif = bbox[3]-bbox[1];
      return this.toQuad([bbox[0],bbox[1]+dif,bbox[2],bbox[3]+dif]);
    case 'south':
      dif = bbox[1]-bbox[3];
      return this.toQuad([bbox[0],bbox[1]+dif,bbox[2],bbox[3]+dif]);
    case 'east':
      dif = bbox[2]-bbox[0];
      return this.toQuad([bbox[0]+dif,bbox[1],bbox[2]+dif,bbox[3]]);
    case 'west':
      dif = bbox[0]-bbox[2];
      return this.toQuad([bbox[0]+dif,bbox[1],bbox[2]+dif,bbox[3]]);
  }
}
Tree.prototype.insert = function(item){
  var self = this;
  if(!item.bbox){
    item.bbox = makeBbox(item);
  }
  if(!item.id){
    item.id = makeID(item);
  }
  var bbox = item.bbox.slice();
  var id = item.id;
  bbox.id = id;
  return this.insertBbox(id,bbox).then(function(extent){
    item.bboxen = extent;
    return self.putItem(id,item).then(function(resp){
      return id;
    });
  });
};
Tree.prototype.insertBbox =function(id,bbox){
  var extent = this.extent(bbox);
  var self = this;
  if(!Array.isArray(id)){
    id = [id];
  }
  return all(extent.map(function(v){
    return this.has(v).then(function(answer){
      if(answer){
        return self.get(v);
      }else{
        return {features:[],id:v}
      }
    });
  },this)).then(function(answers){
    return self.batch(answers.map(function(v){
      v.features = v.features.concat(id);
      return {type:'put',key:v.id,value:v}
    })).then(function(){
      return extent;
    });
  });
}
Tree.prototype.load = function(array){
  if(!Array.isArray(array)&&array.features){
    array = array.features;
  }
  var self = this;
  var batch = [];
  var bboxen = {};
  var i = -1;
  var len = array.length;
  var extent;
  while(++i<len){
    if(!array[i].bbox){
      array[i].bbox = makeBbox(array[i]);
    }
    if(!array[i].id){
      array[i].id = makeID(array[i]);
    }
    array[i].bbox.id = array[i].id;
    batch[i] = {key:'z-'+array[i].id,value:array[i],type:'put'};
    extent = this.extent(array[i].bbox);
    batch[i].bboxen = extent;
    extent.forEach(function(value){
      if(!bboxen[value]){
        bboxen[value]=[];
      }
      bboxen[value].push(array[i].id);
    })
  };
  var things = [];
  Object.keys(bboxen).forEach(function(quad){
    var ids = bboxen[quad];
    things.push(this.has(v).then(function(answer){
      if(answer){
        return self.get(v);
      }else{
        return {features:[],id:quad}
      }
    }).then(function(v){
      v.features = v.features.concat(id);
      return {type:'put',key:v.id,value:v}
    }))
  },this);
  return all(things).then(function(moreKeys){
    batch = batch.concat(moreKeys);
    return self.batch(batch);
  });
  });
}
Tree.prototype.batch = function(batch){
  var self = this;
  return new Promise(function(yes,no){
     self.db.batch(batch,function(err){
      if(err){
        no(err);
      }else{
        yes();
      }
    });
  });
}
Tree.prototype.search = function(bbox){
  var self = this;
  return this.searchTree(bbox).then(function(results){
    return all(results.map(function(item){
      return this.fetch(item);
    },self)).then(function(results){
      return results.filter(function(item){
        return self.contains(bbox,item.bbox)||self.intersects(bbox, item.bbox);
      });
    });
  });
}
Tree.prototype.searchTree = function(bbox){
  var extents = this.extent(bbox);
  var self = this;
  return all(extents.map(function(v){
    return self.findChildren(v);
  })).then(function(children){
    var map = {};
    children.forEach(function(child){
      child.forEach(function(item){
        map[item] = true;
      });
    });
    return Object.keys(map);
  });
}
Tree.prototype.findChildren = function(key){
  var self = this;
  return new Promise(function(yes,no){
    var stream = self.db.createReadStream({'start':key}).on('error',no);
    var out = [];
    stream.on('data',function(data){
      if(data.key.length<=key.length||data.key.slice(0,key.length)!== key){
        stream.destroy();
        yes(out);
      }else if(data.value&&data.value.features){
        data.value.features.forEach(function(v){
          out.push(v);
        });
      }
    });
  });
}
Tree.prototype.remove = function(id){
  var self = this;
  return self.fetch(id).then(function(resp){
    var bbox = resp.bbox;
    bbox.id = resp.id;
    return bbox;
  }).then(function(bbox){
    return self.delItem(id).then(function(){
      return bbox
    });
  }).then(function(item){
    var resp =  Rbush.prototype.remove.call(self,item);
    self.sync();
    return resp;
  });
};
Tree.prototype.putItem = function(key,value){
  return this.put('z-'+key, value);
}
Tree.prototype.put = function(key, value){
  var self = this;
  return new Promise(function(yes,no){
    self.db.put(key,value,function(err,resp){
      if(err){
        no(err);
      }else{
        yes(key);
      }
    });
  });
};
Tree.prototype.fetch = function(key){
  return this.get('z-'+key);
};
Tree.prototype.get = function(id){
  var self = this;
  return new Promise(function(yes,no){
    self.db.get(id,function(err,resp){
      if(err){
        return no(err);
      }
      yes(resp);
    })
  });
};
Tree.prototype.has = function(id){
  return this.get(id).then(function(){return true;},function(err){
    if(err.notFound){
      return false;
    }else{
      throw err;
    }
  })
}
Tree.prototype.hasItem = function(id){
  return this.has('z-'+id);
}
Tree.prototype.delItem = function(key){
  return this.del('z-'+key);
};
Tree.prototype.del = function(id){
  var self = this;
  return new Promise(function(yes,no){
      self.db.del(id,function(err,resp){
        if(err){
          return no(err);
        }
        yes(resp);
      });
    });
};
Tree.prototype.close = function(){
  var self = this;
  return new Promise(function(yes, no){
    if(self.db.isClosed()){
      return yes(true);
    }else if(self.db._status === 'opening'){
      self.then(function(){
        self.db.close(function(err){
          if(err){
            no(err);
          }else{
            yes(true);
          }
        });
      });
    }else{
      self.db.close(function(err){
        if(err){
          no(err);
        }else{
          yes(true);
        }
      });
    }
  });
};
Tree.prototype.destroy = function(){
  var self = this;
  return self.close().then(function(){
    return new Promise(function(yes,no){
      level.destroy(self.fullname,function(err){
        if(err){
          no(err);
        }else{
          yes(true);
        }
      });
    });
  });
}
module.exports = Tree;