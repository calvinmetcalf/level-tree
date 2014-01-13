'use strict';
var Tree = require('../lib');
var schools = require('./schools.json');
var trails = require('./trails.json');
var Promise = require('lie');
var fs = require('fs');
function removeAll(path){
  fs.readdirSync(path).forEach(function(v){
    fs.unlinkSync(path+'/'+v);
  });
  fs.rmdirSync(path);
}
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
    describe('points', function(){
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
    });
    describe('lines', function(){
      it('should be able to add stuff',function(){
        return tree.insert({
          type:trails.features[0].type,
          geometry:trails.features[0].geometry,
          properties:trails.features[0].properties
        }).then(function(a){
          return true;
        }).should.become(true);
      });
      it('should be able to add stuff and then get it',function(){
        return tree.insert(trails.features[0]).then(function(id){
          return tree.fetch(id);
        }).then(function(item){
          return item.geometry;
        }).should.become(trails.features[0].geometry);
      });
      it('should be able to add stuff, close it, open it and then get it',function(){
        return tree.insert(trails.features[0]).then(function(id){
          return tree.close().then(function(){
            tree = new Tree('test');
          }).then(function(){
            return tree.fetch(id);
          });
        }).then(function(item){
          return item.geometry;
        }).should.become(trails.features[0].geometry);
      });
      it('should be able to search stuff',function(){
        return tree.insert(trails.features[0]).then(function(a){
          return tree.search([-75,35,-65,45]);
        }).then(function(reslt){
          return reslt[0].id;
        }).should.become(1);
      });
      it('should be able to remove stuff',function(){
        return tree.load([trails.features[0]]).then(function(id){
          return tree.load([trails.features[1]]);
        }).then(function(){
            return tree.remove(1);
        }).then(function(){
          return tree.search([-75,35,-65,45]);
        }).then(function(reslt){
          return reslt[0].id;
        }).should.become(2);
      });
      it('should be able to insert stuff batch',function(){
        return tree.load(trails.features).then(function(){
          return tree.search([-75,35,-65,45]);
        }).then(function(reslt){
          return reslt.length
        }).should.become(386);
      });
      it('should be able to insert stuff batch and then remove stuff',function(){
        return tree.load(trails).then(function(){
          return tree.hasItem(1).then(function(answer){
            if(answer){
              return tree.remove(1);
            }
          });
        }).then(function(){
          return tree.search([-75,35,-65,45]);
        }).then(function(reslt){
          return reslt.length
        }).should.become(385);
      });
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