import { random } from "./maze.js";
// Original dormant Floor 1 sound recipe: beating mains hum, three narrow
// fluorescent-noise bands and quiet filtered room noise. No copied recordings.
export class AmbientAudio {
  constructor() {
    this.context = new AudioContext();
    const ctx = this.context;
    this.rng = random(910);
    this.master = ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(ctx.destination);
    const gain = (value, destination = this.master) => {
      const node = ctx.createGain();
      node.gain.value = value;
      node.connect(destination);
      return node;
    };
    const drone = gain(0.08);
    for (const [frequency, level] of [
      [60, 1],
      [60.18, 0.55],
    ]) {
      const osc = ctx.createOscillator();
      osc.frequency.value = frequency;
      osc.connect(gain(level, drone));
      osc.start();
    }
    const noise = (seconds) => {
      const source = ctx.createBufferSource(),
        buffer = ctx.createBuffer(
          1,
          Math.ceil(ctx.sampleRate * seconds),
          ctx.sampleRate,
        );
      const values = buffer.getChannelData(0);
      for (let i = 0; i < values.length; i++) values[i] = this.rng() * 2 - 1;
      source.buffer = buffer;
      source.loop = true;
      return source;
    };
    this.fluorescent = gain(0.55);
    const buzz = noise(4);
    for (const [frequency, q, level] of [
      [120, 28, 1],
      [240, 22, 0.6],
      [360, 16, 0.3],
    ]) {
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = frequency;
      filter.Q.value = q;
      buzz.connect(filter);
      filter.connect(gain(level, this.fluorescent));
    }
    buzz.start();
    const room = noise(8),
      low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 600;
    low.Q.value = 0.5;
    room.connect(low);
    low.connect(gain(0.012));
    room.start();
    this.nextFlicker = 6 + this.rng() * 19;
    this.lastTime = 0;
  }
  async setRunning(running) {
    if (this.context.state === "closed") return;
    // Silence immediately even if an earlier autoplay resume is still pending.
    this.master.gain.value = running ? 0.85 : 0;
    await (running ? this.context.resume() : this.context.suspend());
  }
  update(time) {
    if (time < this.lastTime) this.nextFlicker = time + 6 + this.rng() * 19;
    this.lastTime = time;
    if (time < this.nextFlicker) return;
    this.nextFlicker = time + 6 + this.rng() * 19;
    const at = this.context.currentTime,
      g = this.fluorescent.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(0.55, at);
    g.linearRampToValueAtTime(0.04, at + 0.03);
    g.linearRampToValueAtTime(0.55, at + 0.08);
    if (this.rng() < 0.4) {
      g.linearRampToValueAtTime(0.04, at + 0.13);
      g.linearRampToValueAtTime(0.55, at + 0.22);
    }
  }
  close() {
    return this.context.close();
  }
}
