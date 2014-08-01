'use strict';
var Promise = require('bluebird');
var err = new Error('not found');
err.notFound = true;
var NOT_FOUND = Promise.reject(err);
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
    return NOT_FOUND;
  }
};
MemStore.prototype.put = function(key, value) {
  key = '$' + key;
  this.store[key] = value;
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