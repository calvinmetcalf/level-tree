'use strict';
var Tree = require('../');
var schools = require('./schools.json');

require("mocha-as-promised")();
var chai = require("chai");
chai.should();
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
describe('tree',function(){
  describe('basic',function(){
    it('should work', function(){
      var tree = new Tree('test');
      tree.should.exist;
      return tree.destroy().should.become(true);
    });
    it('should work multiple times', function(){
      var tree = new Tree('test');
      return tree.close().then(function(){
        var tree2 = new Tree('test');
        tree2.should.exist;
        return tree2.destroy().should.become(true);
      });
    });
  });
  describe('intermediate',function(){
    var tree;
    beforeEach(function(){
      tree = new Tree('test');
      return tree;
    });
    afterEach(function(){
      return tree.destroy();
    });
    it('should be able to add stuff',function(){
      return tree.insert({
        type:schools.features[0].type,
        geometry:schools.features[0].geometry,
        properties:schools.features[0].properties
      }).then(function(a){
        return true;
      }).should.become(true);
    });
    it('should be able to add stuff and then get it',function(){
      return tree.insert(schools.features[0]).then(function(id){
        return tree.fetch(id);
      }).then(function(item){
        return item.geometry;
      }).should.become(schools.features[0].geometry);
    });
    it('should be able to add stuff, close it, open it and then get it',function(){
      return tree.insert(schools.features[0]).then(function(id){
        return tree.close().then(function(){
          tree = new Tree('test');
        }).then(function(){
          return tree.fetch(id);
        });
      }).then(function(item){
        return item.geometry;
      }).should.become(schools.features[0].geometry);
    });
    it('should be able to search stuff',function(){
      return tree.insert(schools.features[0]).then(function(a){
        return tree.search([-100,0,0,80]);
      }).then(function(reslt){
        return reslt[0].id;
      }).should.become(1);
    });
    it('should be able to remove stuff',function(){
      return tree.insert(schools.features[0]).then(function(id){
        return tree.insert(schools.features[1]);
      }).then(function(){
          return tree.remove(1);
      }).then(function(){
        return tree.search([-100,0,0,80]);
      }).then(function(reslt){
        return reslt[0].id;
      }).should.become(2);
    });
    it('should be able to insert stuff batch',function(){
      return tree.load(schools.features).then(function(){
        return tree.search([-100,0,0,80]);
      }).then(function(reslt){
        return reslt.length
      }).should.become(2673);
    });
    it('should be able to insert stuff batch and then remove stuff',function(){
      return tree.load(schools.features).then(function(){
        return tree.remove(1);
      }).then(function(){
        return tree.search([-100,0,0,80]);
      }).then(function(reslt){
        return reslt.length
      }).should.become(2672);
    });
  });
});