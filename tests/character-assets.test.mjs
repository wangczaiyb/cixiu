import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {patterns} from '../dist/patterns.js';

test('every popular character has a bundled prototype image, including Rilakkuma',async()=>{
  const popular=patterns.filter(p=>p.group==='popular');
  assert.ok(popular.length>=27);
  assert.equal(new Set(patterns.map(p=>p.id)).size,patterns.length);
  assert.ok(popular.some(p=>p.id==='rilakkuma'&&p.name==='轻松熊'));
  for(const p of popular){
    assert.match(p.image||'',/^\.\/assets\/characters\/[a-z0-9-]+\.(png|jpe?g|webp|gif|svg)$/i,p.name+' needs its actual prototype');
    const bytes=await readFile(new URL('../dist/'+p.image.slice(2),import.meta.url));
    assert.ok(bytes.length>500,p.name+' image must be complete');
    if(p.imageCrop){
      assert.equal(p.imageCrop.length,4);assert.ok(p.imageCrop.every(Number.isFinite));
      const [x,y,w,h]=p.imageCrop;assert.ok(x>=0&&y>=0&&w>0&&h>0);
      if(p.image.endsWith('.png')){assert.ok(x+w<=bytes.readUInt32BE(16),p.name+' crop width');assert.ok(y+h<=bytes.readUInt32BE(20),p.name+' crop height');}
    }
  }
});
