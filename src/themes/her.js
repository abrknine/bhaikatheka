// Theme: her place. Warm fairy lights, a candle on the table, and your girlfriend —
// she fetches the beer, opens it, pours your first jar and talks sweetly the whole time.
import { W, H, TABLE_Y, BASE_Y, makeCanvas, rand, pick, clamp, lerp, smooth, solveIK } from '../util.js';
import { drawHeart } from '../objects.js';
import { drawBubble } from '../characters.js';

const WIN = { x: 900, y: 96, w: 320, h: 290 };

// ------------------------------------------------------------------ scene

class HerScene {
  constructor(rs) {
    this.bg = makeCanvas(W * rs, H * rs);
    const b = this.bg.getContext('2d');
    b.scale(rs, rs);
    paintHer(b);

    this.tableTop = TABLE_Y - 14;
    this.table = makeCanvas(W * rs, (H - this.tableTop) * rs);
    const t = this.table.getContext('2d');
    t.scale(rs, rs);
    t.translate(0, -this.tableTop);
    paintTable(t);

    this.bokeh = Array.from({ length: 16 }, () => ({
      x: rand(0, W),
      y: rand(0, 700),
      r: rand(8, 24),
      v: rand(6, 16),
      a: rand(0.05, 0.12),
      warm: Math.random() < 0.5,
      p: rand(0, 6),
    }));
  }

  update(dt) {
    for (const k of this.bokeh) {
      k.y -= k.v * dt;
      k.x += Math.sin(k.p + k.y * 0.01) * 6 * dt;
      if (k.y < -30) {
        k.y = 720;
        k.x = rand(0, W);
      }
    }
  }

  drawBack(ctx, t) {
    ctx.drawImage(this.bg, 0, 0, W, H);

    // fairy lights
    const yAt = (x) => 14 + 34 * Math.abs(Math.sin((x / W) * Math.PI * 2.2));
    ctx.strokeStyle = '#3a2a30';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) (x ? ctx.lineTo : ctx.moveTo).call(ctx, x, yAt(x));
    ctx.stroke();
    let i = 0;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let x = 22; x < W; x += 44, i++) {
      const y = yAt(x) + 6;
      const on = 0.55 + 0.45 * Math.sin(t * 1.8 + i * 1.7);
      const g = ctx.createRadialGradient(x, y, 0, x, y, 28);
      g.addColorStop(0, `rgba(255,205,140,${0.45 * on})`);
      g.addColorStop(1, 'rgba(255,205,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - 28, y - 28, 56, 56);
    }
    for (const k of this.bokeh) {
      const a = k.a * (0.7 + 0.3 * Math.sin(t + k.p));
      ctx.fillStyle = k.warm ? `rgba(255,210,150,${a})` : `rgba(255,160,205,${a})`;
      ctx.beginPath();
      ctx.arc(k.x, k.y, k.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    i = 0;
    for (let x = 22; x < W; x += 44, i++) {
      const on = 0.55 + 0.45 * Math.sin(t * 1.8 + i * 1.7);
      ctx.fillStyle = `rgba(255,226,170,${0.55 + 0.45 * on})`;
      ctx.beginPath();
      ctx.ellipse(x, yAt(x) + 6, 4, 6, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawTable(ctx) {
    ctx.drawImage(this.table, 0, this.tableTop, W, H - this.tableTop);
  }

  // Candle + a rose, animated, sitting on the table.
  drawTableTop(ctx, t) {
    const x = 470;
    const base = BASE_Y + 4;
    const fl = 0.5 + 0.5 * Math.sin(t * 11) * Math.sin(t * 4.3);

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(x, base - 95, 5, x, base - 95, 260);
    glow.addColorStop(0, `rgba(255,175,90,${0.15 + fl * 0.06})`);
    glow.addColorStop(1, 'rgba(255,175,90,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 260, base - 355, 520, 520);
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,.16)';
    ctx.beginPath();
    ctx.roundRect(x - 32, base - 78, 64, 78, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.45)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#f6ecdf';
    ctx.beginPath();
    ctx.roundRect(x - 26, base - 50, 52, 44, 8);
    ctx.fill();
    ctx.fillStyle = '#fff6ea';
    ctx.beginPath();
    ctx.ellipse(x, base - 50, 26, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a2a20';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, base - 50);
    ctx.lineTo(x, base - 58);
    ctx.stroke();
    ctx.save();
    ctx.translate(x + Math.sin(t * 5) * 1.2, base - 60);
    ctx.scale(1, 1 + fl * 0.15);
    const fg = ctx.createRadialGradient(0, -4, 1, 0, -8, 20);
    fg.addColorStop(0, '#fffbe6');
    fg.addColorStop(0.45, '#ffd36a');
    fg.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.bezierCurveTo(10, -12, 9, 4, 0, 6);
    ctx.bezierCurveTo(-9, 4, -10, -12, 0, -26);
    ctx.fill();
    ctx.restore();

    // rose in a bud vase
    const vx = 552;
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.beginPath();
    ctx.roundRect(vx - 9, base - 72, 18, 72, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = '#3f7a4a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(vx, base - 62);
    ctx.quadraticCurveTo(vx - 4, base - 110, vx + 6, base - 150);
    ctx.stroke();
    ctx.fillStyle = '#4f9a5c';
    ctx.beginPath();
    ctx.ellipse(vx - 12, base - 110, 13, 5, -0.6, 0, Math.PI * 2);
    ctx.fill();
    const sway = Math.sin(t * 0.9) * 1.5;
    ctx.fillStyle = '#c9304f';
    ctx.beginPath();
    ctx.arc(vx + 6 + sway, base - 160, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#8f1c34';
    ctx.lineWidth = 2;
    for (let r = 4; r < 13; r += 4) {
      ctx.beginPath();
      ctx.arc(vx + 6 + sway, base - 161, r, 0.3 * r, Math.PI * 1.4 + 0.3 * r);
      ctx.stroke();
    }
  }
}

function paintHer(c) {
  let g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#533549');
  g.addColorStop(0.55, '#3e2839');
  g.addColorStop(1, '#2a1826');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.fillStyle = 'rgba(255,220,235,.05)';
  for (let y = 40, row = 0; y < H; y += 60, row++) {
    for (let x = row % 2 ? 30 : 0; x < W; x += 60) {
      for (let k = 0; k < 4; k++) {
        c.beginPath();
        c.arc(x + Math.cos((k * Math.PI) / 2) * 5, y + Math.sin((k * Math.PI) / 2) * 5, 3.5, 0, Math.PI * 2);
        c.fill();
      }
    }
  }
  const lamp = c.createRadialGradient(150, 200, 20, 150, 200, 480);
  lamp.addColorStop(0, 'rgba(255,185,140,.2)');
  lamp.addColorStop(1, 'rgba(255,185,140,0)');
  c.fillStyle = lamp;
  c.fillRect(0, 0, W, H);
  const v = c.createRadialGradient(W / 2, H * 0.45, 220, W / 2, H * 0.45, 1000);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.42)');
  c.fillStyle = v;
  c.fillRect(0, 0, W, H);
  paintWindow(c);
  paintBed(c);
  paintPolaroids(c);
}

function paintWindow(c) {
  const { x, y, w, h } = WIN;
  c.fillStyle = 'rgba(0,0,0,.3)';
  c.fillRect(x - 10, y - 6, w + 28, h + 30);
  let g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#140e2c');
  g.addColorStop(0.55, '#2b2150');
  g.addColorStop(1, '#5b3a6c');
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  for (let i = 0; i < 30; i++) {
    const col = pick(['rgba(255,200,120,.7)', 'rgba(255,150,190,.6)', 'rgba(255,230,180,.6)']);
    c.save();
    c.shadowColor = col;
    c.shadowBlur = 14;
    c.fillStyle = col;
    c.beginPath();
    c.arc(rand(x + 8, x + w - 8), rand(y + h * 0.55, y + h - 10), rand(3, 8), 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  let bx = x;
  while (bx < x + w) {
    const bw = rand(24, 50);
    c.fillStyle = '#140c22';
    c.fillRect(bx, y + h - rand(30, 90), bw, 100);
    bx += bw + rand(2, 6);
  }
  c.fillStyle = '#fff3e0';
  c.beginPath();
  c.arc(x + 80, y + 70, 22, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#1b1437';
  c.beginPath();
  c.arc(x + 90, y + 63, 20, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = '#f3e7de';
  c.lineWidth = 12;
  c.strokeRect(x - 6, y - 6, w + 12, h + 12);
  c.fillStyle = '#f3e7de';
  c.fillRect(x + w / 2 - 4, y, 8, h);

  c.fillStyle = '#d9c3b4';
  c.fillRect(x - 90, y - 40, w + 180, 7);
  for (const s of [-1, 1]) {
    const edge = s < 0 ? x - 70 : x + w + 70;
    const inner = s < 0 ? x + 70 : x + w - 70;
    c.fillStyle = 'rgba(255,238,246,.17)';
    c.beginPath();
    c.moveTo(edge, y - 36);
    c.lineTo(inner, y - 36);
    c.quadraticCurveTo(inner - s * 10, y + h * 0.45, edge + s * -30, y + h * 0.62);
    c.quadraticCurveTo(edge, y + h * 0.8, edge, y + h + 110);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,.08)';
    c.lineWidth = 3;
    for (let k = 1; k < 4; k++) {
      const fx = lerp(edge, inner, k / 4);
      c.beginPath();
      c.moveTo(fx, y - 36);
      c.quadraticCurveTo(fx - s * 12, y + h * 0.4, lerp(edge, fx, 0.5), y + h * 0.7);
      c.stroke();
    }
  }
}

function paintBed(c) {
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.beginPath();
  c.roundRect(1296, 478, 330, 280, 36);
  c.fill();
  c.fillStyle = '#7d5a70';
  c.beginPath();
  c.roundRect(1300, 470, 330, 280, 36);
  c.fill();
  c.fillStyle = '#8b6680';
  c.beginPath();
  c.roundRect(1322, 492, 286, 240, 26);
  c.fill();
  c.fillStyle = 'rgba(0,0,0,.18)';
  for (let r = 0; r < 3; r++) {
    for (let k = 0; k < 5; k++) {
      c.beginPath();
      c.arc(1350 + k * 56 + (r % 2) * 28, 530 + r * 50, 4, 0, Math.PI * 2);
      c.fill();
    }
  }
  c.fillStyle = '#c98fa9';
  c.fillRect(1300, 712, 330, 40);
  c.fillStyle = '#f7e1e8';
  c.beginPath();
  c.ellipse(1392, 690, 88, 44, -0.05, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#efc9d6';
  c.beginPath();
  c.ellipse(1528, 698, 84, 40, 0.06, 0, Math.PI * 2);
  c.fill();
  drawHeart(c, 1458, 700, 30, '#ff8fb8');
}

function paintPolaroids(c) {
  const p0 = [360, 150];
  const p1 = [590, 200];
  const p2 = [820, 158];
  c.strokeStyle = 'rgba(240,220,200,.6)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(...p0);
  c.quadraticCurveTo(...p1, ...p2);
  c.stroke();
  const at = (u) => [
    (1 - u) ** 2 * p0[0] + 2 * (1 - u) * u * p1[0] + u ** 2 * p2[0],
    (1 - u) ** 2 * p0[1] + 2 * (1 - u) * u * p1[1] + u ** 2 * p2[1],
  ];
  [0.14, 0.38, 0.62, 0.86].forEach((u, i) => {
    const [px, py] = at(u);
    c.save();
    c.translate(px, py + 4);
    c.rotate(rand(-0.12, 0.12));
    c.fillStyle = 'rgba(0,0,0,.25)';
    c.fillRect(-29, 4, 64, 76);
    c.fillStyle = '#fbf7f2';
    c.fillRect(-32, 0, 64, 76);
    c.save();
    c.beginPath();
    c.rect(-27, 5, 54, 50);
    c.clip();
    if (i === 0) {
      const g = c.createLinearGradient(0, 5, 0, 55);
      g.addColorStop(0, '#ffb38a');
      g.addColorStop(1, '#c65a8a');
      c.fillStyle = g;
      c.fillRect(-27, 5, 54, 50);
      c.fillStyle = '#ffe9b0';
      c.beginPath();
      c.arc(0, 40, 12, 0, Math.PI * 2);
      c.fill();
    } else if (i === 1) {
      c.fillStyle = '#7cc6f2';
      c.fillRect(-27, 5, 54, 34);
      c.fillStyle = '#f2d8a7';
      c.fillRect(-27, 39, 54, 16);
      c.fillStyle = '#3b8fcf';
      c.fillRect(-27, 34, 54, 6);
    } else if (i === 2) {
      c.fillStyle = '#ffd0e0';
      c.fillRect(-27, 5, 54, 50);
      drawHeart(c, 0, 32, 16, '#e0325f');
    } else {
      c.fillStyle = '#1d1838';
      c.fillRect(-27, 5, 54, 50);
      c.fillStyle = 'rgba(255,210,140,.8)';
      for (let k = 0; k < 14; k++) c.fillRect(rand(-25, 23), rand(25, 52), 2, 3);
    }
    c.restore();
    c.fillStyle = '#caa27a';
    c.fillRect(-3, -6, 6, 12);
    c.restore();
  });
}

function paintTable(c) {
  const top = TABLE_Y;
  let g = c.createLinearGradient(0, top - 14, 0, top + 2);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,.35)');
  c.fillStyle = g;
  c.fillRect(0, top - 14, W, 16);
  c.beginPath();
  c.moveTo(-20, top);
  c.lineTo(W + 20, top);
  c.lineTo(W + 140, H + 10);
  c.lineTo(-140, H + 10);
  c.closePath();
  g = c.createLinearGradient(0, top, 0, H);
  g.addColorStop(0, '#a88b78');
  g.addColorStop(0.25, '#b39683');
  g.addColorStop(1, '#9c806d');
  c.fillStyle = g;
  c.fill();
  c.save();
  c.clip();
  c.strokeStyle = 'rgba(150,120,100,.12)';
  c.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    const sx = rand(0, W);
    const sy = rand(top, H);
    c.beginPath();
    c.moveTo(sx, sy);
    c.bezierCurveTo(sx + rand(40, 120), sy + rand(-20, 20), sx + rand(120, 240), sy + rand(-30, 30), sx + rand(240, 360), sy + rand(-10, 10));
    c.stroke();
  }
  c.fillStyle = 'rgba(232,140,170,.42)';
  c.fillRect(0, top + 30, W, 70);
  c.fillStyle = 'rgba(255,255,255,.55)';
  for (let x = 6; x < W; x += 14) {
    c.beginPath();
    c.arc(x, top + 32, 2.4, 0, Math.PI * 2);
    c.arc(x + 7, top + 98, 2.4, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
  const hg = c.createRadialGradient(420, top + 60, 20, 420, top + 60, 760);
  hg.addColorStop(0, 'rgba(255,210,170,.14)');
  hg.addColorStop(1, 'rgba(255,210,170,0)');
  c.fillStyle = hg;
  c.fillRect(0, top, W, H - top);
  c.fillStyle = '#d6bcaa';
  c.fillRect(-20, top, W + 40, 3);
}

// ------------------------------------------------------------------ her

const SKIN = '#e3a887';
const SKIN_D = '#c7866a';
const SKIN_L = '#f3c4a8';
const HAIR = '#3a2218';
const HAIR_L = 'rgba(140,90,60,.35)';
// mid-tone lavender: pale pastels bloom out under the post-processing glow
const SW = '#9a82c6';
const SW_D = '#76609f';
const SW_L = '#b3a0da';
const LIP = '#d56b82';
const BUBBLE = { bg: '#fff0f6', ink: '#5a1f3d' };

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

function limb(ctx, sx, sy, ex, ey, hx, hy, upper, lower, w1, w2) {
  ctx.lineCap = 'round';
  ctx.strokeStyle = upper;
  ctx.lineWidth = w1;
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.strokeStyle = lower;
  ctx.lineWidth = w2;
  ctx.beginPath();
  ctx.moveTo(ex, ey);
  ctx.lineTo(hx, hy);
  ctx.stroke();
}

function miniBottle(ctx, x, y, capped, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = capped ? '#4a2a0a' : 'rgba(90,50,15,.7)';
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(-9, -40);
  ctx.quadraticCurveTo(-9, -52, -4, -56);
  ctx.lineTo(-4, -72);
  ctx.lineTo(4, -72);
  ctx.lineTo(4, -56);
  ctx.quadraticCurveTo(9, -52, 9, -40);
  ctx.lineTo(9, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#1d4fb8';
  ctx.fillRect(-9, -34, 18, 16);
  if (capped) {
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(-5, -76, 10, 5);
  }
  ctx.restore();
}

function wineGlass(ctx, x, y, angle, level) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const bowl = () => {
    ctx.beginPath();
    ctx.moveTo(-24, -62);
    ctx.bezierCurveTo(-26, -20, -16, 4, 0, 6);
    ctx.bezierCurveTo(16, 4, 26, -20, 24, -62);
    ctx.closePath();
  };
  bowl();
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  ctx.fill();
  if (level > 0.02) {
    ctx.save();
    bowl();
    ctx.clip();
    ctx.rotate(-angle);
    const sy = 6 - level * 56;
    const g = ctx.createLinearGradient(0, sy, 0, 10);
    g.addColorStop(0, 'rgba(245,150,170,.9)');
    g.addColorStop(1, 'rgba(210,80,115,.95)');
    ctx.fillStyle = g;
    ctx.fillRect(-60, sy, 120, 80);
    ctx.restore();
  }
  bowl();
  ctx.strokeStyle = 'rgba(255,255,255,.7)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fillRect(-2, 6, 4, 36);
  ellipse(ctx, 0, 44, 18, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  ctx.fillRect(-17, -52, 4, 26);
  ctx.restore();
}

export class Girlfriend {
  constructor() {
    this.seatX = 232;
    this.x = 232;
    this.targetX = 232;
    this.t = 0;
    this.walk = 0;
    this.seated = true;
    this.blink = 0;
    this.blinkT = 2.5;
    this.lookX = 0;
    this.lookY = 0;
    this.drunk = 0;
    this.bubble = null;
    this.talkT = 0;
    this.blush = 0;
    this.shock = 0;
    this.hearts = [];
    this.glassLevel = 0.8;
    this.glassAngle = 0;
    this.sipT = 0;
    this.nextSip = rand(10, 16);
    this.cheersT = 0;
    this.pokeT = 0;
    this.hand = { x: 392, y: 790 };
    this.serveHand = { x: 160, y: 690 };
    // server interface (same shape the waiter job uses)
    this.handTarget = null;
    this.opener = false;
    this.trayNew = 0;
    this.trayEmpty = 0;
  }

  walkTo(x) {
    this.targetX = x;
  }

  get arrived() {
    return Math.abs(this.x - this.targetX) < 3;
  }

  get visible() {
    return true;
  }

  get bob() {
    return -Math.abs(Math.sin(this.walk)) * 7;
  }

  leaveSeat() {
    this.seated = false;
    this.cheersT = 0;
    this.sipT = 0;
  }

  sit() {
    this.seated = true;
    this.x = this.targetX = this.seatX;
    this.handTarget = null;
    this.opener = false;
    this.trayNew = 0;
    this.trayEmpty = 0;
  }

  say(text) {
    this.bubble = { text, age: 0, dur: clamp(1.8 + text.length * 0.055, 2.6, 6) };
    this.talkT = clamp(text.length * 0.05, 0.8, 3.2);
  }

  react(key) {
    if (key === 'cheers' || key === 'jarDone' || key === 'perfect') {
      this.blush = 1;
      this.addHearts(3);
    }
    if (key === 'broke' || key === 'spill' || key === 'overflow') this.shock = 1;
  }

  cheers() {
    this.cheersT = 1.4;
    this.blush = 1;
    this.addHearts(6);
  }

  anticipate() {
    if (this.seated && this.cheersT < 0.5) this.cheersT = 0.5;
  }

  // Playful spank: her lower back / hip, just above the table edge.
  get pokeZone() {
    return { x0: this.x - 125, x1: this.x + 130, y0: 600, y1: 735 };
  }

  poke() {
    this.pokeT = 0.6;
    this.blush = 1;
    this.shock = 0.5;
    this.cheersT = 0;
    this.addHearts(5);
  }

  get hop() {
    return this.pokeT > 0 ? Math.sin(((0.6 - this.pokeT) / 0.6) * Math.PI) * 16 : 0;
  }

  get glassPos() {
    return this.seated ? { x: this.hand.x, y: this.hand.y - 30 } : null;
  }

  addHearts(n) {
    for (let i = 0; i < n; i++) {
      this.hearts.push({
        x: this.x + 20 + rand(-40, 40),
        y: 290 + rand(-10, 20),
        vx: rand(-25, 25),
        vy: rand(-90, -45),
        age: -i * 0.12,
        life: rand(1.3, 2.1),
        s: rand(9, 15),
      });
    }
  }

  update(dt, look, drunk) {
    this.t += dt;
    this.drunk = drunk;
    const step = clamp(this.targetX - this.x, -1050 * dt, 1050 * dt);
    this.x += step;
    if (Math.abs(step) > 0.3) this.walk += dt * 12;
    else this.walk = smooth(this.walk, Math.round(this.walk / Math.PI) * Math.PI, 10, dt);

    this.talkT = Math.max(0, this.talkT - dt);
    if (this.bubble) {
      this.bubble.age += dt;
      if (this.bubble.age > this.bubble.dur) this.bubble = null;
    }
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.blink = 1;
      this.blinkT = rand(2, 4.5);
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    this.blush = Math.max(0, this.blush - dt * 0.35);
    this.shock = Math.max(0, this.shock - dt);
    this.pokeT = Math.max(0, this.pokeT - dt);
    if (look) {
      this.lookX = smooth(this.lookX, clamp((look.x - this.x) / 250, -1, 1) * 5, 6, dt);
      this.lookY = smooth(this.lookY, clamp((look.y - 370) / 250, -1, 1) * 4, 6, dt);
    }

    let tx = 392;
    let ty = 790;
    let ta = 0;
    if (this.seated) {
      if (this.cheersT > 0) {
        this.cheersT -= dt;
        tx = 505;
        ty = 600 + Math.sin(this.t * 10) * 5;
        ta = 0.12;
      } else {
        this.nextSip -= dt;
        if (this.nextSip < 0 && this.sipT <= 0 && this.talkT <= 0) {
          this.sipT = 2.4;
          this.nextSip = rand(11, 18);
        }
        if (this.sipT > 0) {
          this.sipT -= dt;
          const k = this.sipT > 1.9 ? (2.4 - this.sipT) / 0.5 : this.sipT < 0.5 ? this.sipT / 0.5 : 1;
          tx = lerp(392, 292, k);
          ty = lerp(790, 452, k);
          ta = -0.9 * k;
          if (k > 0.9) this.glassLevel = Math.max(0.15, this.glassLevel - dt * 0.05);
        }
      }
    }
    this.hand.x = smooth(this.hand.x, tx, 7, dt);
    this.hand.y = smooth(this.hand.y, ty, 7, dt);
    this.glassAngle = smooth(this.glassAngle, ta, 7, dt);

    const sx = this.handTarget ? this.handTarget.x : this.x - 80;
    const sy = this.handTarget ? this.handTarget.y : 690 + this.bob;
    this.serveHand.x = smooth(this.serveHand.x, sx, 14, dt);
    this.serveHand.y = smooth(this.serveHand.y, sy, 14, dt);

    for (const h of this.hearts) {
      h.age += dt;
      if (h.age < 0) continue;
      h.x += h.vx * dt;
      h.y += h.vy * dt;
    }
    this.hearts = this.hearts.filter((h) => h.age < h.life);
  }

  get sway() {
    return this.seated ? Math.sin(this.t * 0.8) * 3 * (1 + this.drunk * 2) : 0;
  }

  // Behind you while she's in her seat, in front of you while she walks over.
  get inBack() {
    return this.x < 430;
  }

  drawBack(ctx) {
    if (this.inBack) this.drawFigure(ctx);
  }

  drawMid(ctx) {
    if (!this.inBack) this.drawFigure(ctx);
  }

  drawFront(ctx) {
    if (this.seated) this.drawGlassArm(ctx);
  }

  drawTop(ctx) {
    if (!this.seated) this.drawServeArm(ctx);
    for (const h of this.hearts) {
      if (h.age < 0) continue;
      drawHeart(ctx, h.x, h.y, h.s, `rgba(255,95,162,${1 - h.age / h.life})`);
    }
  }

  drawFigure(ctx) {
    const t = this.t;
    const cx = this.x + this.sway;
    const breathe = Math.sin(t * 1.7) * 2;
    const tilt =
      (this.seated ? Math.sin(t * 0.6) * 0.04 : Math.sin(this.walk) * 0.03) +
      (this.talkT > 0 ? Math.sin(t * 7) * 0.02 : 0);
    const hs = Math.sin(t * 1.1) * 4;
    ctx.save();
    ctx.translate(cx, this.bob - this.hop);

    if (!this.seated) {
      const arm = solveIK(66, 522, 128, 604, 100, 96, 1);
      limb(ctx, 66, 522, arm.ex, arm.ey, arm.hx, arm.hy, SW, SW, 30, 26);
    }

    // long hair behind the shoulders
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.moveTo(-62, 330);
    ctx.bezierCurveTo(-100, 400, -106 + hs, 520, -94 + hs, 640);
    ctx.quadraticCurveTo(-60, 662, -30, 630);
    ctx.quadraticCurveTo(0, 652, 30, 630);
    ctx.quadraticCurveTo(60, 662, 94 - hs, 640);
    ctx.bezierCurveTo(106 - hs, 520, 100, 400, 62, 330);
    ctx.closePath();
    ctx.fill();

    // cozy oversized sweater
    ctx.beginPath();
    ctx.moveTo(-34, 450);
    ctx.quadraticCurveTo(-100, 462, -112, 516 + breathe);
    ctx.lineTo(-138, 800);
    ctx.lineTo(138, 800);
    ctx.lineTo(112, 516 + breathe);
    ctx.quadraticCurveTo(100, 462, 34, 450);
    ctx.closePath();
    let g = ctx.createLinearGradient(-130, 0, 130, 0);
    g.addColorStop(0, SW_D);
    g.addColorStop(0.45, SW_L);
    g.addColorStop(1, SW_D);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.13)';
    ctx.lineWidth = 2;
    for (let x = -140; x < 140; x += 13) {
      ctx.beginPath();
      ctx.moveTo(x, 470);
      ctx.lineTo(x + 6, 800);
      ctx.stroke();
    }
    ctx.restore();

    // strands falling over the front
    ctx.fillStyle = HAIR;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 42, 400);
      ctx.quadraticCurveTo(s * 72, 480, s * (64 + hs * 0.5 * s), 566);
      ctx.quadraticCurveTo(s * 48, 520, s * 34, 430);
      ctx.closePath();
      ctx.fill();
    }

    ctx.fillStyle = SKIN_D;
    ctx.fillRect(-17, 408, 34, 48);
    ctx.fillStyle = SKIN;
    ellipse(ctx, 0, 452, 27, 11);
    ctx.fill();
    ctx.strokeStyle = SW_D;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.ellipse(0, 452, 34, 16, 0, 0.05 * Math.PI, 0.95 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = '#e8c35a';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(0, 446, 20, 22, 0, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    drawHeart(ctx, 0, 470, 5, '#e8c35a');

    this.drawHead(ctx, 0, 372 + breathe * 0.4, tilt);

    if (!this.seated && (this.trayNew || this.trayEmpty || !this.arrived)) {
      const tx = 152;
      const ty = 604;
      for (let i = 0; i < this.trayNew; i++) miniBottle(ctx, tx - 44 + i * 26, ty - 4, true, 0);
      for (let i = 0; i < this.trayEmpty; i++) miniBottle(ctx, tx - 30 + i * 18, ty - 10, false, 1.35);
      g = ctx.createLinearGradient(0, ty - 14, 0, ty + 14);
      g.addColorStop(0, '#fff5f8');
      g.addColorStop(1, '#d8b8c6');
      ctx.fillStyle = g;
      ellipse(ctx, tx, ty + 2, 80, 14);
      ctx.fill();
      ctx.fillStyle = SKIN;
      ellipse(ctx, 128, 610, 13, 10);
      ctx.fill();
    }
    ctx.restore();
  }

  drawHead(ctx, x, y, tilt) {
    const t = this.t;
    const d = this.drunk;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);

    ctx.fillStyle = HAIR;
    ellipse(ctx, 0, -8, 64, 76);
    ctx.fill();
    ctx.fillStyle = SKIN_D;
    ellipse(ctx, -50, 8, 9, 14);
    ctx.fill();
    ellipse(ctx, 50, 8, 9, 14);
    ctx.fill();
    ctx.strokeStyle = '#e8c35a';
    ctx.lineWidth = 2.5;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * 51, 30, 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    let g = ctx.createRadialGradient(-12, -10, 8, 0, 0, 78);
    g.addColorStop(0, SKIN_L);
    g.addColorStop(0.7, SKIN);
    g.addColorStop(1, SKIN_D);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-50, -20);
    ctx.bezierCurveTo(-52, 40, -30, 66, 0, 68);
    ctx.bezierCurveTo(30, 66, 52, 40, 50, -20);
    ctx.bezierCurveTo(48, -70, -48, -70, -50, -20);
    ctx.fill();

    const bl = Math.min(0.7, 0.26 + this.blush * 0.35 + d * 0.2);
    for (const s of [-1, 1]) {
      g = ctx.createRadialGradient(s * 28, 20, 2, s * 28, 20, 20);
      g.addColorStop(0, `rgba(240,110,140,${bl})`);
      g.addColorStop(1, 'rgba(240,110,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(s * 28 - 20, 0, 40, 40);
    }

    const happy = this.blush > 0.55 && this.talkT <= 0;
    const open = (1 - this.blink) * (1 - Math.min(0.5, d * 0.35)) * (this.shock > 0 ? 1.25 : 1);
    for (const s of [-1, 1]) {
      const ex = s * 20;
      const ey = -6;
      if (happy) {
        ctx.strokeStyle = HAIR;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(ex, ey + 4, 9, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        continue;
      }
      ctx.fillStyle = '#fbf6f2';
      ellipse(ctx, ex, ey, 12, 8.5 * open + 0.4);
      ctx.fill();
      if (open > 0.2) {
        ctx.save();
        ellipse(ctx, ex, ey, 12, 8.5 * open + 0.4);
        ctx.clip();
        ctx.fillStyle = '#5a3522';
        ellipse(ctx, ex + this.lookX, ey + this.lookY * 0.5, 6.5, 6.5);
        ctx.fill();
        ctx.fillStyle = '#1a0e08';
        ellipse(ctx, ex + this.lookX, ey + this.lookY * 0.5, 3.2, 3.2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ellipse(ctx, ex + this.lookX + 2.2, ey + this.lookY * 0.5 - 2.2, 1.8, 1.8);
        ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = HAIR;
      ctx.lineWidth = 3.2;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 12.5, 9 * open + 0.6, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(ex + s * (8 + k * 2.5), ey - 6 - k * 0.5);
        ctx.lineTo(ex + s * (12 + k * 3.5), ey - 11 - k * 1.5);
        ctx.stroke();
      }
    }

    const raise = this.shock * 6 + (this.talkT > 0 ? Math.abs(Math.sin(t * 5)) * 2 : 0);
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 31, -23 - raise);
      ctx.quadraticCurveTo(s * 20, -31 - raise, s * 9, -25 - raise);
      ctx.stroke();
    }

    ctx.strokeStyle = SKIN_D;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(-5, 14, -2, 18);
    ctx.lineTo(4, 19);
    ctx.stroke();

    if (this.talkT > 0) {
      const o = Math.abs(Math.sin(t * 14)) * 0.8 + 0.2;
      ctx.fillStyle = '#7a2a3a';
      ellipse(ctx, 0, 38, 10, 3 + o * 6);
      ctx.fill();
      ctx.fillStyle = LIP;
      ctx.beginPath();
      ctx.moveTo(-12, 35);
      ctx.quadraticCurveTo(0, 28 - o * 2, 12, 35);
      ctx.quadraticCurveTo(0, 32, -12, 35);
      ctx.fill();
    } else {
      ctx.fillStyle = LIP;
      ctx.beginPath();
      ctx.moveTo(-13, 35);
      ctx.quadraticCurveTo(-6, 30, 0, 33);
      ctx.quadraticCurveTo(6, 30, 13, 35);
      ctx.quadraticCurveTo(0, 46, -13, 35);
      ctx.fill();
      ctx.strokeStyle = '#a84860';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-13, 35);
      ctx.quadraticCurveTo(0, 39 + this.blush * 2, 13, 35);
      ctx.stroke();
    }

    // bangs with a side part
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.moveTo(-54, 10);
    ctx.bezierCurveTo(-60, -60, -20, -84, 10, -80);
    ctx.bezierCurveTo(50, -76, 62, -40, 54, 10);
    ctx.bezierCurveTo(46, -26, 30, -46, 14, -50);
    ctx.bezierCurveTo(0, -30, -30, -34, -44, -14);
    ctx.closePath();
    ctx.fill();
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 50, -20);
      ctx.quadraticCurveTo(s * 62, 30, s * 56, 76);
      ctx.quadraticCurveTo(s * 44, 40, s * 42, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = HAIR_L;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, -44, 40, -2.5, -1.6);
    ctx.stroke();
    ctx.restore();
  }

  drawGlassArm(ctx) {
    const cx = this.x + this.sway;
    const breathe = Math.sin(this.t * 1.7) * 2;
    const sx = cx + 104;
    const sy = 522 + breathe;
    const arm = solveIK(sx, sy, this.hand.x + 8, this.hand.y + 6, 140, 135, -1);
    limb(ctx, sx, sy, arm.ex, arm.ey, arm.hx, arm.hy, SW, SW_L, 36, 28);
    ctx.fillStyle = SW_D;
    ellipse(ctx, lerp(arm.ex, arm.hx, 0.86), lerp(arm.ey, arm.hy, 0.86), 15, 15);
    ctx.fill();
    wineGlass(ctx, this.hand.x, this.hand.y, this.glassAngle, this.glassLevel);
    ctx.fillStyle = SKIN;
    ellipse(ctx, this.hand.x + 16, this.hand.y + 6, 13, 16);
    ctx.fill();
  }

  drawServeArm(ctx) {
    const sx = this.x - 58;
    const sy = 524 + this.bob;
    const arm = solveIK(sx, sy, this.serveHand.x, this.serveHand.y, 130, 130, -1);
    limb(ctx, sx, sy, arm.ex, arm.ey, arm.hx, arm.hy, SW, SW_L, 30, 26);
    ctx.fillStyle = SKIN;
    ellipse(ctx, arm.hx, arm.hy, 13, 12);
    ctx.fill();
    if (this.opener) {
      ctx.save();
      ctx.translate(arm.hx, arm.hy);
      ctx.rotate(-0.6 + Math.sin(this.t * 20) * 0.1);
      ctx.fillStyle = '#e7c9d4';
      ctx.fillRect(-4, -34, 9, 40);
      ctx.strokeStyle = '#e7c9d4';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, -40, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawBubble(ctx) {
    if (this.x < 600) {
      drawBubble(ctx, this.bubble, { x: 22, y: 292, ax: this.x + 4, ay: 300, maxW: 400, ...BUBBLE });
    } else {
      drawBubble(ctx, this.bubble, { x: this.x - 40, y: 300, ax: this.x - 30, ay: 330, align: 'right', maxW: 320, ...BUBBLE });
    }
  }
}

// ------------------------------------------------------------------ theme config

export default {
  id: 'her',
  name: 'Her Place',
  emoji: '💕',
  blurb: 'Fairy lights, a candle & she serves you',
  title: ['HER', 'PLACE'],
  subtitle: 'fairy lights • candle • her',
  tagline: 'She fetches it, opens it, even pours it. You just say please.',
  enter: 'GO TO HER PLACE 💕',
  refillIcon: '💕',
  refillStep: 'Out of beer? Say <em>“baby, beer please”</em>',
  help: ['💕 “Baby, beer please” / ✋ hand up', 'She brings, opens & pours your beer'],
  createScene: (rs) => new HerScene(rs),
  createCast: () => {
    const her = new Girlfriend();
    return { companion: her, server: her };
  },
  refill: 'serve',
  slots: [655, 765, 1180, 1295],
  introServe: true,
  introServeDelay: 4,
  voice: {
    who: 'her',
    serverWho: 'her',
    word: 'BABY',
    wake: /(baby|babe|bebe|jaan|jaanu|janu|love|sweetheart|honey|please|beer|bear|waiter)/i,
  },
  tutorial: [
    '✊ Make a FIST on a bottle to pick it up',
    '🍺 Hold it over the JAR and tilt to pour',
    '😮 Grab the JAR and bring it to your MOUTH',
    '💕 Out of beer? Say "BABY, BEER PLEASE" (or raise a hand ✋)',
  ],
  prompt: { title: 'ASK HER NICELY 💕', sub: '🗣️ "baby, beer please"   •   ✋ raise a hand   •   ⌨️ press W' },
  callLabels: { voice: 'BABY, BEER PLEASE 🥺', hand: 'JAAN...? ✋', key: 'BEER PLEASE 💕' },
  refillButton: '💕 ASK HER',
  cheersText: 'CHEERS, LOVE! 🥂',
  hearts: true,
  jarText: 'JAR DONE!',
  proText: 'HER FAVOURITE HUMAN 💕',
  music: 'romance',
  ambience: 'soft',
  hud: { panel: 'rgba(40,14,32,.7)', border: 'rgba(255,158,199,.55)', accent: '#ff9ec7', label: '#f3c6da' },
  loading: ['Candle jal rahi hai…', 'Fairy lights on kar rahe hain…', 'Woh ready ho rahi hai…', 'Beer thandi ho rahi hai…'],
  lines: {
    intro: ['Hey you! 💕 Sit, main beer laati hoon.', 'Finally you came! Ruko, beer leke aati hoon 💕'],
    pour: ["Slowly... don't make a mess 🙈", 'Tilt it a little... perfect!', 'Careful, jaan'],
    perfect: ['Look at that foam! So proud of you 😌', 'Perfect pour! Who taught you that?'],
    overflow: ["Arre! It's overflowing 😂", 'Too much foam, silly!'],
    spill: ['Hey! My table! 😤', "You're cleaning that later, okay?", 'Oops 🙈'],
    drink: ['Easy there, champ 😄', 'Look at you go!', 'Slowly baby, no rush'],
    bottleDrink: ['Straight from the bottle? Classy 😂', 'Use the glass, jaan!'],
    jarDone: ['Wow, finished already? 😳', 'Okay, that was impressive 😌', 'Want another one?'],
    cheers: ['Cheers, love! 🥂', 'To us 💕', "Cheers! You're my favourite person"],
    empty: ['All gone? Just ask me nicely 😌', 'Out of beer? Say baby, beer please 💕'],
    callWaiter: ['Okay okay, getting it! 😄', 'Coming right up 💕'],
    waiterBusy: ["I'm getting it, patience! 😄"],
    broke: ['You broke a bottle?! Are you okay? 😱', "Don't touch the glass! I'll clean it 🥺"],
    idle: ["You're so quiet... everything okay? 🥺", "Your beer's getting warm!", 'Talk to me 😄'],
    spank: ['Oye! 🙈 Naughty!', 'Hey! 😳 Behave, jaan!', 'Haww! 😤💕', 'Hmph! No beer for you... just kidding 💕'],
    tipsy: [
      "You're getting cute and wobbly 😂",
      'Drink some water too, okay?',
      "You're staying here tonight, no driving!",
      'Okay, last one... maybe 😌',
    ],
  },
  serverLines: {
    hi: ['Be right back 💕', 'One sec, jaan!'],
    full: ['You still have beer, silly 😄'],
    pour: ['Let me pour it for you 💕', "Here, I'll fill your glass"],
    bye: ['Here you go 💕', 'Enjoy, jaan', 'Anything for you 😌'],
  },
};
