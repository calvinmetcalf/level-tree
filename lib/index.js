var level = require('level-hyper');
var gbv = require('geojson-bounding-volume');
var Promise = require('lie');
var all = require('lie-all');
var crypto = require('crypto');
var nonTree = require('./nontree');
var utils = require('./utils');
var treeUtils = require('./treeUtils');
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
  return format(gbv(thing.geometry));
}

function Tree(name, options){
  options = options || {};
  var self = this;
  this.range = options.range || [-180,-90,180,90];
  this.maxDepth = options.depth || 10;
  this.maxPieces = options.maxPieces || 20
  self.fullname = '__tree__'+name;
  var leveldbOpts = {valueEncoding:'json'};
  if(options.createIfMissing===false){
    leveldbOpts.createIfMissing = options.createIfMissing;
  }
  if(options.errorIfExists===true){
    leveldbOpts.errorIfExists = options.errorIfExists;
  }
  var p = new Promise(function(yes,no){
    if(!name){
      throw Error('invald name');
    }
    self.db = level(self.fullname, leveldbOpts ,function(err){
      if(err){
        no(err);
      }else{
        yes(self.db);
      }
    });
  });
  self.then = p.then.bind(p);
}
Tree.prototype = treeUtils;
Tree.prototype.toQuad = function(coords){
  return nonTree.toQuad(coords,this.maxDepth,this.range);
}
Tree.prototype.next = nonTree.next;

Tree.prototype.whichChildren = function(quad, bbox){
  return nonTree.whichChildren(quad, bbox, this.maxDepth, this.range);
}
Tree.prototype.extent = function(bbox){
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
      if(~~bboxen[value].indexOf(array[i].id)){
        bboxen[value].push(array[i].id);
      }
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
        return utils.contains(bbox,item.bbox)||utils.intersects(bbox, item.bbox);
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

module.exports = Tree;