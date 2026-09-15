// Game brain: turns hand/face tracking into grabbing, pouring, chugging, cheers,
// spills and broken bottles. Everything world-specific — the room, who's with you,
// how beer gets refilled, what they say — comes from the active theme.
import { W, H, BASE_Y, clamp, lerp, rand, pick, dist, smooth, angleWrap, rotate, OneEuro, easeOutBack, easeInOut } from './util.js';
import { Bottle, Mug, Particles } from './objects.js';
import { getTheme, DEFAULT_THEME } from './themes/index.js';
import { track } from './analytics.js';

const MUG_HOME = 960;
const BOTTLE_L = 0.65; // litres in a bottle; the jar holds 1.0 L

const HAND_LINKS = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17],
];

const STAGES = ['Sober 😇', 'Suroor 🙂', 'Tipsy 😊', 'Talli 🤪', 'Full Talli 🥴', 'Tunn 💫', 'Out of Syllabus 🌀'];

const LINE_CD = { pour: 14, drink: 14, bottleDrink: 20, spill: 8, overflow: 8, idle: 25, six: 25, four: 25, out: 25, tipsy: 20 };

function makeHand(source) {
  return {
    source,
    present: false,
    missing: false,
    lost: 0,
    init: false,
    x: 0,
    y: 0,
    rx: 0,
    ry: 0,
    fx: new OneEuro(),
    fy: new OneEuro(),
    vx: 0,
    vy: 0,
    closed: false,
    wasClosed: false,
    closedT: 0,
    ratio: 2,
    pinch: 1,
    roll: 0,
    rollPrev: null,
    held: null,
    hover: null,
    hoverSource: null,
    pts: null,
    raiseT: 0,
    raiseCd: 0,
  };
}

export class Game {
  constructor(audio, rs, themeId = DEFAULT_THEME) {
    this.audio = audio;
    this.rs = rs;
    this.t = 0;
    this.hands = [makeHand('cam'), makeHand('cam'), makeHand('mouse')];
    this.face = { present: false, x: 960, y: 380, top: 250, h: 220, open: false };
    this.opts = { skeleton: true, assist: true };
    this.ui = { mic: 'off', heard: '', heardT: -99, camera: false, debug: false, fps: 0 };
    this.personOpaque = false;
    this.started = false;
    this.setTheme(themeId);
  }

  /** Swap worlds. Rebuilds the scene + cast and starts a fresh round. */
  setTheme(id) {
    this.theme = getTheme(id);
    this.scene = this.theme.createScene(this.rs);
    this.scene.onEvent = (e) => {
      if (this.started) this.friendSay(e === 'SIX!' ? 'six' : e === 'OUT!' ? 'out' : 'four');
    };
    this.reset();
  }

  reset() {
    for (const h of this.hands) {
      h.held = null;
      h.hover = null;
      h.hoverSource = null;
      h.wasClosed = false; // otherwise a fist held across a reset can't grab again
      h.closedT = 0;
    }
    const cast = this.theme.createCast(this);
    this.friend = cast.companion; // always there: Bunty, the cat, her
    this.waiter = cast.server || null; // brings bottles (may be the companion herself)
    this.fridge = cast.fridge || null;
    this.actors = [...new Set([this.friend, this.waiter, this.fridge].filter(Boolean))];

    this.particles = new Particles();
    this.bottles = [];
    this.mug = new Mug(MUG_HOME);
    this.puddles = [];
    this.popups = [];
    this.timers = [];
    this.reserved = [];
    this.stats = { jars: 0, drunkL: 0, spilledL: 0, opened: 0 };
    this.drunk = 0;
    this.fxDrunk = 0;
    this.shake = 0;
    this.flash = 0;
    this.hurt = 0;
    this.cool = {};
    this.lastAction = this.t;
    this.job = null;
    this.tut = 0;
    this.tutFlash = 0;
    this.emptyT = 0;
    this.outOfBeer = false;
    this.stage = 0;
    this.drinkHold = 0;
    this.jarPop = 0;
    this.noHandsT = 0;
    this.introPending = false;
    this.theme.setup?.(this);
    if (this.started) {
      this.started = false;
      this.start();
    }
  }

  start() {
    if (this.started) return;
    this.started = true;
    this.lastAction = this.t;
    this.later(0.8, () => this.friendSay('intro', true));
    if (this.theme.introServe) {
      // the first round is on the house — don't nag "out of beer" before it arrives
      this.introPending = true;
      this.later(this.theme.introServeDelay ?? 2, () => {
        this.introPending = false;
        this.callWaiter('intro');
      });
    }
  }

  later(s, fn) {
    this.timers.push({ at: this.t + s, fn });
  }

  // ------------------------------------------------------------------ input

  setCameraHands(raw) {
    const slots = [this.hands[0], this.hands[1]];
    const usedRaw = new Set();
    const usedSlot = new Set();
    const pairs = [];
    raw.forEach((r, i) =>
      slots.forEach((s, j) => {
        if (s.present) pairs.push({ i, j, d: dist(r.x, r.y, s.rx, s.ry) });
      }),
    );
    pairs.sort((a, b) => a.d - b.d);
    // Nearest-first pairing. Second pass drops the distance cap so a fast
    // two-handed move can't swap the hands (and the objects they hold).
    for (const cap of [280, Infinity]) {
      for (const p of pairs) {
        if (usedRaw.has(p.i) || usedSlot.has(p.j) || p.d > cap) continue;
        usedRaw.add(p.i);
        usedSlot.add(p.j);
        this.applyRaw(slots[p.j], raw[p.i]);
      }
    }
    raw.forEach((r, i) => {
      if (usedRaw.has(i)) return;
      let j = slots.findIndex((s, k) => !usedSlot.has(k) && !s.present);
      if (j < 0) j = slots.findIndex((s, k) => !usedSlot.has(k));
      if (j < 0) return;
      usedSlot.add(j);
      const s = slots[j];
      if (!s.present) {
        s.fx.reset();
        s.fy.reset();
        s.init = false;
        s.rollPrev = null;
      }
      this.applyRaw(s, r);
    });
    slots.forEach((s, j) => {
      if (!usedSlot.has(j)) s.missing = true;
    });
  }

  applyRaw(s, r) {
    s.rx = r.x;
    s.ry = r.y;
    s.ratio = r.ratio;
    s.pinch = r.pinch;
    s.pts = r.pts;
    s.roll = s.rollPrev == null ? r.roll : s.roll + angleWrap(r.roll - s.rollPrev);
    s.rollPrev = r.roll;
    s.present = true;
    s.missing = false;
    s.lost = 0;
  }

  setMouse(m) {
    const h = this.hands[2];
    h.present = m.active;
    h.rx = m.x;
    h.ry = m.y;
    h.mouseDown = m.down;
    h.roll = m.roll;
  }

  setFace(f) {
    if (f.present) Object.assign(this.face, f);
    else this.face.present = false;
  }

  get mouth() {
    return this.face.present ? this.face : { x: 960, y: 380 };
  }

  get drinkRadius() {
    return this.face.present ? clamp(this.face.h * 0.6, 100, 230) : 150;
  }

  // ------------------------------------------------------------------ update

  update(dt) {
    this.t += dt;
    const t = this.t;
    for (let i = this.timers.length - 1; i >= 0; i--) {
      if (t >= this.timers[i].at) this.timers.splice(i, 1)[0].fn();
    }
    this.scene.update(dt, t);
    this.updateHands(dt);

    const all = [...this.bottles, this.mug];
    for (const o of all) {
      if (o.state === 'held') this.updateHeld(o, dt);
      else this.updateFree(o, dt);
      o.wave = Math.max(0, o.wave - dt * 3);
      o.hover = smooth(o.hover, this.hands.some((h) => h.hover === o) ? 1 : 0, 10, dt);
    }
    this.separate();

    let pouring = 0;
    for (const b of this.bottles) pouring += this.updateBottlePour(b, dt);
    this.updateMug(dt);
    this.audio.setPour(pouring);

    this.particles.update(dt);
    this.collide();
    this.updateJob(dt);
    const heldHand = this.hands.find((h) => h.held);
    const look = heldHand ? heldHand.held : this.hands.find((h) => h.present) || this.mug;
    for (const a of this.actors) {
      if (a === this.friend) a.update(dt, look, this.drunk);
      else a.update(dt, this);
    }
    this.updateRules(dt);

    for (const p of this.puddles) p.a -= dt * 0.025;
    this.puddles = this.puddles.filter((p) => p.a > 0);
    for (const p of this.popups) p.age += dt;
    this.popups = this.popups.filter((p) => p.age < p.dur);
    this.bottles = this.bottles.filter((b) => b.state !== 'gone');
    for (const h of this.hands) if (h.hover?.state === 'gone') h.hover = null;
    // Pulling beers from a fridge all night: quietly clear the oldest empties.
    if (this.bottles.length > 7) {
      const empty = this.bottles.find((b) => b.state === 'table' && !b.capped && b.level < 0.02);
      if (empty) empty.state = 'gone';
    }

    this.drinkHold = Math.max(0, this.drinkHold - dt);
    this.shake = Math.max(0, this.shake - dt * 2.5);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.hurt = Math.max(0, this.hurt - dt * 1.5);
    this.tutFlash = Math.max(0, this.tutFlash - dt * 1.5);
    this.jarPop = Math.max(0, this.jarPop - dt * 2);
    this.drunk = Math.max(0, this.drunk - dt * 0.0035);
    this.fxDrunk = smooth(this.fxDrunk, clamp((this.drunk - 0.12) * 1.15, 0, 1.25), 1.5, dt);
    const camHands = this.hands[0].present || this.hands[1].present;
    this.noHandsT = this.ui.camera && !camHands ? this.noHandsT + dt : 0;
  }

  updateHands(dt) {
    for (const h of this.hands) {
      if (h.source === 'cam') {
        if (h.present && h.missing) {
          h.lost += dt;
          if (h.lost > 0.35) {
            h.present = false;
            h.pts = null;
            h.rollPrev = null;
            this.release(h, true);
          }
        }
        if (!h.present) {
          h.hover = null;
          h.hoverSource = null;
          h.raiseT = 0;
          h.wasClosed = false;
          continue;
        }
        const nx = h.fx.filter(h.rx, dt);
        const ny = h.fy.filter(h.ry, dt);
        if (!h.init) {
          h.x = nx;
          h.y = ny;
          h.vx = 0;
          h.vy = 0;
          h.init = true;
        }
        h.vx = smooth(h.vx, (nx - h.x) / dt, 10, dt);
        h.vy = smooth(h.vy, (ny - h.y) / dt, 10, dt);
        h.x = nx;
        h.y = ny;
        // fist (fingertips curled toward the wrist) or pinch; hysteresis avoids flicker
        const fist = h.closed ? h.ratio < 1.62 : h.ratio < 1.4;
        const pinch = h.closed ? h.pinch < 0.055 : h.pinch < 0.03;
        h.closed = fist || pinch;
      } else {
        if (!h.present) {
          if (h.held) this.release(h, true);
          h.hover = null;
          h.hoverSource = null;
          h.wasClosed = false;
          continue;
        }
        h.vx = smooth(h.vx, (h.rx - h.x) / dt, 10, dt);
        h.vy = smooth(h.vy, (h.ry - h.y) / dt, 10, dt);
        h.x = h.rx;
        h.y = h.ry;
        h.closed = h.mouseDown;
      }
      h.closedT = h.closed ? h.closedT + dt : 0;
      if (!this.started) continue;

      // Grab on the moment the fist closes, and also keep grabbing while it stays
      // closed — so closing your hand a little early still picks the bottle up.
      if (h.closed && !h.held && (!h.wasClosed || h.closedT > 0.3)) this.tryGrab(h);
      if (!h.closed && h.held) this.release(h, false);
      h.wasClosed = h.closed;
      h.hover = h.held ? null : this.findGrabbable(h.x, h.y);
      h.hoverSource = h.held || h.hover ? null : this.findSource(h.x, h.y);

      if (h.source === 'cam') {
        h.raiseCd = Math.max(0, h.raiseCd - dt);
        const limit = this.face.present ? this.face.top - 30 : 230;
        if (!h.closed && !h.held && h.y < limit && !this.job && h.raiseCd <= 0) {
          h.raiseT += dt;
          if (h.raiseT > 1.3) {
            h.raiseT = 0;
            h.raiseCd = 4;
            this.callWaiter('hand');
          }
        } else h.raiseT = Math.max(0, h.raiseT - dt * 2);
      }
    }
  }

  findGrabbable(x, y) {
    let best = null;
    let bd = 60;
    for (const o of [...this.bottles, this.mug]) {
      if ((o.state !== 'table' && o.state !== 'falling') || o.locked) continue;
      const d = o.grabDist(x, y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }

  // Things you can pull a fresh bottle out of (the mini fridge).
  findSource(x, y) {
    return this.fridge && this.fridge.grabDist(x, y) < 20 ? this.fridge : null;
  }

  tryGrab(h) {
    let o = this.findGrabbable(h.x, h.y);
    if (!o) {
      const source = this.findSource(h.x, h.y);
      if (!source) return;
      o = source.take(this);
      if (!o) {
        if (this.t > (this.cool.emptySource || 0)) {
          this.cool.emptySource = this.t + 2.5;
          this.popup('FRIDGE KHAALI! 🧊', source.x, source.top - 40, { size: 44, color: '#bfefff' });
          this.friendSay('empty', true);
        }
        return;
      }
      o.x = h.x;
      o.y = h.y;
      this.bottles.push(o);
      if (this.t > (this.cool.chilled || 0)) {
        this.cool.chilled = this.t + 6;
        this.popup('THANDI! ❄️', source.x - 40, source.top + 20, { size: 40, color: '#bfefff', dur: 0.9 });
      }
    }
    o.state = 'held';
    o.holder = h;
    h.held = o;
    o.grabRoll = h.roll;
    o.grabAngle = o.angle;
    const [lx, ly] = rotate(h.x - o.x, h.y - o.y, -o.angle);
    o.gripX = clamp(lx, -o.w, o.w);
    o.gripY = clamp(ly, -o.h / 2 + 20, o.h / 2 - 20);
    this.audio.clink(0.12);
    this.lastAction = this.t;
    if (o.kind === 'bottle') {
      this.tutDone(0);
      if (o.level < 0.05) this.popup('KHAALI! 🫙', o.x, o.y - 160, { size: 38, color: '#fff' });
    }
  }

  release(h, lost) {
    const o = h.held;
    if (!o) return;
    h.held = null;
    o.holder = null;
    o.state = 'falling';
    o.vx = lost ? 0 : clamp(h.vx, -2200, 2200);
    o.vy = lost ? 0 : clamp(h.vy, -2200, 2200);
  }

  updateHeld(o, dt) {
    const h = o.holder;
    let target = clamp(o.grabAngle + angleWrap(h.roll - o.grabRoll) * (h.source === 'cam' ? 1.3 : 1), -2.9, 2.9);

    if (o.kind === 'bottle' && this.opts.assist && !o.capped && o.level > 0) {
      // Pour assist: hover over the jar and the bottle tips itself.
      const [rx, ry] = this.mug.rim;
      const inZone = Math.abs(h.x - rx) < 200 && h.y < ry - 30 && h.y > ry - 400;
      if (inZone && o.assist < 0.05) o.assistSide = h.x <= rx ? 1 : -1;
      o.assist = smooth(o.assist, inZone ? 1 : 0, inZone ? 2.5 : 6, dt);
      const want = (o.assistSide || 1) * 2.1;
      if (Math.abs(target) < Math.abs(want)) target = lerp(target, want, o.assist);
    }
    if (o.kind === 'mug') {
      // Drink assist: jar tips toward your mouth when it gets close.
      const m = this.mouth;
      const [rx, ry] = o.rim;
      const near = dist(rx, ry, m.x, m.y) < this.drinkRadius * 1.5;
      if (near && o.assist < 0.05) o.drinkSide = m.x < o.x - 10 ? -1 : 1;
      o.assist = smooth(o.assist, near ? 1 : 0, near ? 4 : 6, dt);
      if (o.assist > 0.01) {
        const want = (o.drinkSide || -1) * (0.45 + (1 - o.level) * 1.45);
        target = lerp(target, want, o.assist * 0.92);
      }
    }

    o.angle = smooth(o.angle, target, 12, dt);
    const [gx, gy] = rotate(o.gripX, o.gripY, o.angle);
    o.gripX = smooth(o.gripX, 0, 5, dt);
    const nx = clamp(h.x - gx, 30, W - 30);
    const ny = Math.min(h.y - gy, BASE_Y + 4 - o.halfExtent);
    o.wave = clamp(o.wave + (Math.abs(nx - o.x) + Math.abs(ny - o.y)) * 0.01, 0, 6);
    o.x = nx;
    o.y = ny;
  }

  updateFree(o, dt) {
    if (o.state === 'falling') {
      o.vy += 2600 * dt;
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.vx *= Math.exp(-1.2 * dt);
      o.angle = smooth(o.angle, 0, 4, dt);
      if (o.x < 40) {
        o.x = 40;
        o.vx = Math.abs(o.vx) * 0.4;
      }
      if (o.x > W - 40) {
        o.x = W - 40;
        o.vx = -Math.abs(o.vx) * 0.4;
      }
      const floor = BASE_Y - o.halfExtent;
      if (o.y >= floor) {
        const impact = o.vy;
        o.y = floor;
        if (o.kind === 'bottle' && impact > 1700) {
          this.breakBottle(o);
          return;
        }
        if (impact > 380) {
          o.vy = -impact * 0.25;
          o.vx *= 0.6;
          o.wave = 5;
          this.audio.thud();
          if (o.kind === 'mug' && o.level > 0.2 && impact > 900) this.sloshMug();
        } else {
          o.vy = 0;
          o.vx = 0;
          o.state = 'table';
        }
      }
    } else if (o.state === 'table') {
      o.angle = smooth(o.angle, 0, 10, dt);
      o.y = BASE_Y - o.halfExtent;
    }
  }

  // Keep things on the table from overlapping.
  separate() {
    const objs = [...this.bottles, this.mug].filter((o) => o.state === 'table').sort((a, b) => a.x - b.x);
    for (let i = 0; i < objs.length - 1; i++) {
      const a = objs[i];
      const b = objs[i + 1];
      const min = (a.w + b.w) / 2 + (a.kind === 'mug' || b.kind === 'mug' ? 34 : 6);
      const overlap = min - (b.x - a.x);
      if (overlap > 0) {
        a.x -= overlap * 0.1;
        b.x += overlap * 0.1;
      }
    }
    for (const o of objs) o.x = clamp(o.x, 40, W - 40);
  }

  updateBottlePour(b, dt) {
    if (b.fizz > 0) {
      b.fizz -= dt;
      if (Math.random() < 0.6) {
        const [mx, my] = b.mouth;
        this.particles.add({ kind: 'foam', x: mx + rand(-5, 5), y: my, vx: rand(-40, 40), vy: rand(-220, -80), g: 500, life: 0.6, size: rand(3, 6) });
      }
    }
    if (b.capped || b.level <= 0 || b.state === 'carried') {
      b.pouring = false;
      return 0;
    }
    const depth = b.pourDepth();
    if (depth <= 0) {
      b.pouring = false;
      return 0;
    }
    const flow = 0.08 + 0.3 * clamp(depth / 45, 0, 1); // L/s
    const amt = Math.min(flow * dt, b.level * BOTTLE_L);
    b.level = Math.max(0, b.level - amt / BOTTLE_L);
    if (b.level < 0.002) b.level = 0;
    const [mx, my] = b.mouth;
    const m = this.mouth;
    if (b.state === 'held') {
      this.lastAction = this.t;
      // straight from the bottle, Patiala style
      if (dist(mx, my, m.x, m.y) < this.drinkRadius * 0.45) {
        this.consume(amt, 'bottle');
        b.pouring = false;
        return flow * 0.3;
      }
    }
    if (!b.pouring) {
      b.pouring = true;
      b.stream = ++this.particles.stream;
      if (b.state === 'held') this.friendSay('pour');
    }
    const [ux, uy] = rotate(0, -1, b.angle);
    const [rx, ry] = this.mug.rim;
    for (let i = 0; i < 2; i++) {
      let vx = ux * 150 + rand(-8, 8);
      const vy = uy * 150 + rand(-8, 8);
      if (b.assist > 0.2 && my < ry) {
        // aim-assist: bend the stream so it lands in the jar
        const g = 1900;
        const tf = (-vy + Math.sqrt(Math.max(0, vy * vy + 2 * g * (ry - my)))) / g;
        if (tf > 0.01) vx = lerp(vx, clamp((rx - mx) / tf, -800, 800), clamp(b.assist, 0, 1) * 0.9);
      }
      this.particles.add({ kind: 'beer', x: mx + ux * 4, y: my + uy * 4, vx, vy, life: 3, amt: amt / 2, stream: b.stream, src: b });
    }
    return flow;
  }

  updateMug(dt) {
    const mug = this.mug;
    mug.foam = Math.max(0, mug.foam - dt * 0.018);
    if (mug.level < 0.08) {
      mug.perfectShown = false;
      mug.overflowed = false;
    }
    const m = this.mouth;
    const [rimX, rimY] = mug.rim;
    const nearMouth = mug.state === 'held' && dist(rimX, rimY, m.x, m.y) < this.drinkRadius;
    const info = mug.pourInfo();
    if (info.depth > 0 && (mug.level > 0.0005 || (nearMouth && mug.foam > 0.01))) {
      const flow = 0.12 + 0.5 * clamp(info.depth / 40, 0, 1);
      if (nearMouth) {
        const amt = Math.min(flow * dt * (this.face.open ? 1.35 : 1), mug.level);
        mug.level -= amt;
        mug.foam = Math.max(0, mug.foam - flow * dt * 0.9);
        mug.session += amt;
        this.consume(amt, 'mug');
        mug.pouring = false;
      } else {
        const amt = Math.min(flow * dt, mug.level);
        mug.level -= amt;
        if (!mug.pouring) {
          mug.pouring = true;
          mug.stream = ++this.particles.stream;
        }
        const [ux, uy] = rotate(0, -1, mug.angle);
        this.particles.add({ kind: 'beer', x: info.x, y: info.y, vx: ux * 120 + rand(-10, 10), vy: uy * 120, life: 3, amt, stream: mug.stream, src: mug });
      }
    } else mug.pouring = false;
    if (mug.level < 0.0005) mug.level = 0;

    if (!mug.perfectShown && !mug.overflowed && mug.level >= 0.85 && mug.foam > 0.04 && mug.foam < 0.4) {
      mug.perfectShown = true;
      this.popup('PERFECT POUR ✨', mug.x, mug.y - 170, { size: 54, color: '#9cff6b', dur: 1.5 });
      this.confetti(mug.x, mug.y - 120, 30);
      this.later(0.3, () => this.friendSay('perfect', true));
    }
    if (mug.session > 0.3 && mug.level < 0.03 && this.drinkHold <= 0) this.jarDone();

    if (mug.state === 'held') {
      const g = this.friend.glassPos; // null while she's away fetching beer
      if (g) {
        if (mug.x < 720) this.friend.anticipate?.();
        if (dist(mug.x, mug.y, g.x, g.y) < 150 && this.t > (this.cool.cheers || 0)) this.doCheers(g);
      }
    }
  }

  consume(amt, src) {
    if (amt <= 0) return;
    this.stats.drunkL += amt;
    this.drunk = Math.min(1.3, this.drunk + amt * 0.24);
    this.drinkHold = 0.35;
    this.lastAction = this.t;
    const m = this.mouth;
    if (this.t > (this.cool.gulp || 0)) {
      this.cool.gulp = this.t + rand(0.32, 0.42);
      this.audio.gulp();
      if (Math.random() < 0.5) {
        this.popup(pick(['GLUG!', 'GULP!', 'GLUG GLUG']), m.x + rand(-160, 160), m.y + rand(-60, 30), {
          size: rand(30, 42),
          color: '#ffe27a',
          dur: 0.8,
          rise: 50,
          rot: rand(-0.3, 0.3),
        });
      }
      if (Math.random() < 0.25 + this.drunk * 0.3) {
        this.particles.add({ kind: 'drop', x: m.x + rand(-30, 30), y: m.y + 10, vx: rand(-30, 30), vy: rand(0, 60), g: 900, life: 1.2, size: rand(2.5, 4.5) });
      }
    }
    this.friendSay(src === 'bottle' ? 'bottleDrink' : 'drink');
    if (this.stats.drunkL > 0.2) this.tutDone(2);
  }

  collide() {
    const mug = this.mug;
    const [rx, ry] = mug.rim;
    const hw = Math.abs(Math.cos(mug.angle)) * 50;
    const upright = Math.cos(mug.angle) > 0.3;
    const m = this.mouth;
    for (const p of this.particles.list) {
      if (p.kind !== 'beer' || p.dead) continue;
      if (p.src !== mug && upright && p.py <= ry && p.y > ry && Math.abs(p.x - rx) < hw) {
        p.dead = true;
        const over = mug.receive(p.amt, p.vy);
        if (mug.level > 0.3) this.tutDone(1);
        if (Math.random() < 0.3) {
          this.particles.add({ kind: 'bubble', x: p.x + rand(-20, 20), y: ry + rand(-4, 10), vx: rand(-40, 40), vy: rand(-120, -40), g: -50, life: 0.5, size: rand(2, 4) });
        }
        if (over > 0) this.overflow(over);
        continue;
      }
      if (p.vy > 0 && dist(p.x, p.y, m.x, m.y) < 40) {
        p.dead = true;
        this.consume(p.amt, 'bottle');
        continue;
      }
      if (p.y > BASE_Y - 4 && p.vy > 0) {
        p.dead = true;
        this.spill(p.x, p.amt);
      }
    }
  }

  spill(x, amt) {
    this.stats.spilledL += amt;
    let pd = this.puddles.find((p) => Math.abs(p.x - x) < 40);
    if (!pd) {
      pd = { x, r: 8, a: 0.45 };
      this.puddles.push(pd);
      if (this.puddles.length > 24) this.puddles.shift();
    }
    pd.r = Math.min(95, pd.r + amt * 900);
    pd.a = Math.min(0.55, pd.a + 0.04);
    if (Math.random() < 0.35) {
      this.particles.add({ kind: 'drop', x, y: BASE_Y - 4, vx: rand(-120, 120), vy: rand(-260, -80), life: 0.5, size: rand(2, 3.5) });
    }
    if (this.t > (this.cool.spillPop || 0)) {
      this.cool.spillPop = this.t + 3;
      this.popup('WASTED! 😱', x, BASE_Y - 130, { size: 44, color: '#ff6b6b' });
      this.friendSay('spill');
    }
  }

  overflow(over) {
    const mug = this.mug;
    this.stats.spilledL += over;
    mug.overflowed = true;
    const [rx, ry] = mug.rim;
    for (let i = 0; i < 2; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      this.particles.add({ kind: 'foam', x: rx + side * rand(45, 62), y: ry + rand(0, 10), vx: side * rand(10, 40), vy: rand(-20, 40), g: 700, life: 1.4, size: rand(4, 8), floor: BASE_Y });
    }
    if (this.t > (this.cool.overPop || 0)) {
      this.cool.overPop = this.t + 2.5;
      this.popup('OVERFLOW!', rx, ry - 90, { size: 46, color: '#fff' });
      this.friendSay('overflow');
    }
  }

  sloshMug() {
    const mug = this.mug;
    const lost = mug.level * 0.12;
    mug.level -= lost;
    this.stats.spilledL += lost;
    const [rx, ry] = mug.rim;
    for (let i = 0; i < 12; i++) {
      this.particles.add({ kind: 'drop', x: rx + rand(-50, 50), y: ry, vx: rand(-200, 200), vy: rand(-400, -100), life: 0.9, size: rand(2.5, 4.5) });
    }
  }

  doCheers(g) {
    this.cool.cheers = this.t + 3;
    const mug = this.mug;
    const cx = (mug.x + g.x) / 2;
    const cy = (mug.y + g.y) / 2 - 40;
    this.friend.cheers();
    if (this.theme.hearts) {
      this.audio.clink(this.theme.voice.who === 'cat' ? 0.3 : 1);
      this.audio.sparkle();
      for (let i = 0; i < 16; i++) {
        this.particles.add({
          kind: 'heart',
          x: cx + rand(-30, 30),
          y: cy,
          vx: rand(-260, 260),
          vy: rand(-420, -140),
          g: 260,
          drag: 1.2,
          life: rand(0.9, 1.5),
          size: rand(9, 17),
          color: pick(['rgba(255,95,162,A)', 'rgba(255,143,192,A)', 'rgba(255,208,228,A)']),
        });
      }
    } else {
      this.audio.clink(1);
      for (let i = 0; i < 28; i++) {
        const a = rand(0, Math.PI * 2);
        const s = rand(200, 700);
        this.particles.add({ kind: 'spark', x: cx, y: cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, g: 400, life: rand(0.3, 0.7), size: rand(0, 5) });
      }
    }
    for (let i = 0; i < 8; i++) {
      this.particles.add({ kind: 'foam', x: cx, y: cy, vx: rand(-200, 200), vy: rand(-400, -100), g: 1200, life: 0.9, size: rand(3, 6) });
    }
    this.popup(this.theme.cheersText, cx + 80, cy - 70, { size: 72, color: this.theme.hud.accent, dur: 1.4 });
    this.shake = 0.35;
    this.flash = 0.6;
    mug.wave = 6;
    this.lastAction = this.t;
    this.friendSay('cheers', true);
  }

  confetti(x, y, n) {
    const colors = ['#ffd23f', '#ff4d6d', '#43ff7a', '#40b8ff', '#ff9933', '#ffffff'];
    for (let i = 0; i < n; i++) {
      this.particles.add({
        kind: 'confetti',
        x: x + rand(-40, 40),
        y,
        vx: rand(-520, 520),
        vy: rand(-800, -250),
        g: 900,
        drag: 1.2,
        life: rand(1.4, 2.4),
        rot: rand(0, 6),
        vr: rand(-12, 12),
        color: pick(colors),
      });
    }
  }

  jarDone() {
    this.mug.session = 0;
    this.stats.jars++;
    this.jarPop = 1;
    this.popup(`${this.theme.jarText} 🍺×${this.stats.jars}`, W / 2, 300, { size: 84, color: this.theme.hud.accent, dur: 1.8, rise: 40 });
    this.flash = 0.8;
    this.shake = 0.3;
    this.confetti(W / 2, 260, 70);
    this.later(0.6, () => {
      this.audio.burp();
      const m = this.mouth;
      this.popup('BURRRP!', m.x + 90, m.y - 40, { size: 64, color: '#9cff6b', rot: -0.15, dur: 1.2 });
      this.shake = 0.5;
    });
    this.later(1.5, () => this.friendSay('jarDone', true));
    this.tutDone(2);
    track('jar_finished', { jars: this.stats.jars, litres: +this.stats.drunkL.toFixed(2), theme: this.theme.id });
  }

  breakBottle(o) {
    o.state = 'gone';
    const spilled = o.level;
    o.level = 0; // stop it pouring for the rest of this frame
    this.audio.crash();
    this.shake = 0.7;
    this.hurt = 0.8;
    for (let i = 0; i < 22; i++) {
      this.particles.add({
        kind: 'shard',
        x: o.x + rand(-20, 20),
        y: BASE_Y - rand(10, 80),
        vx: rand(-600, 600),
        vy: rand(-900, -200),
        g: 2200,
        life: 1.6,
        size: rand(5, 13),
        rot: rand(0, 6),
        vr: rand(-15, 15),
        color: pick(['rgba(90,45,10,.9)', 'rgba(140,80,20,.85)', 'rgba(255,255,255,.6)']),
        floor: BASE_Y + rand(0, 30),
      });
    }
    if (spilled > 0) {
      const amt = spilled * BOTTLE_L;
      this.stats.spilledL += amt;
      for (let i = 0; i < 18; i++) {
        this.particles.add({ kind: 'drop', x: o.x, y: BASE_Y - 10, vx: rand(-400, 400), vy: rand(-600, -100), life: 0.9, size: rand(2.5, 5) });
      }
      this.puddles.push({ x: o.x, r: 40 + amt * 80, a: 0.6 });
    }
    this.popup('CRASH! 💥', o.x, BASE_Y - 220, { size: 70, color: '#ff4d4d' });
    this.friendSay('broke', true);
  }

  // ------------------------------------------------------------------ refills

  /** Voice / raised hand / button / W key. What happens depends on the world. */
  callWaiter(src) {
    if (!this.started) return false;
    const th = this.theme;
    if (th.refill === 'fridge') return this.restockFridge(src);

    if (this.job) {
      if (src !== 'intro' && this.t > (this.cool.busy || 0)) {
        this.cool.busy = this.t + 4;
        this.friendSay('waiterBusy', true);
      }
      return false;
    }
    const serve = th.refill === 'serve';
    const empties = this.bottles.filter((b) => b.state === 'table' && !b.capped && b.level < 0.06);
    const keep = this.bottles.filter((b) => !empties.includes(b)).length;
    const need = Math.max(0, th.slots.length - keep);
    if (serve && need === 0 && empties.length === 0) {
      this.waiterSay('full');
      return false;
    }
    if (src !== 'intro') {
      this.audio.ding();
      this.popup(th.callLabels[src] || th.callLabels.key, W / 2, 330, { size: 84, color: th.hud.accent, dur: 1.5 });
      this.shake = 0.4;
      this.tutDone(3);
      track('waiter_called', { source: src, theme: th.id }); // voice | hand | key
      this.later(0.2, () => this.friendSay('callWaiter', true));
    }
    const w = this.waiter;
    w.trayEmpty = 0;
    w.handTarget = null;
    if (serve) {
      // she gets up, heads off to the kitchen, comes back with a tray
      w.leaveSeat();
      w.walkTo(W + 160);
      w.trayNew = 0;
    } else {
      if (!w.visible) w.x = W + 150;
      w.walkTo(1440);
      w.trayNew = need;
    }
    const steps = [...empties.map((b) => ({ type: 'collect', b })), ...Array.from({ length: need }, () => ({ type: 'place' }))];
    if (need > 0) steps.push({ type: 'openAll' });
    if (serve) steps.push({ type: 'pour' });
    steps.push({ type: 'bye', quiet: need === 0 && empties.length === 0 });
    this.job = { steps, i: 0, phase: serve ? 'fetch' : 'enter', need };
    this.later(src === 'intro' ? 0.4 : 1.1, () => this.waiterSay(need > 0 || empties.length ? 'hi' : 'full'));
    return true;
  }

  restockFridge(src) {
    const f = this.fridge;
    if (!f || f.pending > 0) return false;
    const added = f.restock(12);
    if (added <= 0) {
      if (this.t > (this.cool.full || 0)) {
        this.cool.full = this.t + 3;
        this.popup('FRIDGE FULL ❄️', f.x, f.top - 60, { size: 48, color: '#bfefff' });
      }
      return false;
    }
    this.audio.fridgeOpen();
    this.popup(`${this.theme.callLabels[src] || this.theme.callLabels.key} +${added}`, W / 2, 330, { size: 72, color: this.theme.hud.accent, dur: 1.5 });
    this.tutDone(3);
    track('waiter_called', { source: src, theme: this.theme.id });
    this.later(0.3, () => this.friendSay('callWaiter', true));
    return true;
  }

  freeSlot() {
    const slots = this.theme.slots;
    const taken = (x) =>
      this.reserved.some((r) => Math.abs(r - x) < 55) ||
      this.bottles.some((b) => b.state !== 'held' && Math.abs(b.x - x) < 55) ||
      Math.abs(this.mug.x - x) < 110;
    for (const x of slots) if (!taken(x)) return x;
    for (let x = 600; x < 1400; x += 30) if (!taken(x)) return x;
    return slots[0];
  }

  updateJob(dt) {
    const j = this.job;
    if (!j) return;
    const w = this.waiter;
    const serve = this.theme.refill === 'serve';
    if (j.phase === 'fetch') {
      if (w.arrived) {
        w.trayNew = j.need;
        w.walkTo(1440);
        j.phase = 'enter';
      }
      return;
    }
    if (j.phase === 'enter') {
      if (w.arrived) j.phase = 'work';
      return;
    }
    if (j.phase === 'leave') {
      if (w.arrived) {
        this.job = null;
        w.trayEmpty = 0;
        w.trayNew = 0;
        if (serve) w.sit();
      }
      return;
    }
    const s = j.steps[j.i];
    const next = () => {
      j.i++;
      w.opener = false;
    };
    if (!s) {
      j.phase = 'leave';
      w.handTarget = null;
      w.opener = false;
      w.walkTo(serve ? w.seatX : W + 170);
      return;
    }
    const reach = (x) => w.walkTo(clamp(x + 150, 640, 1440));
    if (!s.started) {
      s.started = true;
      s.t = 0;
      w.handTarget = null;
      w.opener = false;
      if (s.type === 'collect') {
        if (s.b.state !== 'table') return next();
        s.b.locked = true;
        reach(s.b.x);
      } else if (s.type === 'place') {
        s.slot = this.freeSlot();
        this.reserved.push(s.slot);
        reach(s.slot);
      } else if (s.type === 'openAll') {
        const caps = this.bottles.filter((b) => b.capped);
        j.steps.splice(j.i + 1, 0, ...caps.map((b) => ({ type: 'open', b })));
        return next();
      } else if (s.type === 'open') {
        if (!s.b.capped || s.b.state === 'gone') return next();
        reach(s.b.x);
      } else if (s.type === 'pour') {
        const mug = this.mug;
        const b = this.bottles.find((x) => x.state === 'table' && !x.capped && !x.locked && x.level > 0.6);
        if (!b || mug.state !== 'table' || mug.level > 0.35) return next();
        s.b = b;
        s.home = b.x;
        s.from = [b.x, b.y];
        b.state = 'served';
        b.locked = true;
        w.walkTo(clamp(mug.x + 240, 640, 1440));
        this.waiterSay('pour');
      } else if (s.type === 'bye') {
        w.handTarget = null;
        if (!s.quiet) this.waiterSay('bye');
      }
    }
    if (!s.arrived) {
      if (!w.arrived) return;
      s.arrived = true;
    }
    s.t += dt;

    switch (s.type) {
      case 'collect': {
        const b = s.b;
        if (b.state === 'held' || b.state === 'gone') {
          b.locked = false;
          return next();
        }
        if (s.t > 0.3) {
          if (!s.from) s.from = [b.x, b.y];
          b.state = 'carried';
          const k = clamp((s.t - 0.3) / 0.35, 0, 1);
          b.x = lerp(s.from[0], w.x + 150, easeInOut(k));
          b.y = lerp(s.from[1], 560, easeInOut(k));
          b.angle = lerp(0, 1.3, k);
          if (k >= 1) {
            b.state = 'gone';
            w.trayEmpty++;
            this.audio.clink(0.3);
            next();
          }
        }
        w.handTarget = { x: b.x + 16, y: b.y - 30 };
        break;
      }
      case 'place': {
        if (!s.b) {
          s.from = [w.x + 110, 540];
          s.b = new Bottle(s.from[0], s.from[1], { capped: true });
          s.b.state = 'carried';
          s.b.locked = true;
          this.bottles.push(s.b);
          w.trayNew = Math.max(0, w.trayNew - 1);
        }
        const k = clamp(s.t / 0.5, 0, 1);
        const e = easeInOut(k);
        s.b.x = lerp(s.from[0], s.slot, e);
        s.b.y = lerp(s.from[1], s.b.restY, e) - Math.sin(k * Math.PI) * 90;
        w.handTarget = { x: s.b.x + 18, y: s.b.y - 20 };
        if (k >= 1) {
          s.b.state = 'table';
          s.b.y = s.b.restY;
          this.reserved = this.reserved.filter((r) => r !== s.slot);
          this.audio.thud();
          next();
        }
        break;
      }
      case 'open': {
        const b = s.b;
        if (b.state === 'gone') return next();
        const [cx, cy] = b.mouth;
        w.opener = true;
        w.handTarget = { x: cx + 14, y: cy + 10 };
        if (s.t > 0.4 && b.capped) {
          b.capped = false;
          b.locked = false;
          b.fizz = 1.1;
          this.stats.opened++;
          this.audio.pop();
          this.shake = Math.max(this.shake, 0.18);
          this.particles.add({ kind: 'cap', x: cx, y: cy - 6, vx: rand(-260, 260), vy: rand(-900, -650), g: 2400, life: 2.2, vr: rand(-25, 25), floor: BASE_Y + 10 });
          for (let i = 0; i < 14; i++) {
            this.particles.add({ kind: 'foam', x: cx, y: cy, vx: rand(-90, 90), vy: rand(-380, -120), g: 900, life: 0.8, size: rand(3, 7) });
          }
          this.popup('PSSHH!', cx, cy - 70, { size: 38, color: '#fff', dur: 0.8 });
        }
        if (s.t > 0.65) next();
        break;
      }
      case 'pour': {
        // she lifts a bottle over your jar and pours it for you
        const b = s.b;
        const mug = this.mug;
        if (b.state !== 'served' || mug.state !== 'table') {
          if (b.state === 'served') {
            b.state = 'falling';
            b.locked = false;
          }
          return next();
        }
        const [rx, ry] = mug.rim;
        const px = rx + 58;
        const py = ry - 150;
        if (!s.phase) s.phase = 'lift';
        if (s.phase === 'lift') {
          const k = clamp(s.t / 0.5, 0, 1);
          const e = easeInOut(k);
          b.x = lerp(s.from[0], px, e);
          b.y = lerp(s.from[1], py, e) - Math.sin(k * Math.PI) * 40;
          b.angle = lerp(0, -0.6, e);
          if (k >= 1) {
            s.phase = 'pour';
            s.pt = 0;
          }
        } else if (s.phase === 'pour') {
          s.pt += dt;
          b.x = px;
          b.y = py;
          b.angle = smooth(b.angle, -2.35, 4, dt);
          b.assist = 1;
          if (mug.level >= 0.82 || b.level <= 0.02 || s.pt > 4.5) {
            s.phase = 'back';
            s.bt = 0;
            s.bf = [b.x, b.y, b.angle];
            b.assist = 0;
          }
        } else {
          s.bt += dt;
          const k = clamp(s.bt / 0.55, 0, 1);
          const e = easeInOut(k);
          b.angle = lerp(s.bf[2], 0, e);
          b.x = lerp(s.bf[0], s.home, e);
          b.y = lerp(s.bf[1], b.restY, e) - Math.sin(k * Math.PI) * 30;
          if (k >= 1) {
            b.state = 'table';
            b.locked = false;
            b.y = b.restY;
            next();
          }
        }
        w.handTarget = { x: b.x + 12, y: b.y };
        break;
      }
      case 'bye':
        if (s.t > 1.2) {
          if ('glassLevel' in this.friend) this.friend.glassLevel = 0.9;
          next();
        }
        break;
    }
  }

  // ------------------------------------------------------------------ rules & talk

  updateRules(dt) {
    if (!this.started) return;
    const t = this.t;
    let left = this.bottles.reduce((s, b) => s + (b.capped ? 1 : b.level), 0);
    if (this.fridge) left += this.fridge.stock + this.fridge.pending;
    this.outOfBeer = left < 0.03 && this.mug.level < 0.03 && !this.job && !this.introPending;
    if (this.outOfBeer) {
      this.emptyT += dt;
      if (this.emptyT > 1.2 && t > (this.cool.empty || 0)) {
        this.cool.empty = t + 15;
        this.friendSay('empty', true);
      }
    } else this.emptyT = 0;

    const stage = Math.min(STAGES.length - 1, Math.floor(this.drunk / 0.2));
    if (stage > this.stage) {
      this.stage = stage;
      this.popup(STAGES[stage], W / 2, 200, { size: 60, color: '#ff9cf0', dur: 1.8 });
      if (stage >= 2) this.later(2.2, () => this.friendSay('tipsy', true));
    } else if (this.drunk < this.stage * 0.2 - 0.05) this.stage = stage;

    if (t - this.lastAction > 22 && !this.job && !this.outOfBeer) {
      this.lastAction = t;
      this.friendSay('idle');
    }
  }

  tutDone(step) {
    const steps = this.theme.tutorial;
    if (this.tut !== step) return;
    this.tut++;
    this.tutFlash = 1;
    track('tutorial_step', { step: this.tut, of: steps.length, theme: this.theme.id }); // shows where people drop off
    if (this.tut >= steps.length) {
      this.later(1.5, () => this.popup(this.theme.proText, W / 2, 180, { size: 58, color: '#9cff6b', dur: 2 }));
    }
  }

  friendSay(key, force = false) {
    const lines = this.theme.lines[key];
    if (!lines) return;
    const t = this.t;
    if (!force && (this.friend.talkT > 0 || t < (this.cool.anyLine || 0) || t < (this.cool['l_' + key] || 0))) return;
    this.cool['l_' + key] = t + (LINE_CD[key] ?? 8);
    this.cool.anyLine = t + 3;
    const text = pick(lines);
    this.friend.say(text);
    this.friend.react?.(key);
    const who = this.theme.voice.who;
    if (who === 'cat') {
      if (/prr/i.test(text)) this.audio.purr();
      else if (/meow|mrr|hiss/i.test(text)) this.audio.meow();
    } else this.audio.speak(text, who, this.drunk);
  }

  waiterSay(key) {
    const lines = this.theme.serverLines?.[key];
    if (!lines || !this.waiter) return;
    const text = pick(lines);
    this.waiter.say(text);
    this.audio.speak(text, this.theme.voice.serverWho || 'waiter');
  }

  popup(text, x, y, o = {}) {
    this.popups.push({ text, x: clamp(x, 140, W - 140), y: clamp(y, 70, H - 60), age: 0, size: 56, color: '#ffd23f', dur: 1.1, rise: 60, rot: 0, ...o });
  }

  // ------------------------------------------------------------------ render

  // Actors opt into layers: drawBack (behind you), drawMid (in front of you, behind
  // the table), drawFront (on the table), drawTop (over the bottles), drawBubble.
  layer(ctx, name, t) {
    for (const a of this.actors) a[name]?.(ctx, t);
  }

  render(ctx, drawPerson) {
    const t = this.t;
    ctx.save();
    const sh = this.shake * 16;
    if (sh > 0.1) ctx.translate(rand(-sh, sh), rand(-sh, sh));
    const d = this.fxDrunk;
    if (d > 0.02) {
      ctx.translate(W / 2, H / 2);
      ctx.rotate(Math.sin(t * 0.55) * 0.014 * d);
      const s = 1 + 0.035 * d;
      ctx.scale(s, s);
      ctx.translate(-W / 2, -H / 2);
    }

    this.scene.drawBack(ctx, t);
    if (!this.personOpaque) this.layer(ctx, 'drawBack', t);
    drawPerson(ctx);
    if (this.personOpaque) this.layer(ctx, 'drawBack', t);
    this.layer(ctx, 'drawMid', t);
    this.scene.drawTable(ctx);
    this.scene.drawTableTop?.(ctx, t);

    for (const p of this.puddles) {
      ctx.fillStyle = `rgba(230,150,30,${p.a})`;
      ctx.beginPath();
      ctx.ellipse(p.x, BASE_Y + 8, p.r, p.r * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,240,200,${p.a * 0.5})`;
      ctx.beginPath();
      ctx.ellipse(p.x - p.r * 0.3, BASE_Y + 5, p.r * 0.3, p.r * 0.05, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    this.layer(ctx, 'drawFront', t);
    const objs = [...this.bottles, this.mug];
    for (const o of objs) {
      if (o.state === 'held') continue;
      if (o.state === 'table') {
        ctx.fillStyle = 'rgba(0,0,0,.3)';
        ctx.beginPath();
        ctx.ellipse(o.x + 6, BASE_Y + 3, o.w * 0.62, 8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      o.draw(ctx, t);
    }
    this.particles.draw(ctx);
    for (const o of objs) if (o.state === 'held') o.draw(ctx, t);
    this.layer(ctx, 'drawTop', t);
    this.drawHands(ctx);
    this.layer(ctx, 'drawBubble', t);
    this.drawPopups(ctx);
    ctx.restore();
    this.drawHUD(ctx);
  }

  drawHands(ctx) {
    const t = this.t;
    for (const h of this.hands) {
      if (!h.present || !this.started) continue;
      const hovering = h.hover || h.hoverSource;
      const col = h.held ? '255,190,60' : hovering ? '120,255,160' : '120,220,255';
      if (h.pts && this.opts.skeleton) {
        ctx.save();
        ctx.globalAlpha = h.held ? 0.35 : 0.7;
        ctx.strokeStyle = `rgb(${col})`;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (const [a, b] of HAND_LINKS) {
          ctx.moveTo(h.pts[a].x, h.pts[a].y);
          ctx.lineTo(h.pts[b].x, h.pts[b].y);
        }
        ctx.stroke();
        ctx.fillStyle = '#fff';
        for (const p of h.pts) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      ctx.save();
      ctx.translate(h.x, h.y);
      const r = h.closed ? 22 : 32 + Math.sin(t * 6) * 2;
      ctx.strokeStyle = `rgba(${col},.95)`;
      ctx.lineWidth = h.closed ? 6 : 3;
      ctx.setLineDash(h.closed ? [] : [8, 7]);
      ctx.lineDashOffset = -t * 30;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.textAlign = 'center';
      if (hovering && !h.held) {
        const label = h.hoverSource
          ? h.hoverSource.stock > 0
            ? h.source === 'mouse'
              ? 'CLICK FOR A BEER'
              : '✊ GRAB A BEER'
            : 'EMPTY 🧊'
          : h.source === 'mouse'
            ? 'CLICK TO GRAB'
            : '✊ GRAB';
        ctx.font = '800 18px "Baloo 2", sans-serif';
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,.7)';
        ctx.strokeText(label, 0, -46);
        ctx.fillStyle = '#fff';
        ctx.fillText(label, 0, -46);
      }
      if (h.raiseT > 0.05) {
        ctx.strokeStyle = this.theme.hud.accent;
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(0, 0, 48, -Math.PI / 2, -Math.PI / 2 + (h.raiseT / 1.3) * Math.PI * 2);
        ctx.stroke();
        ctx.font = '30px Bangers, Impact, sans-serif';
        ctx.fillStyle = this.theme.hud.accent;
        ctx.fillText(`${this.theme.voice.word}…`, 0, -64);
      }
      if (this.ui.debug && h.source === 'cam') {
        ctx.font = '600 14px monospace';
        ctx.fillStyle = '#0f0';
        ctx.fillText(`fist ${h.ratio.toFixed(2)} pinch ${(h.pinch * 100).toFixed(1)}cm`, 0, 58);
      }
      ctx.restore();
    }
  }

  drawPopups(ctx) {
    for (const p of this.popups) {
      const k = p.age / p.dur;
      const s = p.age < 0.22 ? easeOutBack(p.age / 0.22) : 1;
      ctx.save();
      ctx.globalAlpha = clamp(k > 0.7 ? (1 - k) / 0.3 : 1, 0, 1);
      ctx.translate(p.x, p.y - p.rise * Math.sqrt(k));
      ctx.rotate(p.rot);
      ctx.scale(s, s);
      ctx.font = `${p.size}px Bangers, Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.lineWidth = p.size * 0.16;
      ctx.strokeStyle = '#1e0d14';
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      ctx.restore();
    }
  }

  drawHUD(ctx) {
    if (!this.started) return;
    const t = this.t;
    const hud = this.theme.hud;
    const tutorial = this.theme.tutorial;
    ctx.save();
    ctx.fillStyle = hud.panel;
    ctx.strokeStyle = hud.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(16, 16, 316, 178, 18);
    ctx.fill();
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const label = (txt, x, y) => {
      ctx.fillStyle = hud.label;
      ctx.font = '800 14px "Baloo 2", sans-serif';
      ctx.fillText(txt, x, y);
    };
    label('JARS DOWN', 34, 42);
    label('PIYA (DRUNK)', 184, 42);
    ctx.save();
    ctx.translate(34, 102);
    const js = 1 + this.jarPop * 0.45;
    ctx.scale(js, js);
    ctx.font = '60px Bangers, Impact, sans-serif';
    ctx.fillStyle = hud.accent;
    ctx.fillText(`🍺${this.stats.jars}`, 0, 0);
    ctx.restore();
    ctx.font = '34px Bangers, Impact, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(`${this.stats.drunkL.toFixed(2)} L`, 184, 80);
    ctx.font = '700 15px "Baloo 2", sans-serif';
    ctx.fillStyle = '#ff9a9a';
    ctx.fillText(`giraya ${this.stats.spilledL.toFixed(2)} L`, 184, 104);

    const stage = STAGES[Math.min(STAGES.length - 1, Math.floor(this.drunk / 0.2))];
    label('TALLI METER', 34, 140);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff9cf0';
    ctx.font = '800 16px "Baloo 2", sans-serif';
    ctx.fillText(stage, 314, 140);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath();
    ctx.roundRect(34, 152, 280, 22, 11);
    ctx.fill();
    const fw = 280 * clamp(this.drunk / 1.3, 0, 1);
    if (fw > 2) {
      const g = ctx.createLinearGradient(34, 0, 314, 0);
      g.addColorStop(0, '#3ddc84');
      g.addColorStop(0.5, '#ffd23f');
      g.addColorStop(1, '#ff4d4d');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.roundRect(34, 152, Math.max(22, fw), 22, 11);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      for (let i = 0; i < 5; i++) {
        const bx = 34 + ((t * 40 + i * 57) % Math.max(10, fw - 8));
        ctx.beginPath();
        ctx.arc(bx + 4, 163 + Math.sin(t * 3 + i) * 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (this.tut < tutorial.length) {
      const text = tutorial[this.tut];
      ctx.font = '800 25px "Baloo 2", sans-serif';
      const w = ctx.measureText(text).width + 150;
      const s = 1 + this.tutFlash * 0.12;
      ctx.save();
      ctx.translate(W / 2 + 70, 46); // top strip, so it never covers your face
      ctx.scale(s, s);
      ctx.fillStyle = hud.panel;
      ctx.strokeStyle = hud.border;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -27, w, 54, 27);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = hud.accent;
      ctx.beginPath();
      ctx.roundRect(-w / 2 + 8, -19, 104, 38, 19);
      ctx.fill();
      ctx.fillStyle = '#1b0f14';
      ctx.font = '800 17px "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`STEP ${this.tut + 1}/${tutorial.length}`, -w / 2 + 60, 1);
      ctx.fillStyle = '#fff';
      ctx.font = '800 25px "Baloo 2", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(text, -w / 2 + 128, 2);
      ctx.restore();
    }

    if (this.outOfBeer && this.emptyT > 0.8) {
      const { title, sub } = this.theme.prompt;
      const p = 1 + Math.sin(t * 6) * 0.05;
      ctx.save();
      ctx.translate(W / 2, 470);
      ctx.rotate(Math.sin(t * 2) * 0.03);
      ctx.scale(p, p);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round';
      ctx.font = '96px Bangers, Impact, sans-serif';
      ctx.lineWidth = 16;
      ctx.strokeStyle = '#1e0d14';
      ctx.strokeText(title, 0, 0);
      ctx.fillStyle = hud.accent;
      ctx.fillText(title, 0, 0);
      ctx.font = '800 28px "Baloo 2", sans-serif';
      ctx.lineWidth = 7;
      ctx.strokeText(sub, 0, 64);
      ctx.fillStyle = '#fff';
      ctx.fillText(sub, 0, 64);
      ctx.restore();
    }

    const word = this.theme.voice.word;
    const mic = this.ui.mic;
    const micText =
      mic === 'listening'
        ? `🎤 Listening… say "${word}"`
        : mic === 'denied'
          ? '🎤 Mic blocked — press W'
          : mic === 'unsupported'
            ? '🎤 Voice needs Chrome/Edge — press W'
            : '🎤 Voice starting… (or press W)';
    ctx.font = '700 18px "Baloo 2", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const mw = ctx.measureText(micText).width + 44;
    ctx.fillStyle = hud.panel;
    ctx.beginPath();
    ctx.roundRect(16, H - 58, mw, 42, 21);
    ctx.fill();
    ctx.fillStyle = mic === 'listening' ? `rgba(255,70,70,${0.5 + 0.5 * Math.sin(t * 5)})` : '#777';
    ctx.beginPath();
    ctx.arc(34, H - 37, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(micText, 48, H - 36);
    if (this.ui.heard && t - this.ui.heardT < 2.5) {
      ctx.globalAlpha = clamp(2.5 - (t - this.ui.heardT), 0, 1);
      const txt = `“${this.ui.heard.slice(-48)}”`;
      ctx.font = 'italic 700 17px "Baloo 2", sans-serif';
      const hw = ctx.measureText(txt).width + 28;
      ctx.fillStyle = 'rgba(255,255,255,.9)';
      ctx.beginPath();
      ctx.roundRect(16, H - 104, hw, 36, 18);
      ctx.fill();
      ctx.fillStyle = '#1b0f05';
      ctx.fillText(txt, 30, H - 85);
      ctx.globalAlpha = 1;
    }

    if (this.noHandsT > 3) {
      ctx.save();
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 4);
      ctx.textAlign = 'center';
      ctx.font = '800 30px "Baloo 2", sans-serif';
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(0,0,0,.8)';
      ctx.strokeText('👐 Show your hands to the camera', W / 2 + 60, 660);
      ctx.fillStyle = '#fff';
      ctx.fillText('👐 Show your hands to the camera', W / 2 + 60, 660);
      ctx.restore();
    }
    if (this.ui.debug) {
      ctx.textAlign = 'right';
      ctx.font = '700 16px monospace';
      ctx.fillStyle = '#0f0';
      ctx.fillText(`${this.ui.fps} fps  drunk ${this.drunk.toFixed(2)}`, W - 20, 140);
    }
    ctx.restore();
  }
}
