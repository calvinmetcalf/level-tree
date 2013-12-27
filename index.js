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
  this._maxEntries = Math.max(4, options.maxEntries || 9);
  this._minEntries = Math.max(2, Math.ceil(this._maxEntries * 0.4));
  this.clear();
  self.fullname = '__tree__'+name;
  self.then = new Promise(function(yes){
    self.db = level(self.fullname, {valueEncoding:'json', createIfMissing:false},function(err){
      if(err){
        self.db = level(self.fullname, {valueEncoding:'json'},function(err){
          yes(self.db);
        });
      }else{
        self.get('tree').then(function(tree){
          self.fromJSON(tree);
          yes(self.db);
        },function(err){
          yes(self.db);
        });
      }
    });
  }).then;
}
Tree.prototype = new Rbush();
Tree.prototype.sync = function(){
  return this.put('tree',this.data);
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
  this._insert(bbox, this.data.height - 1);
  return this.put(id,item).then(function(resp){
    self.sync();
    return id;
  });
};
Tree.prototype.load = function(array){
  if(!Array.isArray(array)&&array.features){
    array = array.features;
  }
  var self = this;
  var batch = [];
  var bboxen = [];
  var i = -1;
  var len = array.length;
  while(++i<len){
    if(!array[i].bbox){
      array[i].bbox = makeBbox(array[i]);
    }
    if(!array[i].id){
      array[i].id = makeID(array[i]);
    }
    array[i].bbox.id = array[i].id;
    batch[i] = {key:array[i].id,value:array[i],type:'put'};
    bboxen[i] = array[i].bbox;
  };
  Rbush.prototype.load.call(this,bboxen);
  batch.push({type:'put',key:'tree',value:this.data});
  return new Promise(function(yes){
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
  var results = Rbush.prototype.search.call(this,bbox);
  return all(results.map(function(item){
    return this.get(item.id);
  },this));
}
Tree.prototype.remove = function(id){
  var self = this;
  return self.get(id).then(function(resp){
    var bbox = resp.bbox;
    bbox.id = resp.id;
    return bbox;
  }).then(function(bbox){
    return self.del(id).then(function(){
      return bbox
    });
  }).then(function(item){
    var resp =  Rbush.prototype.remove.call(self,item);
    self.sync();
    return resp;
  });
};
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