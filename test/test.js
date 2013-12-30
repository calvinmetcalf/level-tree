'use strict';
var Tree = require('../');
var schools = require('./schools.json');
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
    // it('should be able to remove stuff',function(){
    //   return tree.load([schools.features[0]]).then(function(id){
    //     return tree.insert(schools.features[1]);
    //   }).then(function(){
    //       return tree.remove(1);
    //   }).then(function(){
    //     return tree.search([-100,0,0,80]);
    //   }).then(function(reslt){
    //     return reslt[0].id;
    //   }).should.become(2);
    // });
    // it('should be able to insert stuff batch',function(){
    //   return tree.load(schools.features).then(function(){
    //     return tree.search([-100,0,0,80]);
    //   }).then(function(reslt){
    //     return reslt.length
    //   }).should.become(2673);
    // });
    // it('should be able to insert stuff batch and then remove stuff',function(){
    //   return tree.load(schools.features).then(function(){
    //     return tree.remove(1);
    //   }).then(function(){
    //     return tree.search([-100,0,0,80]);
    //   }).then(function(reslt){
    //     return reslt.length
    //   }).should.become(2672);
    // });
  });
  // describe('rBush Data', function(){
  //   var tree;
  //   beforeEach(function(){
  //     tree = new Tree('test');
  //     return tree;
  //   });
  //   afterEach(function(){
  //     return tree.destroy();
  //   });
  //   it('should work',function(){
  //     return tree.destroy().then(function(){
  //       tree = new Tree('test',{maxEntries:4});
  //       return tree;
  //     }).then(function(){
  //       return tree.load(data);
  //     }).then(function(){
  //       return tree.data.height;
  //     }).should.become(3);
  //   });
  //   it('should work again',function(){
  //     return tree.destroy().then(function(){
  //       tree = new Tree('test',{maxEntries:4});
  //       return tree;
  //     }).then(function(){
  //       return tree.load(data);
  //     }).then(function(){
  //       return tree.all().length;
  //     }).should.become(48);
  //   });
  //   it('should properly merge',function(){
  //     return tree.destroy().then(function(){
  //       tree = new Tree('test',{maxEntries:4});
  //       return tree;
  //     }).then(function(){
  //       return tree.load(data);
  //     }).then(function(){
  //       return tree.load(someData(10));
  //     }).then(function(){
  //       return JSON.stringify(tree.all().sort());
  //     }).should.become(JSON.stringify(data.concat(someData(10)).map(function(v){
  //       return v.bbox;
  //     }).sort()));
  //   });
  //   it('should be able to search',function(){
  //     return tree.destroy().then(function(){
  //       tree = new Tree('test',{maxEntries:4});
  //       return tree;
  //     }).then(function(){
  //       return tree.load(data);
  //     }).then(function(){
  //       return tree.search([40, 20, 80, 70]);
  //     }).then(function(result){
  //       return result.map(function(v){
  //         return v.bbox;
  //       }).sort();
  //     }).should.become([
  //               [70,20,70,20],[75,25,75,25],[45,45,45,45],[50,50,50,50],[60,60,60,60],[70,70,70,70],
  //               [45,20,45,20],[45,70,45,70],[75,50,75,50],[50,25,50,25],[60,35,60,35],[70,45,70,45]
  //           ].sort());
  //   });
  // });
});