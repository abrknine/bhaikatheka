// Every sound in the game is synthesized live with the Web Audio API — no audio files.
// Three moods: dholak + crowd (theka), lo-fi + rain (your room), soft romance (her place).
import { rand } from './util.js';

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const FEMALE = /veena|female|neerja|lekha|samantha|karen|moira|tessa|zira|susan|victoria|fiona|kajal|swara|heera/i;

export class Audio {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.voiceOn = true;
    this.speakingUntil = 0;
    this.voices = [];
    this.style = { music: 'dholak', ambience: 'crowd' };
    this.loops = [];
  }

  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);
    this.master = this.gain(0.9, comp);
    this.sfx = this.gain(1, this.master);
    this.musicBus = this.gain(this.musicOn ? 0.32 : 0, this.master);
    this.ambBus = this.gain(0.5, this.master);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = this.brown.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      b[i] = last * 3.5;
    }

    this.initPour();
    this.applyStyle();

    if (window.speechSynthesis) {
      const load = () => (this.voices = speechSynthesis.getVoices());
      load();
      speechSynthesis.onvoiceschanged = load;
    }
  }

  /** Switch the soundtrack + room tone. Safe to call before init(). */
  setStyle(music, ambience) {
    if (this.style.music === music && this.style.ambience === ambience && this.loops.length) return;
    this.style = { music, ambience };
    if (this.ctx) this.applyStyle();
  }

  applyStyle() {
    this.stopLoops();
    this.initAmbience(this.style.ambience);
    this.startMusic(this.style.music);
  }

  stopLoops() {
    clearInterval(this.musicTimer);
    clearTimeout(this.ambTimer);
    for (const node of this.loops) {
      try {
        node.stop();
      } catch {
        /* already stopped */
      }
    }
    this.loops = [];
  }

  loop(node) {
    this.loops.push(node);
    return node;
  }

  gain(v, dest) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    if (dest) g.connect(dest);
    return g;
  }

  osc(type, freq) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    return o;
  }

  src(buffer = this.noise, loop = false) {
    const s = this.ctx.createBufferSource();
    s.buffer = buffer;
    s.loop = loop;
    return s;
  }

  filter(type, freq, q = 1) {
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  }

  env(g, t, attack, peak, decay) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  // ---------- continuous pour ----------
  initPour() {
    const n = this.src(this.noise, true);
    const bp = this.filter('bandpass', 1100, 1.4);
    const lp = this.filter('lowpass', 2800);
    const lfo = this.osc('sine', 9);
    const lfoGain = this.gain(380);
    lfo.connect(lfoGain).connect(bp.frequency);
    this.pourGain = this.gain(0, this.sfx);
    n.connect(bp).connect(lp).connect(this.pourGain);
    n.start();
    lfo.start();
  }

  setPour(v) {
    if (!this.ctx) return;
    this.pourGain.gain.setTargetAtTime(Math.min(1, v) * 0.55, this.ctx.currentTime, 0.04);
  }

  // ---------- one-shots ----------
  gulp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.osc('sine', 260);
    o.frequency.setValueAtTime(rand(230, 290), t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.14);
    const g = this.gain(0, this.sfx);
    this.env(g, t, 0.012, 0.7, 0.16);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.25);
    const n = this.src();
    const lp = this.filter('lowpass', 420);
    const ng = this.gain(0, this.sfx);
    this.env(ng, t, 0.005, 0.35, 0.08);
    n.connect(lp).connect(ng);
    n.start(t, rand(0, 1.5), 0.15);
  }

  clink(vol = 1) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [2093, 2637, 3322, 4186, 5274].forEach((f, i) => {
      const o = this.osc('sine', f * rand(0.98, 1.02));
      const g = this.gain(0, this.sfx);
      this.env(g, t, 0.002, (0.22 * vol) / (i + 1), 0.5 + Math.random() * 0.7);
      o.connect(g);
      o.start(t);
      o.stop(t + 1.4);
    });
    const n = this.src();
    const hp = this.filter('highpass', 5000);
    const ng = this.gain(0, this.sfx);
    this.env(ng, t, 0.001, 0.3 * vol, 0.03);
    n.connect(hp).connect(ng);
    n.start(t, rand(0, 1.5), 0.06);
  }

  pop() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.src();
    const hp = this.filter('highpass', 1400);
    const g = this.gain(0, this.sfx);
    this.env(g, t, 0.001, 0.9, 0.06);
    n.connect(hp).connect(g);
    n.start(t, rand(0, 1.5), 0.1);
    const o = this.osc('sine', 900);
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(180, t + 0.08);
    const og = this.gain(0, this.sfx);
    this.env(og, t, 0.002, 0.5, 0.08);
    o.connect(og);
    o.start(t);
    o.stop(t + 0.15);
    this.fizz(1.4);
  }

  fizz(dur = 1.2) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.src();
    const hp = this.filter('highpass', 4200);
    const g = this.gain(0, this.sfx);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.28, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(hp).connect(g);
    n.start(t, rand(0, 0.5), dur + 0.1);
  }

  burp() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = rand(0.55, 0.9);
    const o = this.osc('sawtooth', 100);
    o.frequency.setValueAtTime(rand(95, 115), t);
    o.frequency.linearRampToValueAtTime(rand(62, 75), t + dur);
    const lfo = this.osc('sine', rand(22, 32));
    const lg = this.gain(22);
    lfo.connect(lg).connect(o.frequency);
    const bp = this.filter('bandpass', 520, 2.2);
    const lp = this.filter('lowpass', 1000);
    const g = this.gain(0, this.sfx);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1.0, t + 0.04);
    g.gain.setValueAtTime(1.0, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp).connect(lp).connect(g);
    o.start(t);
    lfo.start(t);
    o.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  thud() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.osc('sine', 160);
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.15);
    const g = this.gain(0, this.sfx);
    this.env(g, t, 0.003, 0.6, 0.16);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.25);
    this.clink(0.25);
  }

  crash() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.src();
    const hp = this.filter('highpass', 1800);
    const g = this.gain(0, this.sfx);
    this.env(g, t, 0.002, 1, 0.5);
    n.connect(hp).connect(g);
    n.start(t, 0, 0.6);
    for (let i = 0; i < 9; i++) {
      const st = t + Math.random() * 0.25;
      const o = this.osc('sine', rand(2500, 7000));
      const og = this.gain(0, this.sfx);
      this.env(og, st, 0.001, 0.12, rand(0.05, 0.3));
      o.connect(og);
      o.start(st);
      o.stop(st + 0.4);
    }
  }

  ding() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [[1318, 0], [1046, 0.16]].forEach(([f, d]) => {
      const o = this.osc('triangle', f);
      const g = this.gain(0, this.sfx);
      this.env(g, t + d, 0.005, 0.35, 0.6);
      o.connect(g);
      o.start(t + d);
      o.stop(t + d + 0.8);
    });
  }

  sparkle() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [1760, 2217, 2637, 3520].forEach((f, i) => {
      const st = t + i * 0.06;
      const o = this.osc('sine', f);
      const g = this.gain(0, this.sfx);
      this.env(g, st, 0.004, 0.12, 0.35);
      o.connect(g);
      o.start(st);
      o.stop(st + 0.45);
    });
  }

  // soft playful pat
  pat() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.src();
    const g = this.gain(0, this.sfx);
    this.env(g, t, 0.001, 0.55, 0.07);
    n.connect(this.filter('lowpass', 1600)).connect(g);
    n.start(t, rand(0, 1.5), 0.1);
    const o = this.osc('sine', 190);
    o.frequency.exponentialRampToValueAtTime(90, t + 0.08);
    const og = this.gain(0, this.sfx);
    this.env(og, t, 0.002, 0.3, 0.08);
    o.connect(og);
    o.start(t);
    o.stop(t + 0.12);
    this.sparkle();
  }

  meow() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const dur = rand(0.45, 0.7);
    const o = this.osc('sawtooth', 460);
    o.frequency.setValueAtTime(rand(420, 500), t);
    o.frequency.linearRampToValueAtTime(rand(760, 900), t + dur * 0.35);
    o.frequency.linearRampToValueAtTime(rand(380, 450), t + dur);
    const vib = this.osc('sine', 6);
    const vg = this.gain(12);
    vib.connect(vg).connect(o.frequency);
    const bp = this.filter('bandpass', 900, 3);
    bp.frequency.setValueAtTime(800, t);
    bp.frequency.linearRampToValueAtTime(1900, t + dur * 0.35);
    bp.frequency.linearRampToValueAtTime(1000, t + dur);
    const lp = this.filter('lowpass', 3200);
    const g = this.gain(0, this.sfx);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.4, t + 0.05);
    g.gain.setValueAtTime(0.4, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(bp).connect(lp).connect(g);
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.05);
    vib.stop(t + dur + 0.05);
  }

  purr(dur = 1.6) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.src(this.brown);
    const lp = this.filter('lowpass', 240);
    const amp = this.gain(0);
    const lfo = this.osc('square', 24);
    const lg = this.gain(0.5);
    lfo.connect(lg).connect(amp.gain);
    const env = this.gain(0, this.sfx);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.9, t + 0.2);
    env.gain.setValueAtTime(0.9, t + dur - 0.3);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(lp).connect(amp).connect(env);
    n.start(t, rand(0, 0.3), dur + 0.1);
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
  }

  fridgeOpen() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.osc('sine', 110);
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
    const g = this.gain(0, this.sfx);
    this.env(g, t, 0.004, 0.35, 0.14);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.2);
    const n = this.src();
    const hp = this.filter('highpass', 3000);
    const ng = this.gain(0, this.sfx);
    this.env(ng, t, 0.01, 0.08, 0.2);
    n.connect(hp).connect(ng);
    n.start(t, rand(0, 1), 0.25);
  }

  blip(f, vol) {
    const t = this.ctx.currentTime;
    const o = this.osc('sine', f);
    const g = this.gain(0, this.ambBus);
    this.env(g, t, 0.002, vol, 0.12);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.2);
  }

  // ---------- ambience ----------
  initAmbience(style) {
    const ctx = this.ctx;
    if (style === 'rain') {
      const n = this.loop(this.src(this.noise, true));
      const hp = this.filter('highpass', 900);
      const lp = this.filter('lowpass', 6500);
      n.connect(hp).connect(lp).connect(this.gain(0.045, this.ambBus));
      n.start();
      const rumble = this.loop(this.src(this.brown, true));
      rumble.connect(this.filter('lowpass', 180)).connect(this.gain(0.12, this.ambBus));
      rumble.start();
      // the fridge hums along
      [58, 116].forEach((f, i) => {
        const o = this.loop(this.osc('sine', f));
        o.connect(this.gain(i ? 0.006 : 0.014, this.ambBus));
        o.start();
      });
      const drip = () => {
        this.blip(rand(1800, 2600), 0.02);
        this.ambTimer = setTimeout(drip, rand(1500, 5000));
      };
      this.ambTimer = setTimeout(drip, 2000);
      return;
    }
    if (style === 'soft') {
      const tone = this.loop(this.src(this.brown, true));
      tone.connect(this.filter('lowpass', 350)).connect(this.gain(0.05, this.ambBus));
      tone.start();
      const rain = this.loop(this.src(this.noise, true));
      rain.connect(this.filter('highpass', 1200)).connect(this.filter('lowpass', 5000)).connect(this.gain(0.015, this.ambBus));
      rain.start();
      return;
    }
    // crowd murmur + far away glasses
    const n = this.loop(this.src(this.brown, true));
    const lp = this.filter('lowpass', 650);
    const bp = this.filter('peaking', 300, 0.8);
    bp.gain.value = 6;
    const g = this.gain(0.1, this.ambBus);
    const lfo = this.loop(ctx.createOscillator());
    lfo.frequency.value = 0.23;
    lfo.connect(this.gain(0.05)).connect(g.gain);
    n.connect(lp).connect(bp).connect(g);
    n.start();
    lfo.start();
    const farClink = () => {
      if (Math.random() < 0.7) this.clink(0.08);
      this.ambTimer = setTimeout(farClink, rand(4000, 11000));
    };
    this.ambTimer = setTimeout(farClink, 3000);
  }

  // ---------- music ----------
  startMusic(style) {
    if (style === 'lofi') this.startLofi();
    else if (style === 'romance') this.startRomance();
    else this.startDholak();
  }

  sequence(stepLen, onStep) {
    const ctx = this.ctx;
    let i = 0;
    let next = ctx.currentTime + 0.1;
    this.musicTimer = setInterval(() => {
      while (next < ctx.currentTime + 0.2) {
        onStep(i, next);
        next += stepLen;
        i++;
      }
    }, 40);
  }

  startDholak() {
    const step = 60 / 104 / 2;
    const scale = [0, 2, 3, 5, 7, 9, 10, 12, 14];
    const tonic = 293.66;
    const melody = [0, -1, 2, 3, 4, -1, 3, 2, 1, -1, 2, -1, 0, -1, -1, -1, 4, -1, 5, 4, 6, -1, 5, 4, 3, -1, 2, 3, 2, 1, 0, -1];
    const dha = [1, 0, 0, 1, 0, 0, 1, 0];
    const na = [0, 0, 1, 0, 1, 1, 0, 1];
    [tonic / 2, (tonic * 1.5) / 2].forEach((f) => {
      const o = this.loop(this.osc('sawtooth', f));
      o.connect(this.filter('lowpass', 520)).connect(this.gain(0.035, this.musicBus));
      o.start();
    });
    this.sequence(step, (i, t) => {
      const s = i % 8;
      if (dha[s]) this.drum(t, 'dha');
      if (na[s]) this.drum(t, 'na');
      const m = melody[i % melody.length];
      if (m >= 0) this.harmonium(t, tonic * Math.pow(2, scale[m] / 12), step * 1.8);
    });
  }

  // Dusty lo-fi: swung hats, soft kick/snare, jazzy electric-piano chords, vinyl crackle.
  startLofi() {
    const step = 60 / 78 / 4;
    const chords = [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]];
    this.sequence(step, (i, t0) => {
      const s = i % 16;
      const chord = chords[Math.floor(i / 16) % chords.length];
      const t = t0 + (s % 2 ? step * 0.18 : 0);
      if (s === 0 || s === 10) this.kick(t);
      if (s === 4 || s === 12) this.snare(t);
      if (s % 2 === 0 || Math.random() < 0.25) this.hat(t, s % 4 === 2 ? 0.05 : 0.028);
      if (s === 0) chord.forEach((m) => this.keys(t, midi(m), step * 15));
      if (s === 0 || s === 8) this.bass(t, midi(chord[0] - 12), step * 6);
      if (Math.random() < 0.2) this.crackle(t);
    });
  }

  // Slow and warm: pads plus a gentle arpeggio.
  startRomance() {
    const step = 60 / 66 / 2;
    const chords = [[48, 52, 55, 59], [45, 48, 52, 55], [41, 45, 48, 52], [43, 47, 50, 55]];
    const arp = [0, 1, 2, 3, 2, 1, 2, 3];
    this.sequence(step, (i, t) => {
      const s = i % 8;
      const chord = chords[Math.floor(i / 8) % chords.length];
      if (s === 0) {
        chord.forEach((m) => this.pad(t, midi(m), step * 8));
        this.bass(t, midi(chord[0] - 12), step * 7, 0.09);
      }
      this.pluck(t, midi(chord[arp[s]] + 12), step * 1.6);
    });
  }

  drum(t, kind) {
    if (kind === 'dha') {
      const o = this.osc('sine', 140);
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(58, t + 0.18);
      const g = this.gain(0, this.musicBus);
      this.env(g, t, 0.003, 0.9, 0.24);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.3);
    } else {
      const n = this.src();
      const bp = this.filter('bandpass', 2200 + Math.random() * 800, 3);
      const g = this.gain(0, this.musicBus);
      this.env(g, t, 0.001, 0.5, 0.07);
      n.connect(bp).connect(g);
      n.start(t, Math.random(), 0.1);
      const o = this.osc('sine', 420);
      const og = this.gain(0, this.musicBus);
      this.env(og, t, 0.001, 0.25, 0.06);
      o.connect(og);
      o.start(t);
      o.stop(t + 0.1);
    }
  }

  harmonium(t, f, len) {
    const lp = this.filter('lowpass', 1700);
    const g = this.gain(0, this.musicBus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.04);
    g.gain.setValueAtTime(0.07, t + len * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    lp.connect(g);
    [-5, 5].forEach((cents) => {
      const o = this.osc('sawtooth', f);
      o.detune.value = cents;
      o.connect(lp);
      o.start(t);
      o.stop(t + len + 0.05);
    });
  }

  kick(t) {
    const o = this.osc('sine', 120);
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.16);
    const g = this.gain(0, this.musicBus);
    this.env(g, t, 0.003, 0.55, 0.2);
    o.connect(g);
    o.start(t);
    o.stop(t + 0.3);
  }

  snare(t) {
    const n = this.src();
    const g = this.gain(0, this.musicBus);
    this.env(g, t, 0.002, 0.18, 0.15);
    n.connect(this.filter('bandpass', 1800, 0.8)).connect(g);
    n.start(t, Math.random(), 0.2);
  }

  hat(t, vol) {
    const n = this.src();
    const g = this.gain(0, this.musicBus);
    this.env(g, t, 0.001, vol, 0.03);
    n.connect(this.filter('highpass', 7000)).connect(g);
    n.start(t, Math.random(), 0.06);
  }

  keys(t, f, len) {
    const lp = this.filter('lowpass', 1300);
    const g = this.gain(0, this.musicBus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    lp.connect(g);
    [['triangle', 0], ['sine', 6]].forEach(([type, cents]) => {
      const o = this.osc(type, f);
      o.detune.value = cents;
      o.connect(lp);
      o.start(t);
      o.stop(t + len + 0.05);
    });
  }

  bass(t, f, len, vol = 0.12) {
    const o = this.osc('sine', f);
    const g = this.gain(0, this.musicBus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  crackle(t) {
    const n = this.src();
    const g = this.gain(0, this.musicBus);
    this.env(g, t, 0.0005, 0.05, 0.004);
    n.connect(this.filter('highpass', 2000)).connect(g);
    n.start(t, Math.random(), 0.01);
  }

  pad(t, f, len) {
    const lp = this.filter('lowpass', 1600);
    const g = this.gain(0, this.musicBus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.032, t + 0.8);
    g.gain.setValueAtTime(0.032, t + len * 0.75);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.4);
    lp.connect(g);
    [['sine', 0], ['triangle', 7]].forEach(([type, cents]) => {
      const o = this.osc(type, f);
      o.detune.value = cents;
      o.connect(lp);
      o.start(t);
      o.stop(t + len + 0.5);
    });
  }

  pluck(t, f, len) {
    const o = this.osc('sine', f);
    const g = this.gain(0, this.musicBus);
    this.env(g, t, 0.005, 0.045, len);
    o.connect(g);
    o.start(t);
    o.stop(t + len + 0.05);
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.32 : 0, this.ctx.currentTime, 0.1);
    return this.musicOn;
  }

  // ---------- characters talk (browser TTS) ----------
  speak(text, who = 'friend', drunk = 0) {
    if (!this.voiceOn || !window.speechSynthesis || who === 'cat') return;
    const clean = text.replace(/[^\p{L}\p{N}\s!?.,'-]/gu, '').trim();
    if (!clean) return;
    const u = new SpeechSynthesisUtterance(clean);
    const wantFemale = who === 'her';
    const v =
      this.voices.find((x) => x.lang === 'en-IN' && FEMALE.test(x.name) === wantFemale) ||
      (wantFemale && this.voices.find((x) => x.lang.startsWith('en') && FEMALE.test(x.name))) ||
      this.voices.find((x) => x.lang === 'en-IN') ||
      this.voices.find((x) => x.lang === 'hi-IN');
    if (v) u.voice = v;
    u.lang = v?.lang || 'en-IN';
    u.rate = who === 'waiter' ? 1.15 : who === 'her' ? 1.0 - drunk * 0.1 : 1.02 - drunk * 0.2;
    u.pitch = who === 'waiter' ? 1.35 : who === 'her' ? 1.15 : 0.75;
    // Used to ignore our own TTS if the mic hears the wake word from the speakers.
    this.speakingUntil = performance.now() + 1500 + clean.length * 90;
    u.onend = () => (this.speakingUntil = performance.now() + 600);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  get isSpeaking() {
    return performance.now() < this.speakingUntil;
  }
}
