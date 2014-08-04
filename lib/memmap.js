'use strict';
var Promise = require('bluebird');

var TRUE = Promise.resolve(true);
var FALSE = Promise.resolve(false);

module.exports = MemStore;

function MemStore() {
  this.store = Object.create(null);
}
MemStore.prototype.get = function(key) {
  key = '$' + key;
  if (key in this.store) {
    return Promise.resolve(this.store[key]);
  } else {
    var err = new Error('not found');
    err.notFound = true;
    return Promise.reject(err);
  }
};
MemStore.prototype.put = function(key, value) {
  key = '$' + key;
  this.store[key] = JSON.parse(JSON.stringify(value));
  return TRUE;
};

MemStore.prototype.del = function(key) {
  key = '$' + key;
  if (key in this.store) {
    delete this.store[key];
    return TRUE;
  }
  return FALSE;
};
MemStore.prototype.batch = function(array) {
  var self = this;
  return Promise.all(array.map(function (item) {
    if (item.type === 'del') {
      return self.del(item.key);
    }
    return self.put(item.key, item.value);
  }));
};
MemStore.prototype.clear = function() {
  this.store = Object.create(null);
  return TRUE;
};