// The theka itself: peeling green walls, iron-grill counter, flickering tube
// light, cricket on an old TV, festival string lights, red plastic table + chakna.
// Static parts are painted once to offscreen canvases; animated parts every frame.
import { W, H, TABLE_Y, makeCanvas, rand, pick, clamp, easeOutBack } from './util.js';

const DEVA = '"Baloo 2", "Kohinoor Devanagari", "Noto Sans Devanagari", sans-serif';
const BULBS = ['#ff4040', '#ffd23f', '#43ff7a', '#40b8ff', '#ff5bd1'];

export class Scene {
  constructor(rs) {
    this.bg = makeCanvas(W * rs, H * rs);
    const b = this.bg.getContext('2d');
    b.scale(rs, rs);
    paintBackground(b);

    this.tableTop = TABLE_Y - 14;
    this.table = makeCanvas(W * rs, (H - this.tableTop) * rs);
    const t = this.table.getContext('2d');
    t.scale(rs, rs);
    t.translate(0, -this.tableTop);
    paintTable(t);

    this.dust = Array.from({ length: 50 }, () => ({
      x: rand(0, W),
      y: rand(0, 700),
      vx: rand(-8, 8),
      vy: rand(-5, 5),
      r: rand(0.7, 2.2),
      a: rand(0.15, 0.5),
    }));
    this.tv = { runs: 212, wkts: 3, balls: 229, next: 2, gap: 3, event: null, eventT: 0 };
    this.flicker = 0;
    this.onEvent = null;
  }

  update(dt, t) {
    for (const d of this.dust) {
      d.x += (d.vx + Math.sin(t * 0.3 + d.y * 0.01) * 4) * dt;
      d.y += d.vy * dt;
      if (d.x < 0) d.x += W;
      if (d.x > W) d.x -= W;
      if (d.y < 0) d.y += 700;
      if (d.y > 700) d.y -= 700;
    }
    if (this.flicker > 0) this.flicker -= dt;
    else if (Math.random() < dt * 0.05) this.flicker = rand(0.25, 0.8);

    const tv = this.tv;
    tv.next -= dt;
    if (tv.eventT > 0) tv.eventT -= dt;
    if (tv.next <= 0) {
      tv.balls++;
      const r = pick([0, 0, 1, 1, 1, 2, 4, 6, 'W', 0, 1, 4, 1, 0]);
      if (r === 'W') tv.wkts = Math.min(9, tv.wkts + 1);
      else tv.runs += r;
      if (r === 4 || r === 6 || r === 'W') {
        tv.event = r === 'W' ? 'OUT!' : r === 6 ? 'SIX!' : 'FOUR!';
        tv.eventT = 1.8;
        this.onEvent?.(tv.event);
      }
      tv.gap = rand(2.6, 4.2);
      tv.next = tv.gap;
    }
  }

  drawBack(ctx, t) {
    ctx.drawImage(this.bg, 0, 0, W, H);
    this.drawTV(ctx, t);
    this.drawTube(ctx, t);
    this.drawStringLights(ctx, t);
    this.drawDust(ctx);
  }

  drawTable(ctx) {
    ctx.drawImage(this.table, 0, this.tableTop, W, H - this.tableTop);
  }

  drawTube(ctx, t) {
    const on = this.flicker > 0 && Math.random() < 0.5 ? 0.2 : 1;
    const x = 690;
    const y = 36;
    const w = 290;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x + w / 2, y + 6, 10, x + w / 2, y + 80, 430);
    g.addColorStop(0, `rgba(200,255,235,${0.3 * on})`);
    g.addColorStop(1, 'rgba(200,255,235,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 420, 0, w + 840, 540);
    ctx.restore();
    ctx.fillStyle = '#cfcfc8';
    ctx.fillRect(x - 12, y - 6, w + 24, 8);
    ctx.fillStyle = on > 0.5 ? '#f4fffb' : '#9aa5a0';
    ctx.beginPath();
    ctx.roundRect(x, y, w, 12, 6);
    ctx.fill();
    ctx.fillStyle = '#555';
    ctx.fillRect(x - 8, y - 2, 10, 16);
    ctx.fillRect(x + w - 2, y - 2, 10, 16);
    // moths doing their thing
    for (let i = 0; i < 3; i++) {
      const mx = x + w / 2 + Math.sin(t * (2 + i) + i) * 130;
      const my = y + 32 + Math.cos(t * (3 + i) * 0.9 + i * 2) * 22;
      ctx.fillStyle = 'rgba(40,30,20,.85)';
      ctx.beginPath();
      ctx.ellipse(mx, my, 3.2, 1 + Math.abs(Math.sin(t * 40 + i)) * 2.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawStringLights(ctx, t) {
    const x1 = 1110;
    const sag = 38;
    const y0 = 8;
    const yAt = (x) => {
      const u = x / x1;
      return y0 + sag * 4 * u * (1 - u);
    };
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= x1; x += 20) (x === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, yAt(x));
    ctx.stroke();
    let i = 0;
    for (let x = 20; x < x1; x += 38, i++) {
      const y = yAt(x) + 7;
      const col = BULBS[i % BULBS.length];
      const on = Math.sin(t * 3.2 - i * 0.7) > -0.3;
      if (on) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const g = ctx.createRadialGradient(x, y, 0, x, y, 24);
        g.addColorStop(0, col + 'aa');
        g.addColorStop(1, col + '00');
        ctx.fillStyle = g;
        ctx.fillRect(x - 24, y - 24, 48, 48);
        ctx.restore();
      }
      ctx.fillStyle = on ? col : '#333';
      ctx.beginPath();
      ctx.ellipse(x, y, 4.5, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawTV(ctx, t) {
    const x = 412;
    const y = 46;
    const w = 228;
    const h = 138;
    const tv = this.tv;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const fl = 0.75 + 0.25 * Math.sin(t * 11) * Math.sin(t * 2.3);
    const g = ctx.createRadialGradient(x + w / 2, y + h / 2, 30, x + w / 2, y + h / 2, 250);
    g.addColorStop(0, `rgba(120,180,255,${0.16 * fl})`);
    g.addColorStop(1, 'rgba(120,180,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 250, y - 200, w + 500, h + 420);
    ctx.restore();

    ctx.fillStyle = '#0c0c0c';
    ctx.beginPath();
    ctx.roundRect(x - 12, y - 12, w + 24, h + 30, 8);
    ctx.fill();
    ctx.fillStyle = '#e33';
    ctx.beginPath();
    ctx.arc(x + w - 4, y + h + 9, 2.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    const fg = ctx.createLinearGradient(0, y, 0, y + h);
    fg.addColorStop(0, '#3f9c45');
    fg.addColorStop(1, '#23702b');
    ctx.fillStyle = fg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.06)';
    for (let i = 0; i < 8; i += 2) ctx.fillRect(x + i * 29, y, 29, h);
    const px = x + w / 2;
    ctx.fillStyle = '#cdb67e';
    ctx.beginPath();
    ctx.moveTo(px - 14, y + 18);
    ctx.lineTo(px + 14, y + 18);
    ctx.lineTo(px + 26, y + h - 30);
    ctx.lineTo(px - 26, y + h - 30);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(px - 5, y + 20, 10, 3);
    ctx.fillRect(px - 8, y + h - 36, 16, 4);
    ctx.fillStyle = '#0b2a6b';
    [[-80, 30], [70, 40], [-60, 90], [90, 85], [0, 12]].forEach(([fx, fy]) => ctx.fillRect(px + fx, y + fy, 4, 6));
    const k = 1 - tv.next / tv.gap;
    const run = clamp(k / 0.55, 0, 1);
    ctx.fillStyle = '#1e3a8a';
    ctx.beginPath();
    ctx.arc(px + 2, y + 6 + run * 16, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px - 3, y + h - 48, 6, 12);
    if (k > 0.55 && k < 0.8) {
      const bb = (k - 0.55) / 0.25;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(px, y + 24 + bb * (h - 66), 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(8,24,70,.92)';
    ctx.fillRect(x, y + h - 24, w, 24);
    ctx.fillStyle = '#ff9933';
    ctx.fillRect(x, y + h - 24, 5, 24);
    ctx.fillStyle = '#fff';
    ctx.font = '700 15px "Baloo 2", sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(`IND ${tv.runs}/${tv.wkts}`, x + 12, y + h - 11);
    ctx.textAlign = 'right';
    ctx.fillText(`${Math.floor(tv.balls / 6)}.${tv.balls % 6} ov`, x + w - 8, y + h - 11);
    ctx.textAlign = 'left';
    ctx.fillStyle = Math.sin(t * 4) > 0 ? '#ff3030' : '#aa1010';
    ctx.font = '800 11px "Baloo 2", sans-serif';
    ctx.fillText('● LIVE', x + 8, y + 11);
    if (tv.eventT > 0) {
      const a = 1.8 - tv.eventT;
      const s = a < 0.3 ? easeOutBack(a / 0.3) : 1;
      ctx.save();
      ctx.translate(px, y + h / 2 - 8);
      ctx.scale(s, s);
      ctx.font = '52px Bangers, Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#000';
      ctx.strokeText(tv.event, 0, 0);
      ctx.fillStyle = tv.event === 'OUT!' ? '#ff4d4d' : '#ffd23f';
      ctx.fillText(tv.event, 0, 0);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    for (let sy = y; sy < y + h; sy += 3) ctx.fillRect(x, sy, w, 1);
    const gl = ctx.createLinearGradient(x, y, x + w, y + h);
    gl.addColorStop(0, 'rgba(255,255,255,.14)');
    gl.addColorStop(0.4, 'rgba(255,255,255,0)');
    ctx.fillStyle = gl;
    ctx.fillRect(x, y, w, h);
    ctx.restore();
  }

  drawDust(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const d of this.dust) {
      ctx.fillStyle = `rgba(255,240,200,${d.a})`;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- static paint

function blob(c, x, y, r, n = 9) {
  c.beginPath();
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const rr = r * rand(0.55, 1.2);
    c.lineTo(x + Math.cos(a) * rr * 1.3, y + Math.sin(a) * rr);
  }
  c.closePath();
}

function paintBackground(c) {
  let g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#3f8072');
  g.addColorStop(0.5, '#316b5f');
  g.addColorStop(1, '#244f47');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);

  // lower oil-paint band, very government-office
  g = c.createLinearGradient(0, 540, 0, H);
  g.addColorStop(0, '#22557a');
  g.addColorStop(1, '#12324a');
  c.fillStyle = g;
  c.fillRect(0, 540, W, H - 540);
  c.fillStyle = '#d9b64a';
  c.fillRect(0, 533, W, 7);
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.fillRect(0, 540, W, 4);

  for (let i = 0; i < 20; i++) {
    const x = rand(0, W);
    const y = pick([rand(0, 130), rand(470, 720), rand(0, H)]);
    const r = rand(50, 230);
    const rg = c.createRadialGradient(x, y, 0, x, y, r);
    rg.addColorStop(0, 'rgba(45,35,10,0.22)');
    rg.addColorStop(1, 'rgba(45,35,10,0)');
    c.fillStyle = rg;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 11; i++) {
    const x = rand(0, W);
    const y = rand(60, 720);
    blob(c, x, y, rand(12, 38));
    c.fillStyle = y > 540 ? 'rgba(160,170,160,.32)' : 'rgba(200,210,190,.32)';
    c.fill();
    c.strokeStyle = 'rgba(0,0,0,.22)';
    c.lineWidth = 1.2;
    c.stroke();
  }
  for (let i = 0; i < 3500; i++) {
    c.fillStyle = `rgba(0,0,0,${rand(0.02, 0.09)})`;
    const s = rand(0.8, 2.6);
    c.fillRect(rand(0, W), rand(0, H), s, s);
  }
  for (let i = 0; i < 1200; i++) {
    c.fillStyle = `rgba(255,255,255,${rand(0.01, 0.05)})`;
    c.fillRect(rand(0, W), rand(0, H), 1.5, 1.5);
  }
  c.strokeStyle = 'rgba(0,0,0,.28)';
  c.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    let x = rand(0, W);
    let y = rand(0, 480);
    c.beginPath();
    c.moveTo(x, y);
    for (let k = 0; k < 14; k++) {
      x += rand(-12, 12);
      y += rand(2, 14);
      c.lineTo(x, y);
    }
    c.stroke();
  }
  // legendary paan stains in the corner
  for (let i = 0; i < 7; i++) {
    blob(c, rand(1430, 1590), rand(590, 720), rand(6, 22), 12);
    c.fillStyle = `rgba(130,25,15,${rand(0.25, 0.45)})`;
    c.fill();
  }

  // ceiling shadow
  g = c.createLinearGradient(0, 0, 0, 90);
  g.addColorStop(0, 'rgba(0,0,0,.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, 90);

  paintWires(c);
  paintGrill(c);
  paintSign(c);
  paintNoUdhaar(c);
  paintCalendar(c);
  // TV wall bracket
  c.fillStyle = '#1b1b1b';
  c.fillRect(516, 180, 20, 34);
  c.fillRect(496, 208, 60, 8);
}

function paintWires(c) {
  c.strokeStyle = '#121212';
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(980, 42);
  c.bezierCurveTo(1030, 60, 1060, 50, 1085, 70);
  c.lineTo(1090, 440);
  c.stroke();
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(526, 212);
  c.bezierCurveTo(540, 300, 600, 260, 620, 420);
  c.bezierCurveTo(630, 480, 660, 470, 680, 470);
  c.stroke();
  // switchboard
  c.fillStyle = 'rgba(0,0,0,.3)';
  c.fillRect(1062, 446, 70, 84);
  c.fillStyle = '#e6dec6';
  c.fillRect(1056, 440, 70, 84);
  c.fillStyle = '#222';
  for (let i = 0; i < 3; i++) c.fillRect(1066 + i * 19, 456, 11, 18);
  c.fillStyle = '#c0392b';
  c.beginPath();
  c.arc(1091, 500, 8, 0, Math.PI * 2);
  c.fill();
}

function paintSign(c) {
  const x = 1128;
  const y = 16;
  const w = 462;
  const h = 98;
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.fillRect(x + 7, y + 8, w, h);
  const g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#ffd23f');
  g.addColorStop(1, '#e8a90f');
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  c.strokeStyle = '#b3160e';
  c.lineWidth = 6;
  c.strokeRect(x + 6, y + 6, w - 12, h - 12);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#b3160e';
  c.font = `800 42px ${DEVA}`;
  c.fillText('अंग्रेज़ी शराब ठेका', x + w / 2, y + 42);
  c.fillStyle = '#1b1b1b';
  c.font = '800 16px "Baloo 2", sans-serif';
  c.fillText('BHAI KA THEKA  •  BEER & WINE SHOP  •  LIC. NO. 420', x + w / 2, y + 78);
  for (let i = 0; i < 12; i++) {
    c.fillStyle = 'rgba(120,60,10,.22)';
    c.fillRect(x + rand(0, w), y + h - 3, rand(2, 5), rand(8, 34));
  }
}

function shelfBottle(c, cx, base, bw, bh, color, clear) {
  c.fillStyle = color;
  c.beginPath();
  c.moveTo(cx - bw / 2, base);
  c.lineTo(cx - bw / 2, base - bh * 0.62);
  c.quadraticCurveTo(cx - bw / 2, base - bh * 0.76, cx - bw * 0.18, base - bh * 0.8);
  c.lineTo(cx - bw * 0.18, base - bh);
  c.lineTo(cx + bw * 0.18, base - bh);
  c.lineTo(cx + bw * 0.18, base - bh * 0.8);
  c.quadraticCurveTo(cx + bw / 2, base - bh * 0.76, cx + bw / 2, base - bh * 0.62);
  c.lineTo(cx + bw / 2, base);
  c.closePath();
  c.fill();
  if (clear) {
    c.fillStyle = 'rgba(220,140,40,.65)';
    c.fillRect(cx - bw / 2 + 2, base - bh * 0.52, bw - 4, bh * 0.52 - 2);
  }
  c.fillStyle = pick(['#f2e6c9', '#e9c46a', '#d62828', '#ffffff', '#90be6d', '#48cae4']);
  c.fillRect(cx - bw / 2, base - bh * 0.46, bw, bh * 0.22);
  c.fillStyle = 'rgba(255,255,255,.35)';
  c.fillRect(cx - bw / 2 + 3, base - bh * 0.75, 2.5, bh * 0.6);
}

function paintGrill(c) {
  const x = 1150;
  const y = 134;
  const w = 430;
  const h = 370;
  c.fillStyle = '#b9b1a0';
  c.fillRect(x - 20, y - 16, w + 40, h + 44);
  c.fillStyle = 'rgba(0,0,0,.28)';
  c.fillRect(x - 20, y + h + 26, w + 40, 8);
  let g = c.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#2d1c0d');
  g.addColorStop(1, '#140c05');
  c.fillStyle = g;
  c.fillRect(x, y, w, h);
  const rg = c.createRadialGradient(x + w / 2, y + 30, 10, x + w / 2, y + 60, 330);
  rg.addColorStop(0, 'rgba(255,200,90,.6)');
  rg.addColorStop(1, 'rgba(255,160,40,0)');
  c.fillStyle = rg;
  c.fillRect(x, y, w, h);
  const colors = ['#3b1f0e', '#1f4d1f', '#7a4a12', '#2a2a5a', '#8a1c1c', '#5a3b12', '#244a3a'];
  for (const sy of [y + 118, y + 226, y + 334]) {
    let bx = x + 10;
    while (bx < x + w - 24) {
      const bw = rand(15, 22);
      const clear = Math.random() < 0.25;
      shelfBottle(c, bx + bw / 2, sy, bw, rand(58, 92), clear ? 'rgba(210,210,220,.5)' : pick(colors), clear);
      bx += bw + rand(3, 8);
    }
    c.fillStyle = '#6b4422';
    c.fillRect(x, sy, w, 10);
    c.fillStyle = '#8a5a30';
    c.fillRect(x, sy, w, 3);
  }
  c.strokeStyle = '#222';
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(x + w / 2, y);
  c.lineTo(x + w / 2, y + 16);
  c.stroke();
  c.fillStyle = '#fff3c4';
  c.beginPath();
  c.arc(x + w / 2, y + 27, 11, 0, Math.PI * 2);
  c.fill();
  // iron grill
  for (let bx = x + 14; bx < x + w; bx += 32) {
    const bg = c.createLinearGradient(bx - 4, 0, bx + 4, 0);
    bg.addColorStop(0, '#1c1c1c');
    bg.addColorStop(0.5, '#707070');
    bg.addColorStop(1, '#1c1c1c');
    c.fillStyle = bg;
    c.fillRect(bx - 4, y, 8, h - 72);
  }
  for (const hy of [y + 2, y + (h - 72) / 2, y + h - 74]) {
    c.fillStyle = '#2a2a2a';
    c.fillRect(x, hy, w, 9);
    c.fillStyle = '#5c5c5c';
    c.fillRect(x, hy, w, 2);
  }
  for (let i = 0; i < 30; i++) {
    c.fillStyle = `rgba(140,70,20,${rand(0.2, 0.5)})`;
    c.fillRect(x + rand(0, w), y + rand(0, h - 72), rand(2, 6), rand(2, 8));
  }
  c.fillStyle = '#8c8472';
  c.fillRect(x - 12, y + h - 8, w + 24, 28);
  c.fillStyle = '#a79f8b';
  c.fillRect(x - 12, y + h - 8, w + 24, 5);
  // rate list taped on the counter
  c.save();
  c.translate(x + 60, y + h - 40);
  c.rotate(-0.05);
  c.fillStyle = '#fbf6e9';
  c.fillRect(-44, -26, 96, 56);
  c.fillStyle = '#b3160e';
  c.font = '800 12px "Baloo 2", sans-serif';
  c.textAlign = 'left';
  c.textBaseline = 'top';
  c.fillText('RATE LIST', -36, -22);
  c.fillStyle = '#222';
  c.font = '600 10px "Baloo 2", sans-serif';
  c.fillText('HAATHI ....... 160', -36, -8);
  c.fillText('BHAI 8% ...... 150', -36, 4);
  c.fillText('CHAKNA ....... FREE', -36, 16);
  c.restore();
}

function paintNoUdhaar(c) {
  c.save();
  c.translate(835, 142);
  c.rotate(-0.03);
  c.strokeStyle = '#333';
  c.lineWidth = 1.5;
  c.beginPath();
  c.moveTo(-90, -48);
  c.lineTo(0, -80);
  c.lineTo(90, -48);
  c.stroke();
  c.fillStyle = 'rgba(0,0,0,.35)';
  c.fillRect(-118, -44, 244, 104);
  c.fillStyle = '#f4efe4';
  c.fillRect(-124, -50, 244, 104);
  c.strokeStyle = '#c1121f';
  c.lineWidth = 5;
  c.strokeRect(-118, -44, 232, 92);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = '#c1121f';
  c.font = `800 34px ${DEVA}`;
  c.fillText('आज नकद', -4, -14);
  c.fillStyle = '#222';
  c.font = `800 28px ${DEVA}`;
  c.fillText('कल उधार', -4, 24);
  c.fillStyle = '#222';
  c.beginPath();
  c.arc(0, -80, 3, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function paintCalendar(c) {
  c.save();
  c.translate(356, 238);
  c.rotate(0.05);
  c.fillStyle = 'rgba(0,0,0,.3)';
  c.fillRect(-32, -44, 72, 100);
  c.fillStyle = '#f5f0e6';
  c.fillRect(-38, -50, 72, 100);
  c.fillStyle = '#c1121f';
  c.fillRect(-38, -50, 72, 18);
  c.fillStyle = '#fff';
  c.font = '800 11px "Baloo 2", sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('SEPT 2026', -2, -41);
  const g = c.createLinearGradient(0, -30, 0, 0);
  g.addColorStop(0, '#7cc6f2');
  g.addColorStop(1, '#f7d794');
  c.fillStyle = g;
  c.fillRect(-32, -28, 60, 30);
  c.fillStyle = '#3c8d3c';
  c.beginPath();
  c.moveTo(-32, 2);
  c.lineTo(-12, -14);
  c.lineTo(4, -4);
  c.lineTo(18, -18);
  c.lineTo(28, 2);
  c.fill();
  c.fillStyle = '#555';
  for (let r = 0; r < 4; r++) for (let k = 0; k < 6; k++) c.fillRect(-30 + k * 10, 10 + r * 9, 5, 4);
  c.restore();
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
  g.addColorStop(0, '#8d1d15');
  g.addColorStop(0.18, '#b52a1f');
  g.addColorStop(1, '#d23b2c');
  c.fillStyle = g;
  c.fill();
  const hg = c.createRadialGradient(800, top + 70, 20, 800, top + 70, 760);
  hg.addColorStop(0, 'rgba(255,220,200,.22)');
  hg.addColorStop(1, 'rgba(255,220,200,0)');
  c.fillStyle = hg;
  c.fillRect(0, top, W, H - top);
  c.fillStyle = '#e35a47';
  c.fillRect(-20, top, W + 40, 3);
  c.fillStyle = 'rgba(0,0,0,.25)';
  c.fillRect(-20, top + 3, W + 40, 3);

  c.strokeStyle = 'rgba(0,0,0,.07)';
  c.lineWidth = 2;
  for (let r = 1; r <= 6; r++) {
    c.beginPath();
    c.ellipse(800, H + 80, 150 * r, 36 * r, 0, 0, Math.PI * 2);
    c.stroke();
  }
  for (let i = 0; i < 10; i++) {
    c.strokeStyle = 'rgba(255,255,255,.07)';
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(rand(80, 1520), rand(top + 40, H - 20), rand(34, 48), rand(9, 13), 0, 0, Math.PI * 2);
    c.stroke();
  }
  c.strokeStyle = 'rgba(255,255,255,.06)';
  c.lineWidth = 1;
  for (let i = 0; i < 40; i++) {
    const x = rand(0, W);
    const y = rand(top + 10, H);
    c.beginPath();
    c.moveTo(x, y);
    c.lineTo(x + rand(-40, 40), y + rand(-4, 4));
    c.stroke();
  }

  // newspaper + chakna plate
  c.save();
  c.translate(480, 862);
  c.rotate(-0.08);
  c.fillStyle = '#e6dcc3';
  c.fillRect(-125, -42, 250, 100);
  c.fillStyle = '#222';
  c.font = '800 15px "Baloo 2", sans-serif';
  c.textAlign = 'left';
  c.textBaseline = 'top';
  c.fillText('THEKA TIMES', -115, -38);
  c.fillStyle = 'rgba(0,0,0,.35)';
  for (let r = 0; r < 7; r++) c.fillRect(-115, -16 + r * 9, rand(80, 230), 3);
  c.restore();

  const px = 480;
  const py = 866;
  const pg = c.createRadialGradient(px - 22, py - 8, 5, px, py, 100);
  pg.addColorStop(0, '#f5f5f5');
  pg.addColorStop(0.6, '#b8bcc2');
  pg.addColorStop(1, '#7d8288');
  c.fillStyle = 'rgba(0,0,0,.3)';
  c.beginPath();
  c.ellipse(px + 4, py + 8, 94, 28, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = pg;
  c.beginPath();
  c.ellipse(px, py, 94, 28, 0, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(0,0,0,.18)';
  c.beginPath();
  c.ellipse(px, py, 72, 20, 0, 0, Math.PI * 2);
  c.stroke();
  // bhujia
  c.strokeStyle = '#d9a032';
  c.lineWidth = 2;
  for (let i = 0; i < 60; i++) {
    const x = px + rand(-10, 60);
    const y = py + rand(-14, 8);
    c.beginPath();
    c.moveTo(x, y);
    c.quadraticCurveTo(x + rand(-8, 8), y + rand(-6, 2), x + rand(-10, 10), y + rand(-4, 4));
    c.stroke();
  }
  // peanuts
  for (let i = 0; i < 26; i++) {
    const x = px + rand(-66, 0);
    const y = py + rand(-12, 10);
    c.save();
    c.translate(x, y);
    c.rotate(rand(0, Math.PI));
    c.fillStyle = '#b87838';
    c.beginPath();
    c.ellipse(0, 0, 6.5, 4, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#e0ae72';
    c.beginPath();
    c.ellipse(-1.5, -1.2, 3.5, 1.6, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
  // onion rings + green chilli
  c.strokeStyle = '#b26b9d';
  c.lineWidth = 3;
  c.beginPath();
  c.ellipse(px + 52, py + 6, 14, 6, 0.2, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.ellipse(px + 62, py - 2, 11, 5, -0.2, 0, Math.PI * 2);
  c.stroke();
  c.strokeStyle = '#2f8f2f';
  c.lineWidth = 6;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(px - 74, py + 8);
  c.quadraticCurveTo(px - 50, py + 18, px - 30, py + 12);
  c.stroke();
}
