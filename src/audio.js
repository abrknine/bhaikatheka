// Every sound in the game is synthesized live with the Web Audio API —
// no audio files. Pour, glug, clink, cap pop, fizz, burp, dholak loop, crowd murmur.
import { rand, pick } from './util.js';

export class Audio {
  constructor() {
    this.ctx = null;
    this.musicOn = true;
    this.voiceOn = true;
    this.speakingUntil = 0;
    this.voices = [];
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
    this.initAmbience();
    this.startMusic();

    if (window.speechSynthesis) {
      const load = () => (this.voices = speechSynthesis.getVoices());
      load();
      speechSynthesis.onvoiceschanged = load;
    }
  }

  gain(v, dest) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    if (dest) g.connect(dest);
    return g;
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
    const ctx = this.ctx;
    const n = this.src(this.noise, true);
    const bp = this.filter('bandpass', 1100, 1.4);
    const lp = this.filter('lowpass', 2800);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 9;
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
    const o = this.ctx.createOscillator();
    o.type = 'sine';
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
      const o = this.ctx.createOscillator();
      o.frequency.value = f * rand(0.98, 1.02);
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
    const o = this.ctx.createOscillator();
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
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(rand(95, 115), t);
    o.frequency.linearRampToValueAtTime(rand(62, 75), t + dur);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = rand(22, 32);
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
    const o = this.ctx.createOscillator();
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
      const o = this.ctx.createOscillator();
      const st = t + Math.random() * 0.25;
      o.frequency.value = rand(2500, 7000);
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
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = this.gain(0, this.sfx);
      this.env(g, t + d, 0.005, 0.35, 0.6);
      o.connect(g);
      o.start(t + d);
      o.stop(t + d + 0.8);
    });
  }

  whoosh() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this.src();
    const bp = this.filter('bandpass', 300, 1.5);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.3);
    const g = this.gain(0, this.sfx);
    this.env(g, t, 0.08, 0.3, 0.25);
    n.connect(bp).connect(g);
    n.start(t, rand(0, 1), 0.4);
  }

  // ---------- ambience: crowd murmur + far away glasses ----------
  initAmbience() {
    const n = this.src(this.brown, true);
    const lp = this.filter('lowpass', 650);
    const bp = this.filter('peaking', 300, 0.8);
    bp.gain.value = 6;
    const g = this.gain(0.1, this.ambBus);
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.23;
    const lg = this.gain(0.05);
    lfo.connect(lg).connect(g.gain);
    n.connect(lp).connect(bp).connect(g);
    n.start();
    lfo.start();
    const farClink = () => {
      if (Math.random() < 0.7) this.clink(0.08);
      this.ambTimer = setTimeout(farClink, rand(4000, 11000));
    };
    this.ambTimer = setTimeout(farClink, 3000);
  }

  // ---------- tiny dholak + harmonium sequencer ----------
  startMusic() {
    const ctx = this.ctx;
    const bpm = 104;
    const step = 60 / bpm / 2;
    // D kafi-ish scale
    const scale = [0, 2, 3, 5, 7, 9, 10, 12, 14];
    const tonic = 293.66;
    const melody = [0, -1, 2, 3, 4, -1, 3, 2, 1, -1, 2, -1, 0, -1, -1, -1, 4, -1, 5, 4, 6, -1, 5, 4, 3, -1, 2, 3, 2, 1, 0, -1];
    const dha = [1, 0, 0, 1, 0, 0, 1, 0];
    const na = [0, 0, 1, 0, 1, 1, 0, 1];
    let i = 0;
    let next = ctx.currentTime + 0.1;

    // tanpura-ish drone
    [tonic / 2, (tonic * 1.5) / 2].forEach((f) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const lp = this.filter('lowpass', 520);
      const g = this.gain(0.035, this.musicBus);
      o.connect(lp).connect(g);
      o.start();
    });

    const tick = () => {
      while (next < ctx.currentTime + 0.15) {
        const s = i % 8;
        if (dha[s]) this.drum(next, 'dha');
        if (na[s]) this.drum(next, 'na');
        const m = melody[i % melody.length];
        if (m >= 0) this.harmonium(next, tonic * Math.pow(2, scale[m] / 12), step * 1.8);
        next += step;
        i++;
      }
    };
    this.musicTimer = setInterval(tick, 40);
  }

  drum(t, kind) {
    const ctx = this.ctx;
    if (kind === 'dha') {
      const o = ctx.createOscillator();
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
      const o = ctx.createOscillator();
      o.frequency.value = 420;
      const og = this.gain(0, this.musicBus);
      this.env(og, t, 0.001, 0.25, 0.06);
      o.connect(og);
      o.start(t);
      o.stop(t + 0.1);
    }
  }

  harmonium(t, f, len) {
    const ctx = this.ctx;
    const lp = this.filter('lowpass', 1700);
    const g = this.gain(0, this.musicBus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.04);
    g.gain.setValueAtTime(0.07, t + len * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    lp.connect(g);
    [-5, 5].forEach((cents) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = cents;
      o.connect(lp);
      o.start(t);
      o.stop(t + len + 0.05);
    });
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.32 : 0, this.ctx.currentTime, 0.1);
    return this.musicOn;
  }

  // ---------- characters talk (browser TTS) ----------
  speak(text, who = 'friend', drunk = 0) {
    if (!this.voiceOn || !window.speechSynthesis) return;
    const clean = text.replace(/[^\p{L}\p{N}\s!?.,'-]/gu, '').trim();
    if (!clean) return;
    const u = new SpeechSynthesisUtterance(clean);
    const v =
      this.voices.find((x) => x.lang === 'en-IN' && (who === 'waiter') === /veena|female|neerja/i.test(x.name)) ||
      this.voices.find((x) => x.lang === 'en-IN') ||
      this.voices.find((x) => x.lang === 'hi-IN');
    if (v) u.voice = v;
    u.lang = v?.lang || 'en-IN';
    u.rate = who === 'waiter' ? 1.15 : 1.02 - drunk * 0.2;
    u.pitch = who === 'waiter' ? 1.35 : 0.75;
    // Used to ignore our own TTS if the mic hears the word "waiter" from the speakers.
    this.speakingUntil = performance.now() + 1500 + clean.length * 90;
    u.onend = () => (this.speakingUntil = performance.now() + 600);
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  get isSpeaking() {
    return performance.now() < this.speakingUntil;
  }

  randomGulpPitch() {
    return pick([0.9, 1, 1.1]);
  }
}
