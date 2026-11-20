/* Every sound is synthesised live with Web Audio — no audio files.
 * Ocean waves + a soft pad for ambience; chimes, boings, splashes, babble and fireworks for the island. */
import { get, save } from './storage';

type Wave = OscillatorType;
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private reverb!: ConvolverNode;
  private ambience: GainNode | null = null;
  private crickets: GainNode | null = null;
  private chordTimer = 0;
  enabled = get<boolean>('ddi-sound', true);
  private listeners = new Set<(on: boolean) => void>();

  onChange(fn: (on: boolean) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Must run inside a user gesture (a click/tap/key press). Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        this.ctx = new Ctor();
      } catch {
        return;
      }
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.enabled ? 0.85 : 0;
      this.master.connect(comp).connect(this.ctx.destination);
      this.sfx = this.ctx.createGain();
      this.sfx.gain.value = 0.55;
      this.sfx.connect(this.master);
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this.impulse(2.6, 2.6);
      const wet = this.ctx.createGain();
      wet.gain.value = 0.3;
      this.reverb.connect(wet).connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  toggle(force?: boolean) {
    this.enabled = force ?? !this.enabled;
    save('ddi-sound', this.enabled);
    if (this.ctx) {
      const t = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(t);
      this.master.gain.setTargetAtTime(this.enabled ? 0.85 : 0, t, 0.12);
    }
    this.listeners.forEach((fn) => fn(this.enabled));
  }

  private impulse(seconds: number, decay: number) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  private noiseBuf: AudioBuffer | null = null;
  private noise(seconds = 2) {
    const ctx = this.ctx!;
    if (!this.noiseBuf) {
      const len = Math.floor(ctx.sampleRate * seconds);
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    return this.noiseBuf;
  }

  private on() {
    return !!this.ctx && this.enabled;
  }

  private tone(freq: number, o: { type?: Wave; dur?: number; vol?: number; at?: number; slide?: number; wet?: boolean; attack?: number } = {}) {
    if (!this.on()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + (o.at ?? 0);
    const dur = o.dur ?? 0.15;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t + dur);
    const vol = o.vol ?? 0.2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (o.attack ?? 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfx);
    if (o.wet) g.connect(this.reverb);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  private bell(freq: number, at = 0, vol = 0.15) {
    if (!this.on()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + at;
    const car = ctx.createOscillator();
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    const g = ctx.createGain();
    car.frequency.value = freq;
    mod.frequency.value = freq * 3.5;
    mg.gain.setValueAtTime(freq * 2.2, t);
    mg.gain.exponentialRampToValueAtTime(1, t + 1.2);
    mod.connect(mg).connect(car.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    car.connect(g);
    g.connect(this.sfx);
    g.connect(this.reverb);
    car.start(t);
    mod.start(t);
    car.stop(t + 1.6);
    mod.stop(t + 1.6);
  }

  private burst(o: { at?: number; dur?: number; vol?: number; type?: BiquadFilterType; from: number; to: number; q?: number; wet?: boolean }) {
    if (!this.on()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + (o.at ?? 0);
    const dur = o.dur ?? 0.3;
    const src = ctx.createBufferSource();
    src.buffer = this.noise();
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(o.from, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, o.to), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.vol ?? 0.15, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    if (o.wet) g.connect(this.reverb);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  /* ───── UI ───── */
  click() {
    this.tone(660, { dur: 0.07, vol: 0.07, type: 'triangle' });
    this.tone(990, { dur: 0.08, vol: 0.045, type: 'sine', at: 0.03 });
  }
  pop() {
    this.tone(420 + Math.random() * 160, { dur: 0.12, vol: 0.14, type: 'sine', slide: 2.4 });
  }
  error() {
    this.tone(240, { dur: 0.16, vol: 0.08, type: 'triangle', slide: 0.7 });
  }
  success() {
    [659.25, 830.61, 987.77, 1318.5].forEach((f, i) => this.bell(f, i * 0.09, 0.12));
  }
  paper() {
    this.burst({ from: 2400, to: 900, dur: 0.35, vol: 0.12, type: 'highpass', q: 0.6 });
    this.burst({ from: 5000, to: 2000, dur: 0.22, vol: 0.06, at: 0.08, type: 'bandpass' });
  }
  flip() {
    this.burst({ from: 1800, to: 3600, dur: 0.12, vol: 0.06, type: 'bandpass', q: 2 });
    this.tone(880, { dur: 0.06, vol: 0.04, type: 'triangle', at: 0.05 });
  }
  crystal() {
    [1568, 2093, 2637, 3136].forEach((f, i) => this.bell(f, i * 0.07, 0.09));
  }

  /* ───── island ───── */
  step(wet: boolean) {
    if (wet) this.burst({ from: 900, to: 400, dur: 0.16, vol: 0.06, type: 'lowpass' });
    else this.burst({ from: 1300, to: 500, dur: 0.07, vol: 0.035, type: 'bandpass', q: 1.4 });
  }
  jump() {
    this.tone(330, { dur: 0.2, vol: 0.12, type: 'sine', slide: 2.2 });
    this.tone(660, { dur: 0.12, vol: 0.04, type: 'triangle', slide: 1.6, at: 0.02 });
  }
  land(power: number) {
    this.burst({ from: 500, to: 120, dur: 0.14, vol: Math.min(0.14, 0.03 + power * 0.008), type: 'lowpass' });
  }
  splash() {
    this.burst({ from: 2200, to: 300, dur: 0.6, vol: 0.2, type: 'lowpass', wet: true });
    this.tone(180, { dur: 0.3, vol: 0.08, slide: 0.5 });
  }
  sprinkle(combo: number) {
    const f = PENTA[Math.min(combo, PENTA.length - 1)];
    this.tone(f, { dur: 0.14, vol: 0.1, type: 'triangle', wet: true });
    this.tone(f * 2, { dur: 0.1, vol: 0.04, type: 'sine', at: 0.04 });
  }
  bottle() {
    this.bell(1760, 0, 0.1);
    this.bell(2349, 0.08, 0.07);
    this.burst({ from: 3000, to: 1200, dur: 0.25, vol: 0.05, at: 0.05 });
  }
  quest() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => this.tone(f, { dur: 0.42, vol: 0.1, type: 'triangle', at: i * 0.08, wet: true }));
    this.bell(2093, 0.42, 0.08);
  }
  trophy() {
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, { dur: 0.36, vol: 0.08, type: 'square', at: i * 0.06, wet: true }));
  }
  /** Donut "voice": a little babble of pentatonic blips, pitched per character. */
  babble(seed: number, syllables = 10) {
    if (!this.on()) return;
    const base = 0.9 + (seed % 7) * 0.08;
    for (let i = 0; i < syllables; i++) {
      const f = PENTA[(seed + i * 3 + Math.floor(Math.random() * 3)) % 5] * base * 0.5;
      this.tone(f, { dur: 0.07, vol: 0.06, type: 'triangle', at: i * 0.075, slide: 1.12 });
    }
  }
  sparkle() {
    for (let i = 0; i < 5; i++) this.bell(PENTA[(i * 2) % PENTA.length] * 2, i * 0.05, 0.035);
  }
  golden() {
    [783.99, 987.77, 1174.66, 1567.98, 1975.53, 2349.32].forEach((f, i) => this.bell(f, i * 0.07, 0.1));
  }
  launch() {
    this.burst({ from: 400, to: 2600, dur: 0.7, vol: 0.05, type: 'bandpass', q: 3 });
  }
  boom(dist = 1) {
    const v = 0.22 / Math.max(1, dist);
    this.burst({ from: 600, to: 60, dur: 1.1, vol: v, type: 'lowpass', wet: true });
    for (let i = 0; i < 6; i++) this.burst({ from: 4000 + Math.random() * 2000, to: 1500, dur: 0.06, vol: v * 0.35, at: 0.25 + i * 0.07 + Math.random() * 0.05 });
  }
  finale() {
    [261.63, 329.63, 392, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, { dur: 1.6, vol: 0.06, type: 'triangle', at: i * 0.12, wet: true, attack: 0.08 }));
    [1046.5, 1318.5, 1567.98, 2093].forEach((f, i) => this.bell(f, 0.9 + i * 0.15, 0.08));
  }
  reveal() {
    this.burst({ from: 300, to: 5000, dur: 1.2, vol: 0.06, type: 'bandpass', q: 0.8, wet: true });
    this.finale();
  }

  /* ───── ambience ───── */
  startAmbience() {
    if (!this.ctx || this.ambience) return;
    const ctx = this.ctx;
    this.ambience = ctx.createGain();
    this.ambience.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.ambience.gain.exponentialRampToValueAtTime(0.9, ctx.currentTime + 3);
    this.ambience.connect(this.master);
    // waves: brown noise → lowpass, swelling slowly
    const len = ctx.sampleRate * 6;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const swell = ctx.createGain();
    swell.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lg = ctx.createGain();
    lg.gain.value = 0.035;
    lfo.connect(lg).connect(swell.gain);
    const lfo2 = ctx.createOscillator();
    lfo2.frequency.value = 0.05;
    const lg2 = ctx.createGain();
    lg2.gain.value = 250;
    lfo2.connect(lg2).connect(lp.frequency);
    src.connect(lp).connect(swell).connect(this.ambience);
    src.start();
    lfo.start();
    lfo2.start();
    // a warm pad: Fmaj9 → Dm9 → Bbmaj9 → C6/9
    const chords = [
      [174.61, 220, 261.63, 329.63, 392],
      [146.83, 174.61, 220, 261.63, 329.63],
      [116.54, 174.61, 220, 293.66, 349.23],
      [130.81, 196, 246.94, 293.66, 329.63],
    ];
    let step = 0;
    const play = () => {
      if (!this.ctx || !this.ambience) return;
      const t = ctx.currentTime;
      const chord = chords[step++ % chords.length];
      const bus = ctx.createGain();
      bus.gain.setValueAtTime(0.0001, t);
      bus.gain.exponentialRampToValueAtTime(0.022, t + 2.2);
      bus.gain.setValueAtTime(0.022, t + 6);
      bus.gain.exponentialRampToValueAtTime(0.0001, t + 9.4);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 950;
      bus.connect(f);
      f.connect(this.ambience);
      f.connect(this.reverb);
      for (const fr of chord)
        for (const det of [-6, 6]) {
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.value = fr;
          o.detune.value = det;
          o.connect(bus);
          o.start(t);
          o.stop(t + 9.5);
        }
      for (let i = 0; i < 3; i++) if (Math.random() < 0.6) this.bell(PENTA[Math.floor(Math.random() * 6)], 1 + Math.random() * 6, 0.02);
    };
    play();
    this.chordTimer = window.setInterval(play, 8000);
  }

  stopAmbience() {
    if (!this.ctx || !this.ambience) return;
    const g = this.ambience;
    g.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.6);
    window.clearInterval(this.chordTimer);
    setTimeout(() => g.disconnect(), 2500);
    this.ambience = null;
    this.setNight(false);
  }

  /** Soft crickets at night. */
  setNight(on: boolean) {
    if (!this.ctx) return;
    if (on && !this.crickets && this.ambience) {
      const ctx = this.ctx;
      this.crickets = ctx.createGain();
      this.crickets.gain.value = 0.0001;
      this.crickets.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5);
      this.crickets.connect(this.ambience);
      const chirp = () => {
        if (!this.crickets || !this.ctx) return;
        const t = this.ctx.currentTime;
        for (let i = 0; i < 3; i++) {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.frequency.value = 4200 + Math.random() * 300;
          g.gain.setValueAtTime(0.0001, t + i * 0.06);
          g.gain.exponentialRampToValueAtTime(0.012, t + i * 0.06 + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.04);
          o.connect(g).connect(this.crickets);
          o.start(t + i * 0.06);
          o.stop(t + i * 0.06 + 0.05);
        }
        setTimeout(chirp, 600 + Math.random() * 1400);
      };
      chirp();
    } else if (!on && this.crickets) {
      const c = this.crickets;
      c.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.5);
      setTimeout(() => c.disconnect(), 2000);
      this.crickets = null;
    }
  }
}

export const sound = new SoundEngine();
