import test from 'node:test';
import assert from 'node:assert/strict';
import {trimArtworkPixels} from '../dist/character-art.js';
test('only border-connected white is removed; a white face inside its outline stays',()=>{
  const w=9,h=9,p=new Uint8ClampedArray(w*h*4).fill(255);
  for(let y=2;y<=6;y++)for(let x=2;x<=6;x++)if(x===2||x===6||y===2||y===6){const i=(y*w+x)*4;p[i]=p[i+1]=p[i+2]=20;}
  const b=trimArtworkPixels(p,w,h);
  assert.deepEqual(b,{x:2,y:2,width:5,height:5});assert.equal(p[3],0);assert.equal(p[(4*w+4)*4+3],255);
});
test('transparent artwork keeps its alpha and finds visible bounds',()=>{
  const p=new Uint8ClampedArray(8*8*4);p[(3*8+4)*4+3]=255;
  assert.deepEqual(trimArtworkPixels(p,8,8),{x:4,y:3,width:1,height:1});assert.equal(trimArtworkPixels(new Uint8ClampedArray(16),2,2),null);
});
