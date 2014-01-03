var level = require('level-hyper');
var Promise = require('lie');
exports.putItem = function(key,value){
  return this.put('z-'+key, value);
}
exports.put = function(key, value){
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
exports.fetch = function(key){
  return this.get('z-'+key);
};
exports.get = function(id){
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
exports.has = function(id){
  return this.get(id).then(function(){return true;},function(err){
    if(err.notFound){
      return false;
    }else{
      throw err;
    }
  })
}
exports.hasItem = function(id){
  return this.has('z-'+id);
}
exports.delItem = function(key){
  return this.del('z-'+key);
};
exports.del = function(id){
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
exports.close = function(){
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
exports.destroy = function(){
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