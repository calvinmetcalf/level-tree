var level = require('level-hyper');
var Promise = require('bluebird');
exports.addMethods = function(self){
  self.putItem = Promise.promisify(self.kDB.put,self.kDB);
  self.put = Promise.promisify(self.db.put,self.db);
  self.fetch = Promise.promisify(self.kDB.get,self.kDB);
  self.get = Promise.promisify(self.db.get,self.db);
  self.delItem = Promise.promisify(self.kDB.del,self.kDB);
  self.del = Promise.promisify(self.db.del,self.db);
}
exports.proto = {};

exports.proto.close = function(){
  var self = this;
  return new Promise(function(yes, no){
    if(self.kDB.isClosed()){
      return yes(true);
    }else if(self.kDB._status === 'opening'){
      self.then(function(){
        self.kDB.close(function(err){
          if(err){
            no(err);
          }else{
            yes(true);
          }
        });
      });
    }else{
      self.kDB.close(function(err){
        if(err){
          no(err);
        }else{
          yes(true);
        }
      });
    }
  });
};
exports.proto.destroy = function(){
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