var utils = require('./utils');
function getMid(box){
  var dif = [(box[2]-box[0])/3,(box[3]-box[1])/3];
  return [[box[0]+dif[0],box[1]+dif[1]],[box[2]-dif[0],box[3]-dif[1]]];
}
var tiles = [
  ['a','b','c'],
  ['f','e','d'],
  ['g','h','i']
];
function whichQuad(coord,mid,prev){
  var x,y;
  if(coord[0]<mid[0][0]){
    x = 0;
  }else if(coord[0]>mid[1][0]){
    x = 2;
  }else{
    x = 1;
  }
  if(coord[1]<mid[0][1]){
    y = 2;
  }else if(coord[1]>mid[1][1]){
    y = 0;
  }else{
    y = 1;
  }
  return normilize(prev,tiles[y][x]);
};
function normilize(prev,current){
  var flipx = 0;
  var flipy = 0;
  var i = 0;
  var len = prev.length;
  while(i<len){
    if(~['b','e','h'].indexOf(prev[i])){
      flipy+=1;
    }
    if(~['f','e','d'].indexOf(prev[i])){
      flipx+=1;
    }
    i++;
  }
  return normalization[!!(flipx%2)][!!(flipy%2)][current];
};
function newBox(quad,oldBox,mid,prev){
  var out = [0,0,0,0];
  var normilizedQuad = normilize(prev,quad);
  if(~['a','b','c'].indexOf(normilizedQuad)){
    out[1]=mid[1][1];
    out[3]=oldBox[3];
  }else if(~['f','e','d'].indexOf(normilizedQuad)){
    out[1]=mid[0][1];
    out[3]=mid[1][1];
  }else{
    out[1]=oldBox[1];
    out[3]=mid[0][1];
  }
  if(~['a','f','g'].indexOf(normilizedQuad)){
    out[0]=oldBox[0];
    out[2]=mid[0][0]
  }else if(~['b','e','h'].indexOf(normilizedQuad)){
    out[0] = mid[0][0];
    out[2] = mid[1][0];
  }else{
    out[0] = mid[1][0];
    out[2] = oldBox[2];
  }
  return out;
}
function toQuad(coords, maxDepth, box){
  var depth = -1;
  var out = "";
  var current,mid,prev;
  while(depth++<maxDepth){
    mid = getMid(box);
    prev = current;
    current = whichQuad(coords,mid,out);
    box = newBox(current,box,mid,out);
    out+=current;
  }
  return out;
}
function fromQuad(quad, range){
  var depth = quad.length;
  var i = -1;
  var current,letter,prev,mid;
  while(++i<depth){
    prev = letter;
    letter = quad[i];
    mid = getMid(range);
    range = newBox(letter,range,mid,quad.slice(0,i));
  }
  return range;
}
function next(quad){
  if(!quad.length){
    return quad;
  }
  var i = quad.length;
  while(i){
    i--;
    if(quad.charCodeAt(i)<105){
      return quad.slice(0,i)+String.fromCharCode(quad.charCodeAt(i)+1)+quad.slice(i+1);
    }else if(quad.charCodeAt(i)===105){
      quad=quad.slice(0,i)+'a'+quad.slice(i+1);
    }else{
      throw new Error('invalid tile name');
    }
  }
}
function whichChildren(quad, bbox, searchDepth){
  var children = [quad+'a',quad+'b',quad+'c',quad+'d',quad+'e',quad+'f',quad+'g',quad+'h',quad+'i'];
  var full = [];
  var partial = [];
  var change = [];
  children.forEach(function(child){
    var childBox = fromQuad(child, bbox);
    if(utils.contains(bbox,childBox)){
      full.push(child);
    }else if(utils.intersects(bbox,childBox)){
      if(child.length===searchDepth){
        full.push(child);
      }else{
        partial.push(child);
      }
    }
  },this);
  return {full:full,partial:partial,id:quad}
}
exports.next = next;
exports.toQuad = toQuad;
exports.whichChildren = whichChildren;
var normalization = {
  true:{
    true:{
      c:'g',
      b:'h',
      a:'i',
      f:'d',
      e:'e',
      d:'f',
      i:'a',
      h:'b',
      g:'c'
    },
    false:{
      c:'a',
      b:'b',
      a:'c',
      f:'d',
      e:'e',
      d:'f',
      i:'g',
      h:'h',
      g:'i'
    }
  },
  false:{
    true:{
      a:'g',
      b:'h',
      c:'i',
      d:'d',
      e:'e',
      f:'f',
      g:'a',
      h:'b',
      i:'c'
    },
    false:{
      a:'a',
      b:'b',
      c:'c',
      d:'d',
      e:'e',
      f:'f',
      g:'g',
      h:'h',
      i:'i'
    }
  }
};