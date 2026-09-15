// Procedurally drawn + animated characters: Bunty bhai (your drinking buddy)
// and Chhotu (the waiter). No sprites — pure canvas, IK arms, blinking, lip-flap.
import { W, clamp, lerp, rand, smooth, solveIK, easeOutBack, wrapText } from './util.js';
import { drawSmallGlass } from './objects.js';

const SKIN = '#a86f47';
const SKIN_D = '#7e4f2f';
const SKIN_L = '#c68a5c';
const HAIR = '#17110d';

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

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
}

export function drawBubble(ctx, b, { x, y, ax, ay, bg = '#fffdf5', ink = '#1b1b1b', maxW = 380, align = 'left' }) {
  if (!b) return;
  const { age, dur } = b;
  if (age > dur) return;
  const s = age < 0.25 ? easeOutBack(age / 0.25) : 1;
  const alpha = age > dur - 0.3 ? clamp((dur - age) / 0.3, 0, 1) : 1;
  ctx.save();
  ctx.font = '700 25px "Baloo 2", sans-serif';
  const lines = wrapText(ctx, b.text, maxW);
  const lh = 30;
  const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 36;
  const h = lines.length * lh + 20;
  const bx = align === 'right' ? x - w : x;
  const by = y - h;
  ctx.globalAlpha = alpha;
  ctx.translate(ax, ay);
  ctx.scale(s, s);
  ctx.translate(-ax, -ay);
  ctx.shadowColor = 'rgba(0,0,0,.35)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 18);
  ctx.fill();
  ctx.shadowColor = 'transparent';
  const tx = clamp(ax, bx + 30, bx + w - 30);
  ctx.beginPath();
  ctx.moveTo(tx - 14, by + h - 2);
  ctx.lineTo(ax, ay);
  ctx.lineTo(tx + 14, by + h - 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(bx, by, w, h, 18);
  ctx.stroke();
  ctx.fillStyle = bg;
  ctx.fillRect(tx - 12, by + h - 3, 24, 6);
  ctx.beginPath();
  ctx.moveTo(tx - 14, by + h);
  ctx.lineTo(ax, ay);
  ctx.lineTo(tx + 14, by + h);
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, bx + 18, by + 10 + lh / 2 + i * lh + 1));
  ctx.restore();
}

export class Friend {
  constructor() {
    this.cx = 232;
    this.t = 0;
    this.blinkT = 2;
    this.blink = 0;
    this.talkT = 0;
    this.bubble = null;
    this.lookX = 0;
    this.lookY = 0;
    this.drunk = 0;
    this.sipT = 0;
    this.nextSip = rand(9, 14);
    this.cheersT = 0;
    this.glassLevel = 0.85;
    this.excite = 0;
    this.hand = { x: 392, y: 806 };
    this.glassAngle = 0;
    this.stubble = Array.from({ length: 170 }, () => [rand(-50, 50), rand(12, 70)]).filter(
      ([x, y]) => (x * x) / 2500 + (y * y) / 4900 < 0.92,
    );
  }

  say(text) {
    this.bubble = { text, age: 0, dur: clamp(1.8 + text.length * 0.06, 2.6, 6) };
    this.talkT = clamp(text.length * 0.055, 0.8, 3.6);
  }

  cheers() {
    this.cheersT = 1.4;
    this.excite = 1;
  }

  anticipate() {
    if (this.cheersT < 0.5) this.cheersT = 0.5;
  }

  get glassPos() {
    return { x: this.hand.x, y: this.hand.y };
  }

  update(dt, look, drunk) {
    this.t += dt;
    this.drunk = drunk;
    this.talkT = Math.max(0, this.talkT - dt);
    if (this.bubble) {
      this.bubble.age += dt;
      if (this.bubble.age > this.bubble.dur) this.bubble = null;
    }
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.blink = 1;
      this.blinkT = rand(1.8, 4.5);
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    this.excite = Math.max(0, this.excite - dt * 0.8);
    if (look) {
      this.lookX = smooth(this.lookX, clamp((look.x - this.cx) / 250, -1, 1) * 5, 6, dt);
      this.lookY = smooth(this.lookY, clamp((look.y - 370) / 250, -1, 1) * 4, 6, dt);
    }

    let tx = 392;
    let ty = 806;
    let ta = 0;
    if (this.cheersT > 0) {
      this.cheersT -= dt;
      tx = 510;
      ty = 600 + Math.sin(this.t * 10) * 6;
      ta = 0.15;
    } else {
      this.nextSip -= dt;
      if (this.nextSip < 0 && this.sipT <= 0 && this.talkT <= 0) {
        this.sipT = 2.4;
        this.nextSip = rand(9, 16);
      }
      if (this.sipT > 0) {
        this.sipT -= dt;
        const k = this.sipT > 1.9 ? (2.4 - this.sipT) / 0.5 : this.sipT < 0.5 ? this.sipT / 0.5 : 1;
        tx = lerp(392, 292, k);
        ty = lerp(806, 470, k);
        ta = -1.0 * k;
        if (k > 0.9) this.glassLevel = Math.max(0.15, this.glassLevel - dt * 0.06);
      }
    }
    this.hand.x = smooth(this.hand.x, tx, 7, dt);
    this.hand.y = smooth(this.hand.y, ty, 7, dt);
    this.glassAngle = smooth(this.glassAngle, ta, 7, dt);
  }

  get sway() {
    return Math.sin(this.t * 0.9) * 4 * (1 + this.drunk * 3);
  }

  // Render layer: behind the player.
  drawBack(ctx) {
    this.drawBody(ctx);
  }

  drawBody(ctx) {
    const t = this.t;
    const d = this.drunk;
    const cx = this.cx + this.sway;
    const breathe = Math.sin(t * 1.8) * 2;
    const tilt = Math.sin(t * 0.7) * 0.035 * (1 + d * 4) + (this.talkT > 0 ? Math.sin(t * 9) * 0.025 : 0);

    // back arm resting on the table
    const back = solveIK(cx - 112, 525 + breathe, 96, 790, 150, 150, 1);
    limb(ctx, cx - 112, 525 + breathe, back.ex, back.ey, back.hx, back.hy, '#8e2424', SKIN_D, 44, 30);

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - 40, 452);
    ctx.quadraticCurveTo(cx - 122, 466, cx - 130, 522 + breathe);
    ctx.lineTo(cx - 152, 790);
    ctx.lineTo(cx + 152, 790);
    ctx.lineTo(cx + 130, 522 + breathe);
    ctx.quadraticCurveTo(cx + 122, 466, cx + 40, 452);
    ctx.closePath();
    ctx.fillStyle = '#b02e2e';
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = 'rgba(25,15,40,.36)';
    for (let x = cx - 170; x < cx + 170; x += 28) ctx.fillRect(x, 440, 11, 360);
    for (let y = 452; y < 800; y += 28) ctx.fillRect(cx - 170, y, 340, 11);
    ctx.fillStyle = 'rgba(255,230,200,.14)';
    for (let x = cx - 170; x < cx + 170; x += 28) ctx.fillRect(x + 19, 440, 2, 360);
    for (let y = 452; y < 800; y += 28) ctx.fillRect(cx - 170, y + 19, 340, 2);
    const g = ctx.createLinearGradient(cx - 150, 0, cx + 150, 0);
    g.addColorStop(0, 'rgba(0,0,0,.4)');
    g.addColorStop(0.3, 'rgba(0,0,0,0)');
    g.addColorStop(0.7, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,.45)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 170, 440, 340, 360);
    ctx.restore();

    // open collar, chest, gold chain
    ctx.beginPath();
    ctx.moveTo(cx - 36, 454);
    ctx.lineTo(cx, 548);
    ctx.lineTo(cx + 36, 454);
    ctx.closePath();
    ctx.fillStyle = SKIN_D;
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,12,8,.5)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 10; i++) {
      const hx = cx + ((i * 7) % 30) - 15;
      const hy = 488 + ((i * 11) % 40);
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(hx + 3, hy + 4);
      ctx.stroke();
    }
    ctx.strokeStyle = '#e6b422';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx - 30, 460);
    ctx.quadraticCurveTo(cx, 540, cx + 30, 460);
    ctx.stroke();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = '#fff4b0';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#e6b422';
    ellipse(ctx, cx, 516, 7, 9);
    ctx.fill();
    ctx.fillStyle = '#c23a3a';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * 36, 452);
      ctx.lineTo(cx + s * 76, 470);
      ctx.lineTo(cx + s * 10, 526);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = '#eee';
    for (let y = 572; y < 780; y += 46) {
      ellipse(ctx, cx, y, 4, 4);
      ctx.fill();
    }
    ctx.restore();

    ctx.fillStyle = SKIN_D;
    ctx.fillRect(cx - 26, 418, 52, 46);
    this.drawHead(ctx, cx, 372 + breathe * 0.5, tilt);
  }

  drawHead(ctx, x, y, tilt) {
    const t = this.t;
    const d = this.drunk;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    ctx.fillStyle = SKIN_D;
    ellipse(ctx, -60, 8, 12, 20);
    ctx.fill();
    ellipse(ctx, 60, 8, 12, 20);
    ctx.fill();
    let g = ctx.createRadialGradient(-14, -12, 10, 0, 0, 82);
    g.addColorStop(0, SKIN_L);
    g.addColorStop(0.7, SKIN);
    g.addColorStop(1, SKIN_D);
    ctx.fillStyle = g;
    ellipse(ctx, 0, 0, 58, 72);
    ctx.fill();
    ctx.fillStyle = 'rgba(30,20,15,.28)';
    for (const [sx, sy] of this.stubble) ctx.fillRect(sx, sy, 1.6, 1.6);
    if (d > 0.1) {
      for (const s of [-1, 1]) {
        g = ctx.createRadialGradient(s * 33, 18, 2, s * 33, 18, 24);
        g.addColorStop(0, `rgba(230,40,40,${Math.min(0.55, d * 0.5)})`);
        g.addColorStop(1, 'rgba(230,40,40,0)');
        ctx.fillStyle = g;
        ctx.fillRect(s * 33 - 24, -6, 48, 48);
      }
    }
    // hair
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.moveTo(-60, 2);
    ctx.bezierCurveTo(-68, -62, -40, -94, 0, -92);
    ctx.bezierCurveTo(46, -96, 72, -58, 60, -2);
    ctx.bezierCurveTo(54, -34, 40, -50, 10, -52);
    ctx.bezierCurveTo(-10, -42, -40, -48, -52, -30);
    ctx.closePath();
    ctx.fill();
    ellipse(ctx, -8, -82, 46, 18, -0.15);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-10, -40, 44, -2.4, -1.7);
    ctx.stroke();
    // aviators parked on the head
    ctx.fillStyle = '#0d0d0d';
    ellipse(ctx, -21, -70, 17, 10, -0.08);
    ctx.fill();
    ellipse(ctx, 21, -70, 17, 10, 0.08);
    ctx.fill();
    ctx.fillRect(-6, -73, 12, 3);
    ctx.fillStyle = 'rgba(120,200,255,.35)';
    ellipse(ctx, -25, -73, 6, 3, -0.3);
    ctx.fill();
    ellipse(ctx, 17, -73, 6, 3, -0.3);
    ctx.fill();

    const raise = (this.talkT > 0 ? Math.abs(Math.sin(t * 6)) * 4 : 0) + this.excite * 7;
    ctx.strokeStyle = HAIR;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 38, -20 - raise + d * 4);
      ctx.quadraticCurveTo(s * 24, -30 - raise, s * 9, -23 - raise);
      ctx.stroke();
    }
    const open = (1 - this.blink) * (1 - Math.min(0.6, d * 0.45));
    for (const s of [-1, 1]) {
      const ex = s * 23;
      const ey = -5;
      ctx.fillStyle = d > 0.45 ? '#f5d2c8' : '#f7f2ea';
      ellipse(ctx, ex, ey, 12, 8.5 * open + 0.4);
      ctx.fill();
      if (open > 0.2) {
        ctx.save();
        ellipse(ctx, ex, ey, 12, 8.5 * open + 0.4);
        ctx.clip();
        ctx.fillStyle = '#2b1a10';
        ellipse(ctx, ex + this.lookX, ey + this.lookY * 0.5, 5.8, 5.8);
        ctx.fill();
        ctx.fillStyle = '#000';
        ellipse(ctx, ex + this.lookX, ey + this.lookY * 0.5, 2.6, 2.6);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ellipse(ctx, ex + this.lookX + 2, ey + this.lookY * 0.5 - 2, 1.4, 1.4);
        ctx.fill();
        ctx.restore();
      }
      ctx.strokeStyle = SKIN_D;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(ex, ey, 12.5, 9 * open + 0.6, 0, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = SKIN_D;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.quadraticCurveTo(-12, 20, -5, 25);
    ctx.lineTo(9, 26);
    ctx.stroke();
    ctx.fillStyle = 'rgba(60,30,15,.6)';
    ellipse(ctx, -5, 25, 3, 2);
    ctx.fill();
    ellipse(ctx, 7, 25, 3, 2);
    ctx.fill();

    const talk = this.talkT > 0 ? Math.abs(Math.sin(t * 15)) * 0.8 + 0.2 : 0;
    if (talk > 0) {
      ctx.fillStyle = '#3a0d0d';
      ellipse(ctx, 0, 47, 16, 4 + talk * 10);
      ctx.fill();
      ctx.fillStyle = '#c0504d';
      ellipse(ctx, 0, 51 + talk * 4, 9, 2 + talk * 3);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#4a1a12';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(0, 30, 20 + this.excite * 4, 0.22 * Math.PI, 0.78 * Math.PI);
      ctx.stroke();
    }
    // the moustache. the pride.
    ctx.fillStyle = HAIR;
    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.bezierCurveTo(-18, 23, -40, 26, -47, 46);
    ctx.bezierCurveTo(-36, 38, -18, 40, 0, 38);
    ctx.bezierCurveTo(18, 40, 36, 38, 47, 46);
    ctx.bezierCurveTo(40, 26, 18, 23, 0, 30);
    ctx.fill();
    ctx.restore();
  }

  // Arm + glass drawn in front of the table.
  drawFront(ctx, t) {
    const cx = this.cx + this.sway;
    const breathe = Math.sin(this.t * 1.8) * 2;
    const sx = cx + 116;
    const sy = 525 + breathe;
    const arm = solveIK(sx, sy, this.hand.x + 10, this.hand.y + 4, 150, 145, -1);
    limb(ctx, sx, sy, arm.ex, arm.ey, arm.hx, arm.hy, '#a82a2a', SKIN, 46, 30);
    ctx.strokeStyle = 'rgba(25,15,40,.35)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(arm.ex, arm.ey);
    ctx.stroke();
    // watch
    const wx = lerp(arm.ex, arm.hx, 0.78);
    const wy = lerp(arm.ey, arm.hy, 0.78);
    ctx.fillStyle = '#d4af37';
    ellipse(ctx, wx, wy, 11, 11);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ellipse(ctx, wx, wy, 6, 6);
    ctx.fill();
    drawSmallGlass(ctx, this.hand.x, this.hand.y, this.glassAngle, this.glassLevel, t);
    ctx.fillStyle = SKIN;
    ellipse(ctx, this.hand.x + 22, this.hand.y + 2, 17, 21);
    ctx.fill();
    ctx.strokeStyle = SKIN_D;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(this.hand.x + 8, this.hand.y - 8 + i * 9);
      ctx.lineTo(this.hand.x + 18, this.hand.y - 8 + i * 9);
      ctx.stroke();
    }
  }

  drawBubble(ctx) {
    drawBubble(ctx, this.bubble, { x: 22, y: 292, ax: 236 + this.sway, ay: 300, maxW: 400 });
  }
}

export class Waiter {
  constructor() {
    this.x = W + 160;
    this.targetX = this.x;
    this.t = 0;
    this.walk = 0;
    this.bubble = null;
    this.talkT = 0;
    this.hand = { x: this.x - 70, y: 690 };
    this.handTarget = null;
    this.trayNew = 0;
    this.trayEmpty = 0;
    this.opener = false;
    this.carry = null;
  }

  walkTo(x) {
    this.targetX = x;
  }

  get arrived() {
    return Math.abs(this.x - this.targetX) < 3;
  }

  get bob() {
    return -Math.abs(Math.sin(this.walk)) * 9;
  }

  say(text) {
    this.bubble = { text, age: 0, dur: clamp(1.6 + text.length * 0.06, 2.2, 4.5) };
    this.talkT = clamp(text.length * 0.05, 0.6, 2.5);
  }

  update(dt) {
    this.t += dt;
    const dx = this.targetX - this.x;
    const step = clamp(dx, -950 * dt, 950 * dt);
    this.x += step;
    if (Math.abs(step) > 0.3) this.walk += dt * 13;
    else this.walk = smooth(this.walk, Math.round(this.walk / Math.PI) * Math.PI, 10, dt);
    this.talkT = Math.max(0, this.talkT - dt);
    if (this.bubble) {
      this.bubble.age += dt;
      if (this.bubble.age > this.bubble.dur) this.bubble = null;
    }
    const tx = this.handTarget ? this.handTarget.x : this.x - 78;
    const ty = this.handTarget ? this.handTarget.y : 690 + this.bob;
    this.hand.x = smooth(this.hand.x, tx, 14, dt);
    this.hand.y = smooth(this.hand.y, ty, 14, dt);
  }

  get visible() {
    return this.x < W + 150;
  }

  // Render layer: in front of the player, behind the table.
  drawMid(ctx) {
    if (!this.visible) return;
    const t = this.t;
    const bob = this.bob;
    const skin = '#8a5634';
    const skinD = '#6a3f22';
    ctx.save();
    ctx.translate(this.x, bob);

    const trayArm = solveIK(62, 522, 126, 604, 100, 96, 1);
    limb(ctx, 62, 522, trayArm.ex, trayArm.ey, trayArm.hx, trayArm.hy, skin, skin, 26, 22);

    ctx.beginPath();
    ctx.moveTo(-30, 452);
    ctx.quadraticCurveTo(-80, 466, -84, 520);
    ctx.lineTo(-94, 800);
    ctx.lineTo(94, 800);
    ctx.lineTo(84, 520);
    ctx.quadraticCurveTo(80, 466, 30, 452);
    ctx.closePath();
    const g = ctx.createLinearGradient(-90, 0, 90, 0);
    g.addColorStop(0, '#cfc8b6');
    g.addColorStop(0.4, '#f6f3ea');
    g.addColorStop(1, '#c9c1ad');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = skin;
    ellipse(ctx, 0, 462, 30, 22);
    ctx.fill();
    ellipse(ctx, -72, 506, 16, 26, 0.3);
    ctx.fill();
    ellipse(ctx, 72, 506, 16, 26, -0.3);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,160,60,.25)';
    ellipse(ctx, -30, 640, 22, 14);
    ctx.fill();
    ellipse(ctx, 40, 700, 16, 10);
    ctx.fill();
    // name badge
    ctx.fillStyle = '#1d4ed8';
    ctx.fillRect(18, 560, 58, 20);
    ctx.fillStyle = '#fff';
    ctx.font = '800 12px "Baloo 2", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('CHHOTU', 47, 571);
    // towel over shoulder
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-84, 470);
    ctx.lineTo(-40, 462);
    ctx.lineTo(-52, 640);
    ctx.lineTo(-92, 646);
    ctx.closePath();
    ctx.fillStyle = '#c62828';
    ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    for (let y = 470; y < 650; y += 18) ctx.fillRect(-100, y, 70, 5);
    for (let x = -96; x < -36; x += 16) ctx.fillRect(x, 460, 4, 190);
    ctx.restore();

    ctx.fillStyle = skinD;
    ctx.fillRect(-20, 414, 40, 44);
    // head
    ctx.save();
    ctx.translate(0, 382);
    ctx.rotate(Math.sin(this.walk) * 0.05);
    ctx.fillStyle = skinD;
    ellipse(ctx, -50, 6, 10, 16);
    ctx.fill();
    ellipse(ctx, 50, 6, 10, 16);
    ctx.fill();
    ctx.fillStyle = skin;
    ellipse(ctx, 0, 0, 50, 62);
    ctx.fill();
    ctx.fillStyle = '#0f0c0a';
    ctx.beginPath();
    ctx.moveTo(-52, -6);
    for (let i = 0; i <= 10; i++) ctx.lineTo(-52 + i * 10.4, -62 - (i % 2) * 14 + Math.abs(i - 5) * 3);
    ctx.lineTo(52, -6);
    ctx.quadraticCurveTo(40, -40, 0, -42);
    ctx.quadraticCurveTo(-40, -40, -52, -6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    for (const s of [-1, 1]) {
      ellipse(ctx, s * 19, -6, 10, 8);
      ctx.fill();
    }
    ctx.fillStyle = '#1a0f08';
    for (const s of [-1, 1]) {
      ellipse(ctx, s * 19 - 4, -5, 4.6, 4.6);
      ctx.fill();
    }
    ctx.strokeStyle = '#0f0c0a';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 30, -26);
      ctx.lineTo(s * 9, -30);
      ctx.stroke();
    }
    ctx.strokeStyle = skinD;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -2);
    ctx.quadraticCurveTo(-8, 16, 4, 20);
    ctx.stroke();
    const talk = this.talkT > 0 ? Math.abs(Math.sin(t * 16)) : 0;
    ctx.fillStyle = '#3a0d0d';
    ctx.beginPath();
    ctx.ellipse(0, 36, 22, 9 + talk * 6, 0, 0, Math.PI);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-16, 36, 32, 5);
    ctx.strokeStyle = '#0f0c0a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-18, 28);
    ctx.quadraticCurveTo(0, 22, 18, 28);
    ctx.stroke();
    // sweat drop
    const sy = -30 + ((t * 20) % 40);
    ctx.fillStyle = 'rgba(140,200,255,.85)';
    ellipse(ctx, 34, sy, 3.5, 5);
    ctx.fill();
    ctx.restore();

    // tray with bottles
    const tx = 152;
    const ty = 604;
    for (let i = 0; i < this.trayNew; i++) miniBottle(ctx, tx - 44 + i * 26, ty - 4, true, 0);
    for (let i = 0; i < this.trayEmpty; i++) miniBottle(ctx, tx - 30 + i * 18, ty - 10, false, 1.35);
    const tg = ctx.createLinearGradient(0, ty - 14, 0, ty + 14);
    tg.addColorStop(0, '#f1f1f1');
    tg.addColorStop(1, '#8c9096');
    ctx.fillStyle = tg;
    ellipse(ctx, tx, ty + 2, 82, 15);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = skin;
    ellipse(ctx, 126, 610, 14, 11);
    ctx.fill();
    ctx.restore();
  }

  // Render layer: on top of the bottles (his serving arm).
  drawTop(ctx) {
    if (!this.visible) return;
    const sx = this.x - 60;
    const sy = 524 + this.bob;
    const arm = solveIK(sx, sy, this.hand.x, this.hand.y, 135, 135, -1);
    limb(ctx, sx, sy, arm.ex, arm.ey, arm.hx, arm.hy, '#8a5634', '#8a5634', 26, 22);
    ctx.fillStyle = '#8a5634';
    ellipse(ctx, arm.hx, arm.hy, 15, 13);
    ctx.fill();
    if (this.opener) {
      ctx.save();
      ctx.translate(arm.hx, arm.hy);
      ctx.rotate(-0.6 + Math.sin(this.t * 20) * 0.1);
      ctx.fillStyle = '#c0c4c8';
      ctx.fillRect(-4, -34, 9, 40);
      ctx.strokeStyle = '#c0c4c8';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, -40, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawBubble(ctx) {
    if (!this.visible) return;
    drawBubble(ctx, this.bubble, { x: this.x - 40, y: 300, ax: this.x - 30, ay: 330, align: 'right', bg: '#fff3c4', maxW: 300 });
  }
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
  ctx.fillStyle = '#c8161d';
  ctx.fillRect(-9, -34, 18, 16);
  if (capped) {
    ctx.fillStyle = '#d4a017';
    ctx.fillRect(-5, -76, 10, 5);
  }
  ctx.restore();
}

// Stand-in for the player when there's no camera.
export function drawPlaceholder(ctx, t) {
  const x = 960;
  const y = 330 + Math.sin(t * 1.5) * 3;
  ctx.save();
  const g = ctx.createLinearGradient(0, 420, 0, 900);
  g.addColorStop(0, '#34344a');
  g.addColorStop(1, '#1c1c28');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x - 60, 440);
  ctx.quadraticCurveTo(x - 200, 470, x - 220, 560);
  ctx.lineTo(x - 250, 900);
  ctx.lineTo(x + 250, 900);
  ctx.lineTo(x + 220, 560);
  ctx.quadraticCurveTo(x + 200, 470, x + 60, 440);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#3e3e56';
  ctx.beginPath();
  ctx.ellipse(x, y, 86, 104, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + s * 30, y - 12, 9, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.75)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y + 30, 26, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  ctx.font = '700 20px "Baloo 2", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('📷 camera off — mouse mode', x, y + 160);
  ctx.restore();
}
