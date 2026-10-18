import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleFillStitches} from '../dist/fill-stitches.js';

test('fill follows visible colour fields and never bridges a transparent gap',()=>{
  const w=24,h=12,pixels=new Uint8ClampedArray(w*h*4);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(x>=8&&x<12)continue;
    const i=(y*w+x)*4;pixels[i]=x<8?255:32;pixels[i+1]=40;pixels[i+2]=60;pixels[i+3]=255;
  }
  const stitches=sampleFillStitches(pixels,w,h);
  assert.ok(stitches.length>0);
  for(const s of stitches){assert.ok(s.x1<8&&s.x2<=8||s.x1>=12);assert.ok(s.x2-s.x1<=7);assert.equal(s.satin,true);}
  assert.deepEqual(new Set(stitches.map(s=>s.color)),new Set(['#ff283c','#20283c']));
  assert.equal(new Set(stitches.map(s=>`${s.path}:${s.n}`)).size,stitches.length);
});

test('transparent canvas has no fill stitches',()=>{
  assert.deepEqual(sampleFillStitches(new Uint8ClampedArray(16*16*4),16,16),[]);
});
