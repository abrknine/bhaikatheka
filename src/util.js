// Shared math + drawing helpers. The whole game is laid out in a fixed
// 1600x900 "virtual" space and scaled to the screen at the end.
export const W = 1600;
export const H = 900;
export const TABLE_Y = 728; // back edge of the table top
export const BASE_Y = 846; // where things rest on the table

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
// Frame-rate independent exponential smoothing.
export const smooth = (cur, target, rate, dt) => lerp(cur, target, 1 - Math.exp(-rate * dt));

export function angleWrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export const easeOutBack = (t) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export function rotate(x, y, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return [x * c - y * s, x * s + y * c];
}

export function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return dist(px, py, ax + dx * t, ay + dy * t);
}

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
}

// Two-bone IK: returns elbow + hand points for an arm reaching a target.
export function solveIK(sx, sy, tx, ty, l1, l2, bend = 1) {
  const d = clamp(dist(sx, sy, tx, ty), 1, l1 + l2 - 0.5);
  const base = Math.atan2(ty - sy, tx - sx);
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
  const a1 = base + bend * Math.acos(cosA);
  const ex = sx + Math.cos(a1) * l1;
  const ey = sy + Math.sin(a1) * l1;
  return { ex, ey, hx: sx + Math.cos(base) * d, hy: sy + Math.sin(base) * d };
}

export function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// One Euro filter: kills tracking jitter when the hand is still, stays snappy when it moves.
class LowPass {
  constructor() {
    this.y = null;
  }
  f(x, a) {
    this.y = this.y == null ? x : a * x + (1 - a) * this.y;
    return this.y;
  }
}
export class OneEuro {
  constructor(minCutoff = 1.4, beta = 0.015, dCutoff = 1.2) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.reset();
  }
  reset() {
    this.x = new LowPass();
    this.dx = new LowPass();
  }
  alpha(cutoff, dt) {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }
  filter(v, dt) {
    if (this.x.y == null) {
      this.dx.f(0, 1);
      return this.x.f(v, 1);
    }
    const edx = this.dx.f((v - this.x.y) / dt, this.alpha(this.dCutoff, dt));
    return this.x.f(v, this.alpha(this.minCutoff + this.beta * Math.abs(edx), dt));
  }
}
