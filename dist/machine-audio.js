// Short mechanical transients plus a quiet motor. All audio is synthesized
// locally, starts after a user gesture and fades out when the needle stops.
export class MachineAudio {
  constructor({ volume = .45, enabled = true, machine = true } = {}) {
    this.volume = volume; this.enabled = enabled; this.machine = machine;
    this.active = false; this.speed = 1; this.motor = null;
  }
  unlock() {
    const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!Audio) return false;
    if (!this.context) {
      this.context = new Audio();
      this.master = this.context.createGain();
      this.master.gain.value = this.enabled ? this.volume : 0;
      this.master.connect(this.context.destination);
      this.noise = this.context.createBuffer(1, Math.ceil(this.context.sampleRate * .12), this.context.sampleRate);
      const data = this.noise.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < data.length; i++) { previous = previous * .35 + (Math.random() * 2 - 1) * .65; data[i] = previous; }
    }
    if (this.context.state === 'suspended') this.context.resume().catch(() => {});
    this.syncMotor();
    return true;
  }
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? this.volume : 0, this.context.currentTime, .025);
  }
  setEnabled(value) {
    this.enabled = value; this.setVolume(this.volume); this.syncMotor();
  }
  setMachine(value) { this.machine = value; this.syncMotor(); }
  setActive(value) { this.active = value; this.syncMotor(); }
  setSpeed(value) {
    this.speed = value;
    if (this.motor) this.motor.osc.frequency.setTargetAtTime(85 + Math.log2(value) * 25, this.context.currentTime, .08);
  }
  syncMotor() {
    const shouldRun = this.active && this.enabled && this.machine && this.context;
    if (shouldRun && !this.motor) {
      const c = this.context, gain = c.createGain(), osc = c.createOscillator();
      osc.type = 'triangle'; osc.frequency.value = 85 + Math.log2(this.speed) * 25;
      gain.gain.setValueAtTime(0, c.currentTime); gain.gain.linearRampToValueAtTime(.018, c.currentTime + .08);
      osc.connect(gain).connect(this.master); osc.start();
      this.motor = { osc, gain };
    } else if (!shouldRun && this.motor) {
      const {osc, gain} = this.motor; this.motor = null;
      gain.gain.cancelScheduledValues(this.context.currentTime);
      gain.gain.setTargetAtTime(0, this.context.currentTime, .012);
      osc.stop(this.context.currentTime + .07);
    }
  }
  stitch() {
    if (!this.enabled || !this.context || this.context.state !== 'running' || this.volume === 0) return;
    const c = this.context, t = c.currentTime;
    if (this.lastStitch && t - this.lastStitch < .018) return;
    this.lastStitch = t;
    const osc = c.createOscillator(), body = c.createGain();
    osc.type = this.machine ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(this.machine ? 240 : 720, t);
    osc.frequency.exponentialRampToValueAtTime(this.machine ? 95 : 310, t + .035);
    body.gain.setValueAtTime(this.machine ? .085 : .04, t);
    body.gain.exponentialRampToValueAtTime(.0001, t + .05);
    osc.connect(body).connect(this.master); osc.start(t); osc.stop(t + .055);
    if (this.machine) {
      const noise = c.createBufferSource(), filter = c.createBiquadFilter(), click = c.createGain();
      noise.buffer = this.noise; filter.type = 'bandpass'; filter.frequency.value = 1800; filter.Q.value = .85;
      click.gain.setValueAtTime(.11, t); click.gain.exponentialRampToValueAtTime(.0001, t + .026);
      noise.connect(filter).connect(click).connect(this.master); noise.start(t); noise.stop(t + .03);
      const returnClick = c.createOscillator(), returnGain = c.createGain();
      returnClick.type = 'sine'; returnClick.frequency.value = 1300;
      returnGain.gain.setValueAtTime(.015, t + .026); returnGain.gain.exponentialRampToValueAtTime(.0001, t + .04);
      returnClick.connect(returnGain).connect(this.master); returnClick.start(t + .026); returnClick.stop(t + .045);
    }
  }
}
