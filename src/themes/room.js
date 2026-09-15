// Theme: your own room. Cool night vibe — a window with rain, an LED strip,
// your cat sitting on the table, and a mini fridge you pull beers straight out of.
import { W, H, TABLE_Y, BASE_Y, makeCanvas, rand, pick, clamp, lerp, smooth, dist } from '../util.js';
import { Bottle, drawHeart } from '../objects.js';
import { drawBubble } from '../characters.js';

const WIN = { x: 392, y: 92, w: 356, h: 296 };

// ------------------------------------------------------------------ scene

class RoomScene {
  constructor(rs) {
    this.bg = makeCanvas(W * rs, H * rs);
    const b = this.bg.getContext('2d');
    b.scale(rs, rs);
    paintRoom(b);

    this.tableTop = TABLE_Y - 14;
    this.table = makeCanvas(W * rs, (H - this.tableTop) * rs);
    const t = this.table.getContext('2d');
    t.scale(rs, rs);
    t.translate(0, -this.tableTop);
    paintTable(t);

    this.rain = Array.from({ length: 48 }, () => ({
      x: rand(WIN.x, WIN.x + WIN.w),
      y: rand(WIN.y, WIN.y + WIN.h),
      v: rand(420, 700),
      l: rand(12, 26),
    }));
    this.stars = Array.from({ length: 14 }, () => ({
      x: rand(WIN.x + 10, WIN.x + WIN.w - 10),
      y: rand(WIN.y + 8, WIN.y + 130),
      p: rand(0, 6),
    }));
  }

  update(dt) {
    for (const r of this.rain) {
      r.y += r.v * dt;
      r.x -= r.v * dt * 0.12;
      if (r.y > WIN.y + WIN.h) {
        r.y = WIN.y - r.l;
        r.x = rand(WIN.x, WIN.x + WIN.w + 40);
      }
    }
  }

  drawBack(ctx, t) {
    ctx.drawImage(this.bg, 0, 0, W, H);

    // window: twinkling stars + rain on the glass
    ctx.save();
    ctx.beginPath();
    ctx.rect(WIN.x, WIN.y, WIN.w, WIN.h);
    ctx.clip();
    for (const s of this.stars) {
      ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * Math.abs(Math.sin(t * 1.3 + s.p))})`;
      ctx.fillRect(s.x, s.y, 2, 2);
    }
    ctx.strokeStyle = 'rgba(190,215,255,.28)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (const r of this.rain) {
      ctx.moveTo(r.x, r.y);
      ctx.lineTo(r.x + r.l * 0.12, r.y + r.l);
    }
    ctx.stroke();
    ctx.restore();

    // LED strip along the ceiling, slowly drifting cyan <-> violet
    const hue = 200 + Math.sin(t * 0.22) * 55;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, 0, 0, 190);
    g.addColorStop(0, `hsla(${hue},95%,62%,.30)`);
    g.addColorStop(1, `hsla(${hue},95%,62%,0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, 190);
    ctx.restore();
    const lg = ctx.createLinearGradient(0, 0, W, 0);
    lg.addColorStop(0, `hsl(${hue},95%,72%)`);
    lg.addColorStop(0.5, `hsl(${hue + 55},95%,72%)`);
    lg.addColorStop(1, `hsl(${hue},95%,72%)`);
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, W, 5);
  }

  drawTable(ctx) {
    ctx.drawImage(this.table, 0, this.tableTop, W, H - this.tableTop);
  }
}

function paintRoom(c) {
  let g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#2b3558');
  g.addColorStop(0.55, '#1f2744');
  g.addColorStop(1, '#141a2e');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  for (let i = 0; i < 1400; i++) {
    c.fillStyle = `rgba(255,255,255,${rand(0.008, 0.03)})`;
    c.fillRect(rand(0, W), rand(0, H), 1.5, 1.5);
  }
  const v = c.createRadialGradient(W / 2, H * 0.45, 200, W / 2, H * 0.45, 1000);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.45)');
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
  paintWindow(c);
  paintPoster(c);
  paintPlant(c);
}

function paintWindow(c) {
  const { x, y, w, h } = WIN;
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.fillRect(x - 12, y - 8, w + 32, h + 36);
  let g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#070b1f');
  g.addColorStop(0.6, '#18244d');
  g.addColorStop(1, '#3a3f78');
  c.fillStyle = g;
  c.fillRect(x, y, w, h);

  const mx = x + w - 80;
  const my = y + 70;
  const mg = c.createRadialGradient(mx, my, 10, mx, my, 90);
  mg.addColorStop(0, 'rgba(230,235,255,.45)');
  mg.addColorStop(1, 'rgba(230,235,255,0)');
  c.fillStyle = mg;
  c.fillRect(mx - 90, my - 90, 180, 180);
  c.fillStyle = '#eef0ff';
  c.beginPath();
  c.arc(mx, my, 24, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(170,180,225,.35)';
  c.beginPath();
  c.arc(mx - 7, my - 5, 5, 0, Math.PI * 2);
  c.arc(mx + 8, my + 7, 3.5, 0, Math.PI * 2);
  c.fill();

  let bx = x;
  while (bx < x + w) {
    const bw = rand(26, 58);
    const bh = rand(50, 150);
    c.fillStyle = '#0a0e22';
    c.fillRect(bx, y + h - bh, bw, bh);
    for (let wy = y + h - bh + 10; wy < y + h - 8; wy += 14) {
      for (let wx = bx + 6; wx < bx + bw - 6; wx += 11) {
        if (Math.random() < 0.28) {
          c.fillStyle = pick(['rgba(255,214,120,.8)', 'rgba(255,190,90,.6)', 'rgba(160,210,255,.55)']);
          c.fillRect(wx, wy, 5, 7);
        }
      }
    }
    bx += bw + rand(2, 8);
  }

  c.strokeStyle = '#d9dde6';
  c.lineWidth = 14;
  c.strokeRect(x - 7, y - 7, w + 14, h + 14);
  c.fillStyle = '#d9dde6';
  c.fillRect(x + w / 2 - 5, y, 10, h);
  c.fillRect(x, y + h * 0.45 - 5, w, 10);
  c.fillStyle = '#e8ebf1';
  c.fillRect(x - 22, y + h + 6, w + 44, 14);
  c.fillStyle = 'rgba(0,0,0,.3)';
  c.fillRect(x - 22, y + h + 20, w + 44, 6);

  g = c.createLinearGradient(x - 80, 0, x + 46, 0);
  g.addColorStop(0, '#2e3a6b');
  g.addColorStop(0.5, '#43539a');
  g.addColorStop(1, '#34427c');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x - 80, y - 40);
  c.lineTo(x + 46, y - 40);
  c.quadraticCurveTo(x + 20, y + h * 0.6, x + 34, y + h + 90);
  c.lineTo(x - 80, y + h + 90);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,.18)';
  c.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    const fx = x - 60 + i * 24;
    c.beginPath();
    c.moveTo(fx, y - 40);
    c.quadraticCurveTo(fx + 10, y + h * 0.5, fx - 4, y + h + 90);
    c.stroke();
  }
  c.fillStyle = '#b9bec9';
  c.fillRect(x - 100, y - 48, w + 170, 8);
}

function paintPoster(c) {
  const x = 900;
  const y = 150;
  const w = 170;
  const h = 220;
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.fillRect(x + 8, y + 10, w, h);
  c.fillStyle = '#0d0f17';
  c.fillRect(x, y, w, h);
  const g = c.createLinearGradient(0, y + 12, 0, y + h - 12);
  g.addColorStop(0, '#ff9a6b');
  g.addColorStop(0.55, '#c85c9a');
  g.addColorStop(1, '#3b2a73');
  c.fillStyle = g;
  c.fillRect(x + 12, y + 12, w - 24, h - 24);
  c.fillStyle = '#ffe3a8';
  c.beginPath();
  c.arc(x + w / 2, y + 100, 34, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(30,20,60,.6)';
  c.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    c.beginPath();
    for (let k = 0; k <= 20; k++) {
      const px = x + 12 + (k / 20) * (w - 24);
      const py = y + 130 + i * 11 + Math.sin(k * 0.8 + i) * 4;
      if (k) c.lineTo(px, py);
      else c.moveTo(px, py);
    }
    c.stroke();
  }
  c.fillStyle = '#fff';
  c.font = '800 18px "Baloo 2", sans-serif';
  c.textAlign = 'center';
  c.fillText('STAY CHILL', x + w / 2, y + h - 22);
}

function paintPlant(c) {
  const px = 1165;
  const py = 728;
  const stemY = py - 70;
  const leaf = (x, y, len, ang, col) => {
    c.save();
    c.translate(x, y);
    c.rotate(ang);
    c.fillStyle = col;
    c.beginPath();
    c.moveTo(0, 0);
    c.quadraticCurveTo(len * 0.5, -len * 0.38, len, 0);
    c.quadraticCurveTo(len * 0.5, len * 0.38, 0, 0);
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,.2)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(len * 0.9, 0);
    c.stroke();
    c.restore();
  };
  c.strokeStyle = '#2c5a3e';
  c.lineWidth = 4;
  for (const [a, l] of [[-2.35, 120], [-1.95, 150], [-1.55, 140], [-1.2, 132], [-0.82, 118], [-2.75, 96], [-0.5, 92]]) {
    const sx = px + Math.cos(a) * l * 0.45;
    const sy = stemY + Math.sin(a) * l * 0.45;
    c.beginPath();
    c.moveTo(px, stemY);
    c.lineTo(sx, sy);
    c.stroke();
    leaf(sx, sy, l * 0.75, a, pick(['#2f7d57', '#3a9466', '#27694a']));
  }
  c.fillStyle = '#c97556';
  c.beginPath();
  c.moveTo(px - 50, py - 70);
  c.lineTo(px + 50, py - 70);
  c.lineTo(px + 40, py);
  c.lineTo(px - 40, py);
  c.closePath();
  c.fill();
  c.fillStyle = '#b3614a';
  c.fillRect(px - 54, py - 76, 108, 14);
}

function paintTable(c) {
  const top = TABLE_Y;
  let g = c.createLinearGradient(0, top - 14, 0, top + 2);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.4)');
  c.fillStyle = g;
  c.fillRect(0, top - 14, W, 16);

  c.beginPath();
  c.moveTo(-20, top);
  c.lineTo(W + 20, top);
  c.lineTo(W + 140, H + 10);
  c.lineTo(-140, H + 10);
  c.closePath();
  g = c.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, '#4a2f1d');
  g.addColorStop(0.2, '#6b4429');
  g.addColorStop(1, '#8a5a3b');
  c.fillStyle = g;
  c.fill();
  c.save();
  c.clip();
  c.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const y = top + 8 + i * 7 + rand(-2, 2);
    c.strokeStyle = `rgba(30,15,5,${rand(0.1, 0.22)})`;
    c.beginPath();
    for (let x = -40; x <= W + 40; x += 40) {
      const yy = y + Math.sin(x * 0.004 + i) * 5 + (i * x) / 9000;
      if (x === -40) c.moveTo(x, yy);
      else c.lineTo(x, yy);
    }
    c.stroke();
  }
  c.restore();
  const hg = c.createRadialGradient(820, top + 60, 20, 820, top + 60, 720);
  hg.addColorStop(0, 'rgba(180,210,255,.14)');
  hg.addColorStop(1, 'rgba(180,210,255,0)');
  c.fillStyle = hg;
  c.fillRect(0, top, W, H - top);
  c.fillStyle = '#a06d49';
  c.fillRect(-20, top, W + 40, 3);

  // coaster under the jug
  c.fillStyle = '#26324d';
  c.beginPath();
  c.ellipse(960, 850, 74, 17, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(143,231,255,.35)';
  c.lineWidth = 2;
  c.beginPath();
  c.ellipse(960, 850, 62, 13, 0, 0, Math.PI * 2);
  c.stroke();

  // bowl of chips
  const x = 470;
  const y = 858;
  c.fillStyle = 'rgba(0,0,0,.3)';
  c.beginPath();
  c.ellipse(x + 5, y + 12, 82, 20, 0, 0, Math.PI * 2);
  c.fill();
  for (let i = 0; i < 20; i++) {
    const cx = x + rand(-58, 58);
    const cy = y - rand(14, 30);
    c.fillStyle = pick(['#f0c24b', '#e6ad2e', '#f5d36b']);
    c.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      c.lineTo(cx + Math.cos(a) * rand(8, 14), cy + Math.sin(a) * rand(4, 8));
    }
    c.closePath();
    c.fill();
  }
  g = c.createLinearGradient(x - 80, 0, x + 80, 0);
  g.addColorStop(0, '#c9d2e3');
  g.addColorStop(0.5, '#f4f7fc');
  g.addColorStop(1, '#aeb9ce');
  c.fillStyle = g;
  c.beginPath();
  c.moveTo(x - 82, y - 14);
  c.quadraticCurveTo(x, y + 48, x + 82, y - 14);
  c.closePath();
  c.fill();
  c.strokeStyle = '#f6f8fc';
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(x, y - 14, 82, 14, 0, 0, Math.PI);
  c.stroke();
}

// ------------------------------------------------------------------ the cat

const FUR = '#e8923c';
const FUR_D = '#c06a22';
const FUR_L = '#f6b366';
const CREAM = '#f8e3c4';
const PINK = '#f29aa8';
const STRIPE = 'rgba(150,72,18,.55)';

export class Cat {
  constructor() {
    this.x = 262;
    this.base = 808;
    this.t = 0;
    this.blink = 0;
    this.blinkT = 3;
    this.lookX = 0;
    this.lookY = 0;
    this.lean = 0;
    this.bubble = null;
    this.talkT = 0;
    this.mouth = 0;
    this.ear = 0;
    this.earT = 2;
    this.lick = 0;
    this.lickT = rand(9, 15);
    this.purr = 0;
    this.startle = 0;
    this.sleepy = 0;
    this.hearts = [];
  }

  say(text) {
    this.bubble = { text, age: 0, dur: clamp(1.6 + text.length * 0.05, 2.2, 4.5) };
    this.talkT = 0.6;
    if (/meow|mrr|hiss/i.test(text)) this.mouth = 1;
    this.sleepy = 0;
  }

  react(key) {
    if (key === 'broke' || key === 'overflow') this.startle = 1.2;
    if (key === 'cheers' || key === 'perfect' || key === 'jarDone') this.cheers();
    if (key === 'idle') this.sleepy = 1;
  }

  cheers() {
    this.purr = 2.4;
    this.sleepy = 0;
    for (let i = 0; i < 4; i++) {
      this.hearts.push({ x: this.x + rand(-30, 40), y: this.base - 230, vx: rand(-20, 20), vy: rand(-80, -40), age: 0, life: rand(1.2, 2), s: rand(9, 15) });
    }
  }

  anticipate() {
    this.lean = 1;
    this.sleepy = 0;
  }

  // "Cheers" with a cat = booping its nose with your jug.
  get glassPos() {
    return { x: this.x + this.lean * 16, y: this.base - 158 };
  }

  update(dt, look) {
    this.t += dt;
    this.talkT = Math.max(0, this.talkT - dt);
    this.mouth = Math.max(0, this.mouth - dt * 2.5);
    if (this.bubble) {
      this.bubble.age += dt;
      if (this.bubble.age > this.bubble.dur) this.bubble = null;
    }
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.blink = 1;
      this.blinkT = rand(2.5, 6);
    }
    this.blink = Math.max(0, this.blink - dt * 5);
    this.earT -= dt;
    if (this.earT < 0) {
      this.ear = 1;
      this.earT = rand(2, 5);
    }
    this.ear = Math.max(0, this.ear - dt * 6);
    this.purr = Math.max(0, this.purr - dt);
    this.startle = Math.max(0, this.startle - dt);
    this.lean = Math.max(0, this.lean - dt * 1.5);
    this.sleepy = Math.max(0, this.sleepy - dt * 0.08);
    this.lickT -= dt;
    if (this.lickT < 0 && this.purr <= 0 && this.talkT <= 0) {
      this.lick = 2.2;
      this.lickT = rand(10, 18);
    }
    this.lick = Math.max(0, this.lick - dt);
    if (look) {
      this.lookX = smooth(this.lookX, clamp((look.x - this.x) / 300, -1, 1) * 4, 5, dt);
      this.lookY = smooth(this.lookY, clamp((look.y - (this.base - 170)) / 300, -1, 1) * 3, 5, dt);
    }
    for (const h of this.hearts) {
      h.age += dt;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
    }
    this.hearts = this.hearts.filter((h) => h.age < h.life);
  }

  drawFront(ctx) {
    const t = this.t;
    const jump = this.startle > 0.8 ? Math.sin((1.2 - this.startle) * 8) * 18 : 0;
    const puff = 1 + (this.startle > 0 ? 0.06 : 0);
    const shake = this.purr > 0 ? Math.sin(t * 60) * 0.6 : 0;
    ctx.save();
    ctx.translate(this.x, this.base - Math.abs(jump));

    ctx.fillStyle = 'rgba(0,0,0,.3)';
    ctx.beginPath();
    ctx.ellipse(0, 6, 86, 11, 0, 0, Math.PI * 2);
    ctx.fill();

    // tail
    const sw = Math.sin(t * 1.7) * 26;
    ctx.lineCap = 'round';
    ctx.strokeStyle = FUR;
    ctx.lineWidth = 22;
    ctx.beginPath();
    ctx.moveTo(50, -24);
    ctx.bezierCurveTo(125, -18, 135 + sw * 0.4, -90, 98 + sw, -142 + Math.abs(sw) * 0.3);
    ctx.stroke();
    ctx.setLineDash([9, 15]);
    ctx.strokeStyle = STRIPE;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.save();
    ctx.scale(puff, puff);
    // body
    let g = ctx.createLinearGradient(-90, 0, 90, 0);
    g.addColorStop(0, FUR_D);
    g.addColorStop(0.4, FUR_L);
    g.addColorStop(1, FUR_D);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-48, -150);
    ctx.bezierCurveTo(-96, -120, -94, -10, -62, 0);
    ctx.lineTo(62, 0);
    ctx.bezierCurveTo(94, -10, 96, -120, 48, -150);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = FUR_D;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 62, -16, 30, 18, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = STRIPE;
    ctx.lineWidth = 6;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(s * 58, -64 - i * 26, 22, s > 0 ? -0.6 : Math.PI - 0.6, s > 0 ? 0.6 : Math.PI + 0.6);
        ctx.stroke();
      }
    }
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.ellipse(0, -62, 36, 56, 0, 0, Math.PI * 2);
    ctx.fill();

    // front legs (right one licks now and then)
    const lickK = this.lick > 0 ? Math.sin(Math.min(1, (2.2 - this.lick) / 0.4) * (Math.PI / 2)) * (this.lick > 0.4 ? 1 : this.lick / 0.4) : 0;
    ctx.fillStyle = FUR;
    ctx.beginPath();
    ctx.roundRect(-32, -80, 24, 80, 12);
    ctx.fill();
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.ellipse(-20, -4, 16, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    const pawX = lerp(20, 12, lickK);
    const pawY = lerp(-4, -142, lickK);
    ctx.strokeStyle = FUR;
    ctx.lineWidth = 24;
    ctx.beginPath();
    ctx.moveTo(20, -78);
    ctx.lineTo(pawX, pawY);
    ctx.stroke();
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.ellipse(pawX, pawY, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // head
    const tilt = Math.sin(t * 0.7) * 0.05 + this.lookX * 0.01;
    ctx.save();
    ctx.translate(this.lean * 16 + shake, -176);
    ctx.rotate(tilt);
    const earFlat = this.startle > 0 ? 0.5 : 0;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * 36, -30);
      ctx.rotate(s * (earFlat + (s > 0 ? this.ear * 0.25 : 0)));
      ctx.fillStyle = FUR;
      ctx.beginPath();
      ctx.moveTo(s * -18, 8);
      ctx.lineTo(s * 4, -48);
      ctx.lineTo(s * 26, 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PINK;
      ctx.beginPath();
      ctx.moveTo(s * -8, 2);
      ctx.lineTo(s * 4, -32);
      ctx.lineTo(s * 16, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    g = ctx.createRadialGradient(-10, -12, 6, 0, 0, 70);
    g.addColorStop(0, FUR_L);
    g.addColorStop(1, FUR);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, 62, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 56, -8);
      ctx.lineTo(s * 72, 18);
      ctx.lineTo(s * 50, 26);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = STRIPE;
    ctx.lineWidth = 5;
    for (const [x1, y1, x2, y2] of [[-12, -44, -8, -28], [0, -48, 0, -30], [12, -44, 8, -28]]) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.fillStyle = CREAM;
    ctx.beginPath();
    ctx.ellipse(0, 18, 28, 19, 0, 0, Math.PI * 2);
    ctx.fill();

    const content = this.purr > 0 || this.sleepy > 0.5 || this.lick > 0.3;
    for (const s of [-1, 1]) {
      const ex = s * 24;
      const ey = -6;
      if (content || this.blink > 0.5) {
        ctx.strokeStyle = '#3a2410';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ex, ey + 4, 10, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
        continue;
      }
      const wide = this.startle > 0 ? 1.2 : 1;
      ctx.fillStyle = '#cde86a';
      ctx.beginPath();
      ctx.ellipse(ex, ey, 14 * wide, 12 * wide, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#15100a';
      ctx.beginPath();
      ctx.ellipse(ex + this.lookX, ey + this.lookY, this.startle > 0 ? 2.5 : 4.5, 10, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex + this.lookX + 4, ey - 4, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#3a2410';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 14 * wide, 12 * wide, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = PINK;
    ctx.beginPath();
    ctx.moveTo(-7, 8);
    ctx.lineTo(7, 8);
    ctx.lineTo(0, 15);
    ctx.closePath();
    ctx.fill();
    if (this.mouth > 0.1) {
      ctx.fillStyle = '#5a1d1d';
      ctx.beginPath();
      ctx.ellipse(0, 26, 8, 3 + this.mouth * 7, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PINK;
      ctx.beginPath();
      ctx.ellipse(0, 29 + this.mouth * 3, 5, 3, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#6b3a1a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, 15);
      ctx.lineTo(0, 19);
      ctx.moveTo(0, 19);
      ctx.quadraticCurveTo(-5, 25, -10, 21);
      ctx.moveTo(0, 19);
      ctx.quadraticCurveTo(5, 25, 10, 21);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.85)';
    ctx.lineWidth = 1.5;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(s * 22, 14 + i * 5);
        ctx.lineTo(s * 74, 4 + i * 11);
        ctx.stroke();
      }
    }
    ctx.restore();

    if (this.sleepy > 0.5) {
      ctx.fillStyle = 'rgba(220,235,255,.8)';
      ctx.font = '800 22px "Baloo 2", sans-serif';
      for (let i = 0; i < 3; i++) {
        const k = (t * 0.5 + i / 3) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.fillText('z', 50 + k * 40, -230 - k * 60);
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    for (const h of this.hearts) drawHeart(ctx, h.x, h.y, h.s, `rgba(255,120,160,${1 - h.age / h.life})`);
  }

  drawBubble(ctx) {
    drawBubble(ctx, this.bubble, { x: 30, y: 548, ax: this.x + 16, ay: 586, maxW: 330, bg: '#eef6ff', ink: '#1c2745' });
  }
}

// ------------------------------------------------------------------ mini fridge

function fridgeBottle(ctx, x, base, light) {
  ctx.fillStyle = `rgba(${90 + light * 40},${48 + light * 20},12,.95)`;
  ctx.beginPath();
  ctx.moveTo(x - 9, base);
  ctx.lineTo(x - 9, base - 40);
  ctx.quadraticCurveTo(x - 9, base - 52, x - 4, base - 56);
  ctx.lineTo(x - 4, base - 70);
  ctx.lineTo(x + 4, base - 70);
  ctx.lineTo(x + 4, base - 56);
  ctx.quadraticCurveTo(x + 9, base - 52, x + 9, base - 40);
  ctx.lineTo(x + 9, base);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#c8161d';
  ctx.fillRect(x - 9, base - 34, 18, 14);
  ctx.fillStyle = '#d4a017';
  ctx.fillRect(x - 5, base - 74, 10, 5);
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.fillRect(x - 6, base - 50, 2.5, 38);
}

export class Fridge {
  constructor() {
    this.x = 1440;
    this.top = 548;
    this.w = 236;
    this.h = 334;
    this.stock = 8;
    this.cap = 18;
    this.pending = 0;
    this.door = 0;
    this.light = 0;
    this.addT = 0;
    this.takeT = 0;
    this.t = 0;
  }

  get bottom() {
    return this.top + this.h;
  }

  // Distance from a hand to the fridge's grabbable front. 0 = on it.
  grabDist(px, py) {
    const L = this.x - this.w / 2;
    const R = this.x + this.w / 2 + 40;
    const T = this.top + 20;
    const B = this.bottom;
    return Math.hypot(Math.max(L - px, 0, px - R), Math.max(T - py, 0, py - B));
  }

  /** Queue bottles to be loaded in. Returns how many actually fit. */
  restock(n) {
    const add = Math.max(0, Math.min(n, this.cap - this.stock - this.pending));
    this.pending += add;
    this.addT = 0.35;
    return add;
  }

  /** Pull one ice-cold, already-opened bottle out. */
  take(game) {
    if (this.stock <= 0) return null;
    this.stock--;
    this.takeT = 1.2;
    const b = new Bottle(this.x - 30, this.top + 170);
    b.fizz = 0.7;
    game.audio.pop();
    game.stats.opened++;
    return b;
  }

  update(dt, game) {
    this.t += dt;
    const cy = this.top + this.h / 2;
    const near = game.hands.some((h) => h.present && dist(h.x, h.y, this.x, cy) < 270);
    this.takeT = Math.max(0, this.takeT - dt);
    const open = near || this.takeT > 0 || this.pending > 0;
    const was = this.door;
    this.door = smooth(this.door, open ? 1 : 0, open ? 5 : 3.5, dt);
    if (open && was < 0.08 && this.door >= 0.08) game.audio.fridgeOpen();
    this.light = smooth(this.light, this.door > 0.15 ? 1 : 0, 10, dt);
    if (this.pending > 0) {
      this.addT -= dt;
      if (this.addT <= 0) {
        this.addT = 0.11;
        this.pending--;
        this.stock++;
        game.audio.clink(0.2);
      }
    }
    if (this.door > 0.4 && Math.random() < dt * 14) {
      game.particles.add({
        kind: 'mist',
        x: this.x + rand(-80, 60),
        y: this.top + rand(90, 290),
        vx: rand(-30, 30),
        vy: rand(-40, -10),
        g: -10,
        drag: 0.6,
        life: rand(0.8, 1.6),
        size: rand(14, 28),
      });
    }
  }

  drawFront(ctx) {
    const { x, top, w, h } = this;
    const L = x - w / 2;
    const R = x + w / 2;
    const B = top + h;

    // warm lamp on top: the one cozy light in a cool room
    const lx = x - 60;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    let g = ctx.createRadialGradient(lx, top - 80, 10, lx, top - 80, 340);
    g.addColorStop(0, 'rgba(255,190,110,.30)');
    g.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = g;
    ctx.fillRect(lx - 340, top - 420, 680, 680);
    ctx.restore();
    ctx.fillStyle = '#2b2b33';
    ctx.beginPath();
    ctx.ellipse(lx, top - 4, 26, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(lx - 3, top - 72, 6, 68);
    ctx.fillStyle = '#ffd59a';
    ctx.beginPath();
    ctx.moveTo(lx - 22, top - 112);
    ctx.lineTo(lx + 22, top - 112);
    ctx.lineTo(lx + 40, top - 66);
    ctx.lineTo(lx - 40, top - 66);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.fillRect(lx - 16, top - 107, 6, 38);

    ctx.fillStyle = 'rgba(0,0,0,.35)';
    ctx.beginPath();
    ctx.ellipse(x + 10, B + 4, w * 0.62, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    g = ctx.createLinearGradient(L, 0, R, 0);
    g.addColorStop(0, '#5ea8a4');
    g.addColorStop(0.3, '#8fd6d1');
    g.addColorStop(1, '#6bb3ae');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(L, top, w, h, 24);
    ctx.fill();

    ctx.fillStyle = '#4c8f8b';
    ctx.beginPath();
    ctx.roundRect(L + 14, top + 12, w - 28, 26, 8);
    ctx.fill();
    ctx.fillStyle = '#081a1f';
    ctx.beginPath();
    ctx.roundRect(R - 78, top + 15, 58, 20, 4);
    ctx.fill();
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.stock > 0 ? '#7ff6ff' : '#ff6b6b';
    ctx.font = '700 15px ui-monospace, Menlo, monospace';
    ctx.fillText(String(this.stock).padStart(2, '0'), R - 49, top + 26);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = '800 12px "Baloo 2", sans-serif';
    ctx.fillText('❄ CHILL BOX', L + 24, top + 26);

    // interior
    const IL = L + 14;
    const IT = top + 48;
    const IW = w - 28;
    const IH = h - 64;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(IL, IT, IW, IH, 12);
    ctx.clip();
    ctx.fillStyle = '#0d1f2a';
    ctx.fillRect(IL, IT, IW, IH);
    if (this.light > 0.01) {
      g = ctx.createLinearGradient(0, IT, 0, IT + IH);
      g.addColorStop(0, `rgba(210,245,255,${0.8 * this.light})`);
      g.addColorStop(1, `rgba(110,190,230,${0.35 * this.light})`);
      ctx.fillStyle = g;
      ctx.fillRect(IL, IT, IW, IH);
    }
    const shelves = [IT + 112, IT + 214];
    const rows = [shelves[0], shelves[1], IT + IH - 6];
    let shown = Math.min(this.stock, 18);
    for (const base of rows) {
      const n = Math.min(6, shown);
      for (let i = 0; i < n; i++) fridgeBottle(ctx, IL + 22 + i * 32, base - 2, this.light);
      shown -= n;
    }
    ctx.strokeStyle = `rgba(220,245,255,${0.5 + 0.4 * this.light})`;
    ctx.lineWidth = 4;
    for (const sy of shelves) {
      ctx.beginPath();
      ctx.moveTo(IL, sy);
      ctx.lineTo(IL + IW, sy);
      ctx.stroke();
    }
    if (this.stock === 0) {
      ctx.fillStyle = `rgba(255,255,255,${0.35 + 0.4 * this.light})`;
      ctx.font = '800 20px "Baloo 2", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('EMPTY 😿', x, IT + IH / 2);
    }
    ctx.restore();

    // door, hinged on the right, swings toward you
    const a = this.door * 1.95;
    const c = Math.cos(a);
    const skew = Math.sin(a) * 22;
    const hinge = R - 6;
    const DT = top + 44;
    const DB = B - 12;
    const far = hinge - (w - 16) * c;
    ctx.beginPath();
    ctx.moveTo(hinge, DT);
    ctx.lineTo(far, DT - skew);
    ctx.lineTo(far, DB + skew);
    ctx.lineTo(hinge, DB);
    ctx.closePath();
    if (c > 0) {
      g = ctx.createLinearGradient(far, 0, hinge, 0);
      g.addColorStop(0, '#80cbc6');
      g.addColorStop(1, '#62a9a4');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.18)';
      ctx.lineWidth = 2;
      ctx.stroke();
      const hx = far + (hinge - far) * 0.1;
      ctx.fillStyle = '#e6eef2';
      ctx.beginPath();
      ctx.roundRect(hx - 5, DT + 60, 10, 110, 5);
      ctx.fill();
      if (c > 0.6) {
        ctx.font = '26px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('🐾', (far + hinge) / 2 + 24, DT + 76);
        ctx.fillText('🍺', (far + hinge) / 2 - 8, DB - 54);
      }
    } else {
      ctx.fillStyle = '#dcecee';
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.2)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(110,150,160,.8)';
      ctx.lineWidth = 3;
      for (const f of [0.32, 0.64]) {
        const y = DT + (DB - DT) * f;
        ctx.beginPath();
        ctx.moveTo(hinge, y);
        ctx.lineTo(far, y + (f < 0.5 ? -skew * 0.4 : skew * 0.4));
        ctx.stroke();
      }
    }

    if (this.light > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      g = ctx.createRadialGradient(x, top + h / 2, 20, x, top + h / 2, 270);
      g.addColorStop(0, `rgba(150,220,255,${0.22 * this.light})`);
      g.addColorStop(1, 'rgba(150,220,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 270, top - 100, 540, h + 200);
      ctx.restore();
    }
  }
}

// ------------------------------------------------------------------ theme config

export default {
  id: 'room',
  name: 'My Room',
  emoji: '🐱',
  blurb: 'Your cat, a small table & a fridge full of beer',
  title: ['MERA', 'KAMRA'],
  subtitle: 'rainy night • cat • chill box',
  tagline: 'Just you, your cat and a fridge that never judges.',
  enter: 'CHILL AT HOME 🧊',
  refillIcon: '🧊',
  refillStep: 'Fridge empty? Hit <em>RESTOCK</em> or say <em>“fridge”</em>',
  help: ['🧊 RESTOCK / “fridge” / ✋ hand up', 'Refills the mini fridge (+12 beers)'],
  createScene: (rs) => new RoomScene(rs),
  createCast: () => ({ companion: new Cat(), fridge: new Fridge() }),
  refill: 'fridge',
  slots: [600, 720, 1110, 1215],
  setup(game) {
    for (const x of [600, 720]) game.bottles.push(new Bottle(x));
  },
  introServe: false,
  voice: {
    who: 'cat',
    word: 'FRIDGE',
    wake: /(fridge|frige|bridge|restock|refill|beer|beers|bear|chilled|thandi|waiter)/i,
  },
  tutorial: [
    '✊ Grab a beer from the FRIDGE (fist on it)',
    '🍺 Hold it over the JUG and tilt to pour',
    '😮 Grab the JUG and bring it to your MOUTH',
    '🧊 Fridge empty? Hit RESTOCK (or say "FRIDGE")',
  ],
  prompt: { title: 'RESTOCK THE FRIDGE!', sub: '🧊 hit RESTOCK   •   🗣️ say "fridge"   •   ⌨️ press W' },
  callLabels: { voice: '❄️ RESTOCKED', hand: '❄️ RESTOCKED', key: '❄️ RESTOCKED', intro: '❄️ RESTOCKED' },
  refillButton: '🧊 RESTOCK',
  cheersText: 'BOOP! 🐾',
  hearts: true,
  jarText: 'JUG DONE!',
  proText: 'CAT APPROVED 😽',
  music: 'lofi',
  ambience: 'rain',
  hud: { panel: 'rgba(10,16,34,.72)', border: 'rgba(127,231,255,.5)', accent: '#8fe7ff', label: '#b9c8ee' },
  loading: ['Fridge thanda ho raha hai…', 'Billi ko uthaa rahe hain…', 'Lo-fi laga rahe hain…', 'Baarish shuru ho gayi…'],
  lines: {
    intro: ['Meow! 🐾', 'Mrrp? 👀 (fridge mein beer hai)'],
    pour: ['*stares at the bottle* 👀', '*tail swish*'],
    perfect: ['*slow blink of approval* 😽'],
    overflow: ['Mrrrow?! 😾'],
    spill: ['*sniffs the puddle* 🐾', 'Hiss! Wet table 😾'],
    drink: ['*judging you silently* 😼', '*watches you chug* 👀'],
    bottleDrink: ['Meow. (use the jug, human) 😼'],
    jarDone: ['Mrrp! 🎉', '*impressed tail swish*', 'prrrr ❤️'],
    cheers: ['*boop* 😽', 'prrrr ❤️'],
    empty: ['Meow! Fridge khaali hai 🧊', '*paws at the fridge* 🐾'],
    callWaiter: ['Mrrp! Treats bhi laana 🐟', '*happy meow*'],
    broke: ['*zooms away* 💨', 'HISS! 😾'],
    idle: ['Meooow? 🥱', '*yawns* 😴'],
    tipsy: ['*concerned meow* 😿', 'Mrrp? You okay, human?'],
  },
};
