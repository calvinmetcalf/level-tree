'use strict';
var Tree = require('../');
var schools = require('./schools.json');
var Promise = require('lie');
var fs = require('fs');
function removeAll(path){
  fs.readdirSync(path).forEach(function(v){
    fs.unlinkSync(path+'/'+v);
  });
  fs.rmdirSync(path);
}
function someData(n) {
  var data = [];

  for (var i = 0; i < n; i++) {
    data.push({bbox:[i, i, i, i]});
  }
  return data;
}

var data = [[0,0,0,0],[10,10,10,10],[20,20,20,20],[25,0,25,0],[35,10,35,10],[45,20,45,20],[0,25,0,25],[10,35,10,35],
  [20,45,20,45],[25,25,25,25],[35,35,35,35],[45,45,45,45],[50,0,50,0],[60,10,60,10],[70,20,70,20],[75,0,75,0],
  [85,10,85,10],[95,20,95,20],[50,25,50,25],[60,35,60,35],[70,45,70,45],[75,25,75,25],[85,35,85,35],[95,45,95,45],
  [0,50,0,50],[10,60,10,60],[20,70,20,70],[25,50,25,50],[35,60,35,60],[45,70,45,70],[0,75,0,75],[10,85,10,85],
  [20,95,20,95],[25,75,25,75],[35,85,35,85],[45,95,45,95],[50,50,50,50],[60,60,60,60],[70,70,70,70],[75,50,75,50],
  [85,60,85,60],[95,70,95,70],[50,75,50,75],[60,85,60,85],[70,95,70,95],[75,75,75,75],[85,85,85,85],[95,95,95,95]].map(function(v){
    return {bbox:v};
  });
require("mocha-as-promised")();
var chai = require("chai");
var should = chai.should();
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
  describe('next',function(){
    it('should work',function(){
      Tree.prototype.next('aaa').should.equal('aab');
    });
    it('should wrap around',function(){
      Tree.prototype.next('aai').should.equal('aba');
    });
    it('should wrap give a string for a string',function(){
      Tree.prototype.next('').should.equal('');
    });
    it('should thorw an error for an invalid string',function(){
      return new Promise(function(yes,no){
        Tree.prototype.next('ak');
      }).should.be.rejected;
    });
  });
  describe('intermediate',function(){
    this.timeout(50000);
    var tree;
    beforeEach(function(){
      tree = new Tree('test');
      return tree;
    });
    afterEach(function(){
      return tree.destroy();
    });
    after(function(){
      removeAll('__tree__blah');
      removeAll('__tree__tree2');
    })
    it('should be able to be closed twice',function(){
      return tree.close().should.become(true);
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
        return tree.search([-75,35,-65,45]);
      }).then(function(reslt){
        return reslt[0].id;
      }).should.become(1);
    });
    it('should be able to remove stuff',function(){
      return tree.load([schools.features[0]]).then(function(id){
        return tree.load([schools.features[1]]);
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
      }).should.become(330);
    });
    it('should be able to insert stuff batch and then remove stuff',function(){
      return tree.load(schools).then(function(){
        return tree.hasItem(1).then(function(answer){
          if(answer){
            return tree.remove(1);
          }
        });
      }).then(function(){
        return tree.search([-100,0,0,80]);
      }).then(function(reslt){
        return reslt.length
      }).should.become(329);
    });
    it('should throw an error if we look for stuff in a closed db',function(){
      return tree.close().then(function(){
        return tree.has('not real');
      }).should.be.rejected;
    });
    it('should throw an error if we delete stuff in a closed db',function(){
      return tree.close().then(function(){
        return tree.del('not real');
      }).should.be.rejected;
    });
    it('should throw an error if we put stuff in a closed db',function(){
      return tree.close().then(function(){
        return tree.put('not real');
      }).should.be.rejected;
    });
    it('should throw an error if we destory a db twice',function(){
      return new Tree('blah').then(function(tree){
        return tree.destroy().then(function(){
          return tree.destroy();
        });
      }).should.be.rejected;
    });
    it("should throw an error if we don't give a name",function(){
      return new Tree().should.be.rejected;
    });
    it("should throw an error if we specify it can't be created we do",function(){
      return new Tree('tree2',{createIfMissing:false}).should.be.rejected;
    });
    it("should throw an error if we try to create it twice",function(){
      return new Tree('test',{errorIfExists:true}).should.be.rejected;
    });
  });
});