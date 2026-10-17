import test from 'node:test';
import assert from 'node:assert/strict';
import { MachineAudio } from '../dist/machine-audio.js';

class Parameter {
  constructor() { this.value = 0; }
  setValueAtTime(value) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
  cancelScheduledValues() {}
}
class Node {
  constructor() { this.gain = new Parameter(); this.frequency = new Parameter(); this.Q = new Parameter(); }
  connect(node) { return node; }
  start() { this.started = true; }
  stop() { this.stopped = true; }
}
class AudioContext {
  constructor() { this.state = 'running'; this.currentTime = 1; this.sampleRate = 44100; this.destination = new Node(); this.nodes = []; }
  createGain() { return new Node(); }
  createOscillator() { const node = new Node(); this.nodes.push(node); return node; }
  createBufferSource() { const node = new Node(); this.nodes.push(node); return node; }
  createBiquadFilter() { return new Node(); }
  createBuffer(channels, length) { return {getChannelData: () => new Float32Array(length)}; }
}

test('machine motor only starts after activation and stops on pause or mute', () => {
  globalThis.AudioContext = AudioContext;
  const audio = new MachineAudio();
  audio.setActive(true);
  assert.equal(audio.motor, null);
  audio.unlock();
  const motor = audio.motor;
  assert.ok(motor.osc.started);
  audio.setActive(false);
  assert.equal(motor.osc.stopped, true);
  assert.equal(audio.motor, null);
  audio.setActive(true);
  const second = audio.motor;
  audio.setEnabled(false);
  assert.equal(second.osc.stopped, true);
  assert.equal(audio.master.gain.value, 0);
  delete globalThis.AudioContext;
});
test('hand mode has no motor and mechanical sound follows speed and volume', () => {
  globalThis.AudioContext = AudioContext;
  const audio = new MachineAudio({machine:false}); audio.unlock(); audio.setActive(true);
  assert.equal(audio.motor, null);
  audio.setMachine(true); audio.setSpeed(4);
  assert.equal(audio.motor.osc.frequency.value, 135);
  audio.setVolume(.2); assert.equal(audio.master.gain.value, .2);
  const before = audio.context.nodes.length; audio.stitch();
  assert.equal(audio.context.nodes.length - before, 3);
  audio.setEnabled(false); audio.context.currentTime = 2;
  const mutedCount = audio.context.nodes.length; audio.stitch();
  assert.equal(audio.context.nodes.length, mutedCount);
  delete globalThis.AudioContext;
});
