var level = require('level-hyper');
var gbv = require('geojson-bounding-volume');
var Promise = require('lie');
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
  this.maxPieces = options.maxPieces || 20
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
  ['f','e','d'],
  ['g','h','i']
];
Tree.prototype.whichQuad = function(coord,mid,prev){
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
  return this.normilize(prev,this.tiles[y][x]);
}
Tree.prototype.normalization = {
  true:{
    true:{
      c:'i',
      b:'h',
      a:'g',
      f:'f',
      e:'e',
      d:'d',
      i:'c',
      h:'b',
      g:'a'
    },
    false:{
      c:'a',
      b:'b',
      a:'c',
      f:'d',
      e:'e',
      d:'f',
      i:'g',
      h:'h',
      g:'i'
    }
  },
  false:{
    true:{
      a:'i',
      b:'h',
      c:'g',
      d:'f',
      e:'e',
      f:'d',
      g:'c',
      h:'b',
      i:'a'
    },
    false:{
      a:'a',
      b:'b',
      c:'c',
      d:'d',
      e:'e',
      f:'f',
      g:'g',
      h:'h',
      i:'i'
    }
  }
}
Tree.prototype.normilize = function(prev,current){
  var flip = 0;
  var rotate = 0;
  var i = 0;
  var len = prev.length;
  while(i<len){
    if(~['b','e','h'].indexOf(prev[i])){
      flip+=1;
      rotate+=1;
    }
    if(~['f','e','d'].indexOf(prev[i])){
      flip+=1;
    }
    i++;
  }
  return this.normalization[!!(flip%2)][!!(rotate%2)][current];
}
Tree.prototype.newBox = function(quad,oldBox,mid,prev){
  var out = [0,0,0,0];
  var normilizedQuad = this.normilize(prev,quad);
  if(~['a','b','c'].indexOf(normilizedQuad)){
    out[1]=mid[1][1];
    out[3]=oldBox[3];
  }else if(~['f','e','d'].indexOf(normilizedQuad)){
    out[1]=mid[0][1];
    out[3]=mid[1][1];
  }else{
    out[1]=oldBox[1];
    out[3]=mid[0][1];
  }
  if(~['a','f','g'].indexOf(normilizedQuad)){
    out[0]=oldBox[0];
    out[2]=mid[0][0]
  }else if(~['b','e','h'].indexOf(normilizedQuad)){
    out[0] = mid[0][0];
    out[2] = mid[1][0];
  }else{
    out[0] = mid[1][0];
    out[2] = oldBox[2];
  }
  return out;
}
Tree.prototype.toQuad = function(coords){
  var depth = -1;
  var out = "";
  var box = this.range;
  var current,mid,prev;
  while(depth++<this.maxDepth){
    mid = this.mid(box);
    prev = current;
    current = this.whichQuad(coords,mid,out);
    box = this.newBox(current,box,mid,out);
    out+=current;
  }
  return out;
}
Tree.prototype.fromQuad = function(quad){
  var depth = quad.length;
  var out = this.range;
  var i = -1;
  var current,letter,prev,mid;
  while(++i<depth){
    prev = letter;
    letter = quad[i];
    mid = this.mid(out);
    out = this.newBox(letter,out,mid,quad.slice(0,i));
  }
  return out;
}
Tree.prototype.up = function(quad){
  return quad.slice(0,-1);
}
Tree.prototype.next = function(quad){
  if(!quad.length){
    return quad;
  }
  var i = quad.length-1;
  while(i){
    if(quad.charCodeAt(i)<105){
      quad[i]=String.fromCharCode(quad.charCodeAt(i)+1);
      return quad;
    }else if(quad.charCodeAt(i)===105){
      quad[i]='a';
      i--;
    }
  }
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
  return {full:full,partial:partial,id:quad}
}
Tree.prototype.extent = function(bbox){
  bbox = this.fromQuad(this.toQuad([bbox[0],bbox[1]])).slice(0,2)
    .concat(this.fromQuad(this.toQuad([bbox[2],bbox[3]])).slice(-2));
    var todo = [''];
    var done = [];
    var current, output,newTodo,tempTodo;
    while(todo.length){
      newTodo = todo.map(function(v){
        return this.whichChildren(v,bbox);
      },this);
      todo = [];
      tempTodo = [];
      newTodo.forEach(function(v){
        if(v.full.length ===1 && !v.partial.length){
          done.push(v.full[0]);
        }else if(!v.full.length && v.partial.length ===1){
          todo.push(v.partial[0]);
        }else{
          v.num = v.full.length+v.partial.length;
          tempTodo.push(v);
        }
      });
      if(tempTodo.length){
        tempTodo.sort(function(a,b){
          return a.num-b.num;
        });
        while(tempTodo.length){
          current = tempTodo.shift();
          if((current.num+todo.length+done.length)>this.maxPieces){
            done.push(current.id);
          }else{
            done = done.concat(current.full);
            todo = todo.concat(current.partial);
          }
        }
      }
    }
    return done;
}
Tree.prototype.makeExtent = function(item){
  switch(item.geometry.type){
    case 'Point':
      return [this.toQuad(item.geometry.coordinates)];
    case 'MultiPoint':
      return item.geometry.coordinates.map(this.toQuad,this);
    default:
      return this.extent(item.bbox);
  }
}
Tree.prototype.insert = function(item){
  var self = this;
  if(!item.bbox){
    item.bbox = makeBbox(item);
    item.bboxen = this.makeExtent(item);
  }
  if(!item.id){
    item.id = makeID(item);
  }
  var id = item.id;
  return this.insertBbox(item).then(function(extent){
    return self.putItem(id,item).then(function(resp){
      return id;
    });
  });
};
Tree.prototype.insertBbox =function(item){
  var extent = item.bboxen;
  var id = item.id;
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
    extent = this.makeExtent(array[i]);
    batch[i].value.bboxen = extent;
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
    things.push(this.has(quad).then(function(answer){
      if(answer){
        return self.get(quad);
      }else{
        return {features:[],id:quad}
      }
    }).then(function(v){
      v.features = v.features.concat(ids);
      return {type:'put',key:v.id,value:v}
    }))
  },this);
  return all(things).then(function(moreKeys){
    batch = batch.concat(moreKeys);
    return self.batch(batch);
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
  var extents = this.extent(bbox).sort().map(function(v){
    return [v,this.next(v)];
  },this).reduce(function(a,b){
    if(!a.length){
      return [b];
    }
    if(a[a.length-1][1]===b[0]){
      a[a.length-1][1] = b[1];
    }else{
      a.push(b);
    }
    return a;
  },[]);
  var self = this;
  return all(extents.map(function(v){
    return self.findChildren(v[0],v[1]);
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
Tree.prototype.findChildren = function(start,end){
  var self = this;
  return new Promise(function(yes,no){
    var stream = self.db.createReadStream({'start':start,'end':end}).on('error',no);
    var out = [];
    stream.on('end',function(){
      yes(out);
    }).on('data',function(data){
      if(data.value&&data.value.features&&data.key!==end){
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
    return resp.bboxen;
  }).then(function(bboxen){
    return self.delItem(id).then(function(){
      return bboxen
    });
  }).then(function(bboxen){
    return all(bboxen.map(function(bbox){
      return self.get(bbox).then(function(resp){
        if(resp.features.length===1){
          return {type:'del',key:resp.id}
        }else{
          resp.features = resp.features.filter(function(v){
            return v!==id;
          })
          return {type:'put',key:resp.id,value:resp};
        }
      });
    })).then(function(batch){
      return self.batch(batch);
    })
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