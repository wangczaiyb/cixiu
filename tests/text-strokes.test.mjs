import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeTextPattern, normalizeText, layoutGlyphs, resamplePolyline, transformStroke, polylineToPath, seededRandom, shardName } from '../dist/text-strokes.js';
import { getLatinGlyph } from '../dist/latin-strokes.js';

globalThis.fetch = async url => ({ ok:true, json:async () => JSON.parse(await readFile(url, 'utf8')) });

test('normalization retains explicit paragraphs and validates length and lines', () => {
  assert.equal(normalizeText('亲爱的\r\n\r\n你好\t呀'), '亲爱的\n\n你好 呀');
  assert.equal(normalizeText('e\u0301'), 'é');
  assert.throws(() => normalizeText(' '), /先写下/);
  assert.throws(() => normalizeText('字'.repeat(121)), /120/);
  assert.throws(() => normalizeText('字\n'.repeat(12)), /12 行/);
});

test('Latin alphabet has independent single-line strokes including lowercase and punctuation', () => {
  for (const c of 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789，。！？♡') {
    const glyph = getLatinGlyph(c);
    assert.ok(glyph?.strokes.length, c);
    for (const stroke of glyph.strokes) assert.ok(stroke.length >= 2, c);
  }
  assert.notDeepEqual(getLatinGlyph('A'), getLatinGlyph('a'));
  assert.equal(getLatinGlyph('😀'), null);
});

test('local Chinese centerlines load and produce separate, deterministic hand-sewn strokes', async () => {
  const a = await makeTextPattern('你好 Hello\n\n愿望实现♡');
  const b = await makeTextPattern('你好 Hello\n\n愿望实现♡');
  assert.equal(a.customText, true);
  assert.equal(a.group, 'text');
  assert.ok(a.paths.length > 35);
  assert.ok(a.layout.rows >= 3);
  assert.deepEqual(a,b);
  for (const path of a.paths) {
    assert.equal(path.handmade,true);
    assert.equal(path.texture,'wool');
    assert.match(path.d,/^M[0-9]/);
    assert.equal((path.d.match(/M/g)||[]).length,1);
    assert.doesNotMatch(path.d,/[Zz<>]|NaN/);
  }
  assert.notEqual(a.paths[0].d, (await makeTextPattern(a.text,{seed:901})).paths[0].d);
});

test('120 characters fit at wide letter setting without truncation and unsupported symbols fail clearly', async () => {
  const pattern = await makeTextPattern('愿'.repeat(120),{lineWidth:12,align:'left',lineSpacing:1.5});
  assert.equal(pattern.text.length,120);
  assert.equal(pattern.layout.rows,12);
  assert.ok(pattern.bounds.x >= 30 && pattern.bounds.y >= 30);
  assert.ok(pattern.bounds.x + pattern.bounds.width <= 370);
  assert.ok(pattern.bounds.y + pattern.bounds.height <= 370);
  await assert.rejects(makeTextPattern('开心😀'), /😀/);
});

test('left/center/right alignment preserves paragraphs and changes the shorter line', () => {
  const glyphs = [...'ABC\nA'].map(c => c === '\n' ? {character:c} : {character:c,...getLatinGlyph(c)});
  const left = layoutGlyphs(glyphs,{align:'left'}), center=layoutGlyphs(glyphs), right=layoutGlyphs(glyphs,{align:'right'});
  assert.equal(left.items.length,4);
  assert.ok(left.items[3].x < center.items[3].x);
  assert.ok(center.items[3].x < right.items[3].x);
  assert.equal(layoutGlyphs([{character:'\n'},{character:'\n'},{character:'A',...getLatinGlyph('A')}]).rows,3);
});

test('resampling supplies thread detail while bounded deterministic waviness keeps placement finite', () => {
  const points = [[0,0],[100,50]];
  assert.ok(resamplePolyline(points).length > 30);
  const transformed = transformStroke(points,{x:90,y:90,size:50},{roughness:.7},seededRandom(23));
  assert.deepEqual(transformed,transformStroke(points,{x:90,y:90,size:50},{roughness:.7},seededRandom(23)));
  assert.ok(transformed.every(p => p.every(Number.isFinite)));
  assert.match(polylineToPath(transformed),/^M/);
  assert.match(shardName('好'),/^[0-9a-f]{2}$/);
});

test('all 256 bundled shard objects have finite polylines and documented source/license', async () => {
  let count=0;
  for(let i=0;i<256;i++) {
    const data=JSON.parse(await readFile(new URL(`../dist/assets/hanzi/${i.toString(16).padStart(2,'0')}.json`,import.meta.url),'utf8'));
    assert.match(data.__notice,/Modified 2026-10-17/);
    for(const [character,strokes] of Object.entries(data).filter(([key])=>key!=='__notice')) {
      assert.equal(character.codePointAt(0)&255,i);
      for(const stroke of strokes) assert.ok(stroke.length>=2 && stroke.every(point=>point.length===2 && point.every(Number.isFinite)));
      count++;
    }
  }
  assert.equal(count,9574);
  const manifest=JSON.parse(await readFile(new URL('../dist/assets/hanzi/manifest.json',import.meta.url),'utf8'));
  assert.equal(manifest.glyphs,count);
  assert.equal(manifest.license,'Arphic Public License');
});

test('documentMode starts from top-left margin and keeps prior glyph paths strictly invariant when new characters are appended', async () => {
  const p1 = await makeTextPattern('你', { documentMode:true });
  assert.equal(p1.id, 'typewriter-doc-pattern');
  assert.ok(p1.bounds.x <= 50, `x should start near top-left margin (got ${p1.bounds.x})`);
  assert.ok(p1.bounds.y <= 50, `y should start near top-left margin (got ${p1.bounds.y})`);
  
  const p2 = await makeTextPattern('你好', { documentMode:true });
  assert.ok(p2.paths.length > p1.paths.length);
  for (let i = 0; i < p1.paths.length; i++) {
    assert.equal(p2.paths[i].d, p1.paths[i].d, `Path ${i} of previous character must remain invariant`);
  }
  
  const p3 = await makeTextPattern('你好\n世界', { documentMode:true });
  for (let i = 0; i < p2.paths.length; i++) {
    assert.equal(p3.paths[i].d, p2.paths[i].d, `Path ${i} of previous line must remain invariant`);
  }
  assert.equal(p3.layout.rows, 2);
});

