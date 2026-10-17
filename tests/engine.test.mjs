import test from 'node:test';
import assert from 'node:assert/strict';
import { StitchState, nearbySamples, splitSubpaths } from '../dist/engine.js';
import { patterns } from '../dist/patterns.js';

test('a stitch cannot be counted twice and a whole gesture can be undone', () => {
  const state = new StitchState(3);
  assert.equal(state.add(0, '#a27a51', 'stem'), true);
  assert.equal(state.add(0, '#a27a51', 'stem'), false);
  state.add(1, '#a27a51', 'stem');
  state.commit();
  state.add(2, '#cf9290', 'cross');
  assert.equal(state.complete, true);
  assert.equal(state.percent, 100);
  assert.equal(state.undo(), 1);
  assert.equal(state.count, 2);
  assert.equal(state.undo(), 2);
  assert.equal(state.count, 0);
});
test('saved work round trips and invalid or stale records cannot change progress', () => {
  const state = new StitchState(4);
  state.add(2, '#829575', 'running');
  const saved = state.serialize();
  saved.marks.push({id: 10, color: '#123456', style: 'stem'}, {id: 0, color: 'bad', style: 'cross'});
  const restored = new StitchState(4, saved);
  assert.equal(restored.count, 1);
  assert.deepEqual(restored.marks.get(2), state.marks.get(2));
  assert.equal(new StitchState(5, saved).count, 0);
  assert.equal(restored.undo(), 1);
});
test('fast pointer gestures bridge nearby stitches but never jump across paths', () => {
  const samples = Array.from({length: 30}, (_, id) => ({id, x: id * 4, y: 0, path: id < 15 ? 0 : 1}));
  const bridge = nearbySamples(samples, {x: 40, y: 0}, 12, samples[3]);
  assert.equal(bridge.length, 8);
  const nextPath = nearbySamples(samples, {x: 72, y: 0}, 12, samples[10]);
  assert.ok(nextPath.every(s => s.path === 1));
  assert.deepEqual(nearbySamples(samples, {x: 40, y: 100}, 12), []);
});

test('disconnected eyes and decorations never become connecting stitches', () => {
  const eyes = 'M144 189 Q151 197 158 189 M215 189 Q222 197 229 189';
  assert.deepEqual(splitSubpaths(eyes), ['M144 189 Q151 197 158 189', 'M215 189 Q222 197 229 189']);
  for (const pattern of patterns) {
    for (const path of pattern.paths) {
      const segments = splitSubpaths(path.d);
      assert.ok(segments.length >= 1);
      segments.forEach(segment => assert.equal((segment.match(/M/g) || []).length, 1));
    }
  }
});
