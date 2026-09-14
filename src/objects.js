// Bottles, the beer jar, and the particle system (beer streams, foam, caps, shards).
// Liquid is simulated per container: the surface stays level with the world while the
// glass rotates, and beer only flows out once the surface reaches the mouth/rim.
import { W, H, BASE_Y, rotate, clamp, rand, segDist } from './util.js';

export const BRANDS = [
  { name: 'HAATHI', sub: 'STRONG BEER', color: '#c8161d', color2: '#7e0b10', ink: '#fff', accent: '#f4c430', emoji: '🐘' },
  { name: 'BHAI', sub: 'SUPER STRONG 8%', color: '#1d4fb8', color2: '#0b2560', ink: '#fff', accent: '#ffb703', emoji: '😎' },
  { name: 'CHILL', sub: 'PREMIUM LAGER', color: '#138a57', color2: '#07422a', ink: '#fff7e0', accent: '#e9d8a6', emoji: '🐯' },
  { name: 'TALLI', sub: 'EXTRA STRONG', color: '#262626', color2: '#000', ink: '#ffd166', accent: '#ef476f', emoji: '🦁' },
];

let uid = 0;
let brandIdx = 0;

function bottlePath(ctx) {
  ctx.beginPath();
  ctx.moveTo(-11, -116);
  ctx.lineTo(-11, -52);
  ctx.bezierCurveTo(-11, -26, -30, -22, -30, 4);
  ctx.lineTo(-30, 107);
  ctx.quadraticCurveTo(-30, 116, -21, 116);
  ctx.lineTo(21, 116);
  ctx.quadraticCurveTo(30, 116, 30, 107);
  ctx.lineTo(30, 4);
  ctx.bezierCurveTo(30, -22, 11, -26, 11, -52);
  ctx.lineTo(11, -116);
  ctx.closePath();
}

export function drawCap(ctx, x, y) {
  ctx.fillStyle = '#d4a017';
  ctx.beginPath();
  ctx.moveTo(x - 14, y - 6);
  ctx.lineTo(x + 14, y - 6);
  for (let i = 0; i <= 7; i++) ctx.lineTo(x + 14 - i * 4, y + 5 + (i % 2) * 3);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.fillRect(x - 10, y - 5, 20, 2);
  ctx.fillStyle = '#b3160e';
  ctx.fillRect(x - 6, y - 2, 12, 3);
}

function liquidSurface(ctx, sy, t, wave, color1, color2, bottom) {
  const g = ctx.createLinearGradient(0, sy, 0, bottom);
  g.addColorStop(0, color1);
  g.addColorStop(1, color2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-220, sy);
  for (let x = -220; x <= 220; x += 16) ctx.lineTo(x, sy + Math.sin(x * 0.05 + t * 8) * wave);
  ctx.lineTo(220, 400);
  ctx.lineTo(-220, 400);
  ctx.closePath();
  ctx.fill();
}

class Vessel {
  constructor() {
    this.id = ++uid;
    this.angle = 0;
    this.vx = 0;
    this.vy = 0;
    this.state = 'table'; // table | held | falling | carried | gone
    this.hover = 0;
    this.wave = 0;
    this.assist = 0;
    this.gripX = 0;
    this.gripY = 0;
  }
  get restY() {
    return BASE_Y - this.h / 2;
  }
  local(lx, ly) {
    const [rx, ry] = rotate(lx, ly, this.angle);
    return [this.x + rx, this.y + ry];
  }
  // Vertical half-extent of the rotated container (for table collision).
  get halfExtent() {
    return (Math.abs(Math.cos(this.angle)) * this.h + Math.abs(Math.sin(this.angle)) * this.w) / 2;
  }
}

export class Bottle extends Vessel {
  constructor(x, y, { capped = false } = {}) {
    super();
    this.kind = 'bottle';
    this.w = 60;
    this.h = 232;
    this.x = x;
    this.y = y ?? this.restY;
    this.level = 1;
    this.capped = capped;
    this.brand = BRANDS[brandIdx++ % BRANDS.length];
    this.drops = Array.from({ length: 16 }, () => [rand(-25, 25), rand(-10, 106), rand(1, 2.8)]);
    this.fizz = 0;
  }

  get mouth() {
    return this.local(0, -this.h / 2 - 2);
  }

  // Beer comes out when the mouth dips below the liquid surface. Returns pixels of "depth".
  pourDepth() {
    const a = this.angle;
    const ext = Math.abs(Math.cos(a)) * this.h + Math.abs(Math.sin(a)) * this.w;
    const surface = ext / 2 - this.level * 0.8 * ext;
    return -(this.h / 2) * Math.cos(a) - surface;
  }

  grabDist(px, py) {
    const [ax, ay] = this.local(0, -this.h / 2 + 24);
    const [bx, by] = this.local(0, this.h / 2 - 12);
    return segDist(px, py, ax, ay, bx, by) - this.w / 2;
  }

  draw(ctx, t) {
    const { w, h } = this;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    if (this.hover > 0.02) {
      ctx.shadowColor = `rgba(255,210,80,${this.hover})`;
      ctx.shadowBlur = 34 * this.hover;
    }
    bottlePath(ctx);
    ctx.fillStyle = 'rgba(40,20,4,0.82)';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';

    if (this.level > 0.004) {
      ctx.save();
      bottlePath(ctx);
      ctx.clip();
      ctx.rotate(-this.angle);
      const ext = Math.abs(Math.cos(this.angle)) * h + Math.abs(Math.sin(this.angle)) * w;
      const sy = ext / 2 - this.level * 0.8 * ext;
      liquidSurface(ctx, sy, t, this.wave, 'rgba(255,184,50,.9)', 'rgba(160,80,8,.95)', ext / 2);
      ctx.fillStyle = 'rgba(255,240,200,.55)';
      for (let i = 0; i < 7; i++) {
        const span = Math.max(1, ext / 2 - sy);
        const by = ext / 2 - ((t * 45 + i * 53) % span);
        ctx.beginPath();
        ctx.arc(((i * 37) % 44) - 22, by, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    bottlePath(ctx);
    ctx.fillStyle = 'rgba(70,30,0,.3)';
    ctx.fill();

    // label
    const b = this.brand;
    ctx.save();
    bottlePath(ctx);
    ctx.clip();
    let g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, b.color2);
    g.addColorStop(0.35, b.color);
    g.addColorStop(1, b.color2);
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, 16, w, 76);
    ctx.fillStyle = b.accent;
    ctx.fillRect(-w / 2, 16, w, 5);
    ctx.fillRect(-w / 2, 87, w, 5);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '19px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    ctx.fillText(b.emoji, 0, 36);
    ctx.fillStyle = b.ink;
    ctx.font = '16px Bangers, Impact, sans-serif';
    ctx.fillText(b.name, 0, 58);
    ctx.font = '700 7px "Baloo 2", sans-serif';
    ctx.fillText(b.sub, 0, 75);
    ctx.fillStyle = b.accent;
    ctx.fillRect(-12, -92, 24, 22);
    ctx.fillStyle = b.color;
    ctx.fillRect(-12, -85, 24, 7);
    ctx.restore();

    ctx.fillStyle = 'rgba(30,14,2,.95)';
    ctx.fillRect(-13, -h / 2, 26, 10);
    g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.2, 'rgba(255,255,255,.5)');
    g.addColorStop(0.3, 'rgba(255,255,255,0)');
    g.addColorStop(0.82, 'rgba(255,255,255,0)');
    g.addColorStop(0.9, 'rgba(255,255,255,.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    bottlePath(ctx);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.38)';
    for (const [dx, dy, r] of this.drops) {
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    bottlePath(ctx);
    ctx.strokeStyle = 'rgba(15,6,0,.65)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (this.capped) drawCap(ctx, 0, -h / 2 - 4);
    ctx.restore();
  }
}

export class Mug extends Vessel {
  constructor(x) {
    super();
    this.kind = 'mug';
    this.w = 118;
    this.h = 180;
    this.x = x;
    this.y = this.restY;
    this.level = 0; // litres, capacity 1.0
    this.foam = 0;
    this.session = 0; // litres drunk since last "jar done"
    this.perfectShown = false;
    this.overflowed = false;
  }

  get rim() {
    return this.local(0, -this.h / 2);
  }

  pourInfo() {
    const a = this.angle;
    const ext = Math.abs(Math.cos(a)) * 150 + Math.abs(Math.sin(a)) * 104;
    const surface = ext / 2 - this.level * ext;
    const [lx, ly] = rotate(-this.w / 2 + 5, -this.h / 2, a);
    const [rx, ry] = rotate(this.w / 2 - 5, -this.h / 2, a);
    const [cx, cy] = ly > ry ? [lx, ly] : [rx, ry];
    return { depth: cy - surface, x: this.x + cx, y: this.y + cy };
  }

  grabDist(px, py) {
    const [lx, ly] = rotate(px - this.x, py - this.y, -this.angle);
    const dx = Math.max(Math.abs(lx - 12) - (this.w / 2 + 22), 0);
    const dy = Math.max(Math.abs(ly) - this.h / 2, 0);
    return Math.hypot(dx, dy);
  }

  // Beer lands in the jar. Faster falling beer = more foam. Returns overflow litres.
  receive(amt, speed) {
    const foamy = clamp(speed / 2000, 0.12, 0.8);
    this.level += amt * (1 - foamy * 0.45);
    this.foam += amt * foamy * 0.9;
    this.wave = Math.min(6, this.wave + 0.4);
    let over = 0;
    if (this.level > 1) {
      over += this.level - 1;
      this.level = 1;
    }
    const foamCap = Math.max(0, 1.12 - this.level) / 0.5;
    if (this.foam > foamCap) {
      over += (this.foam - foamCap) * 0.3;
      this.foam = foamCap;
    }
    return over;
  }

  bodyPath(ctx, inset = 0) {
    const tw = this.w / 2 - inset;
    const bw = this.w / 2 - 7 - inset;
    const top = -this.h / 2 + inset * 0.3;
    const bot = this.h / 2 - (inset ? 22 : 0);
    ctx.beginPath();
    ctx.moveTo(-tw, top);
    ctx.lineTo(tw, top);
    ctx.lineTo(bw, bot - 10);
    ctx.quadraticCurveTo(bw, bot, bw - 10, bot);
    ctx.lineTo(-bw + 10, bot);
    ctx.quadraticCurveTo(-bw, bot, -bw, bot - 10);
    ctx.closePath();
  }

  draw(ctx, t) {
    const { w, h } = this;
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    if (this.hover > 0.02) {
      ctx.shadowColor = `rgba(255,210,80,${this.hover})`;
      ctx.shadowBlur = 34 * this.hover;
    }
    // handle
    const handle = () => {
      ctx.beginPath();
      ctx.moveTo(w / 2 - 10, -h / 2 + 34);
      ctx.bezierCurveTo(w / 2 + 56, -h / 2 + 26, w / 2 + 56, h / 2 - 40, w / 2 - 12, h / 2 - 34);
    };
    handle();
    ctx.lineWidth = 17;
    ctx.strokeStyle = 'rgba(205,232,255,.32)';
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
    handle();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.stroke();

    this.bodyPath(ctx);
    ctx.fillStyle = 'rgba(205,232,255,.13)';
    ctx.fill();

    const fill = this.level;
    if (fill > 0.003 || this.foam > 0.01) {
      ctx.save();
      this.bodyPath(ctx, 7);
      ctx.clip();
      ctx.rotate(-this.angle);
      const ext = Math.abs(Math.cos(this.angle)) * 150 + Math.abs(Math.sin(this.angle)) * 104;
      const sy = ext / 2 - fill * ext - 9 * Math.cos(this.angle);
      if (fill > 0.003) {
        liquidSurface(ctx, sy, t, this.wave, '#ffd24a', '#d97d0c', ext / 2);
        ctx.fillStyle = 'rgba(255,248,210,.6)';
        for (let i = 0; i < 16; i++) {
          const span = Math.max(1, ext / 2 - sy);
          const by = ext / 2 - ((t * (40 + (i % 5) * 12) + i * 41) % span);
          ctx.beginPath();
          ctx.arc(((i * 29) % 90) - 45, by, 1.2 + (i % 3) * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      const fh = this.foam * 120;
      if (fh > 1) {
        ctx.fillStyle = '#fff6df';
        ctx.beginPath();
        ctx.moveTo(-130, sy + 4);
        for (let x = -130; x <= 130; x += 13) {
          ctx.lineTo(x, sy - fh + Math.sin(x * 0.2 + t * 2) * 3);
        }
        ctx.lineTo(130, sy + 4);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = 'rgba(230,200,140,.45)';
        for (let i = 0; i < 14; i++) {
          ctx.beginPath();
          ctx.arc(((i * 23) % 100) - 50, sy - ((i * 7) % Math.max(2, fh)), 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();
      // foam muffin spilling over the rim
      const overTop = fill * 150 + this.foam * 120 - 150;
      if (overTop > 2) {
        ctx.fillStyle = '#fff6df';
        const mh = Math.min(28, overTop);
        for (let i = -3; i <= 3; i++) {
          ctx.beginPath();
          ctx.arc(i * 17, -h / 2 - mh * 0.35, 14 + mh * 0.3, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // glass dimples + highlight
    ctx.save();
    this.bodyPath(ctx);
    ctx.clip();
    for (let r = 0; r < 4; r++) {
      for (let c = -2; c <= 2; c++) {
        ctx.strokeStyle = 'rgba(255,255,255,.12)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(c * 22 + (r % 2) * 11, -48 + r * 34, 8, 13, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    g.addColorStop(0, 'rgba(255,255,255,.05)');
    g.addColorStop(0.14, 'rgba(255,255,255,.55)');
    g.addColorStop(0.24, 'rgba(255,255,255,0)');
    g.addColorStop(0.85, 'rgba(255,255,255,.0)');
    g.addColorStop(0.93, 'rgba(255,255,255,.25)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.fillStyle = 'rgba(220,240,255,.28)';
    ctx.fillRect(-w / 2, h / 2 - 22, w, 22);
    ctx.restore();

    this.bodyPath(ctx);
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -h / 2, w / 2, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// Friend's own little glass.
export function drawSmallGlass(ctx, x, y, angle, level, t) {
  const w = 50;
  const h = 76;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(-w / 2, -h / 2);
    ctx.lineTo(w / 2, -h / 2);
    ctx.lineTo(w / 2 - 5, h / 2);
    ctx.lineTo(-w / 2 + 5, h / 2);
    ctx.closePath();
  };
  path();
  ctx.fillStyle = 'rgba(205,232,255,.15)';
  ctx.fill();
  if (level > 0.01) {
    ctx.save();
    path();
    ctx.clip();
    ctx.rotate(-angle);
    const ext = Math.abs(Math.cos(angle)) * h + Math.abs(Math.sin(angle)) * w;
    const sy = ext / 2 - level * 0.85 * ext;
    liquidSurface(ctx, sy, t, 1, '#ffd24a', '#d97d0c', ext / 2);
    ctx.fillStyle = '#fff6df';
    ctx.fillRect(-60, sy - 8, 120, 9);
    ctx.restore();
  }
  path();
  ctx.strokeStyle = 'rgba(255,255,255,.6)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.fillRect(-w / 2 + 6, -h / 2 + 6, 5, h - 14);
  ctx.restore();
}

export class Particles {
  constructor() {
    this.list = [];
    this.stream = 0;
  }

  add(p) {
    this.list.push({ vx: 0, vy: 0, g: 1900, life: 1, age: 0, size: 4, rot: 0, vr: 0, drag: 0, ...p });
  }

  update(dt) {
    for (const p of this.list) {
      p.age += dt;
      p.px = p.x;
      p.py = p.y;
      p.vy += p.g * dt;
      if (p.drag) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k;
        p.vy *= k;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.floor && p.y > p.floor) {
        p.y = p.floor;
        p.vy *= -0.3;
        p.vx *= 0.6;
        p.vr *= 0.5;
      }
    }
    this.list = this.list.filter((p) => !p.dead && p.age < p.life && p.y < H + 120 && p.x > -200 && p.x < W + 200);
  }

  draw(ctx) {
    const beer = this.list.filter((p) => p.kind === 'beer');
    if (beer.length) {
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      let prev = null;
      for (const p of beer) {
        if (prev && prev.stream === p.stream && Math.hypot(prev.x - p.x, prev.y - p.y) < 70) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
        prev = p;
      }
      ctx.strokeStyle = 'rgba(225,135,20,.9)';
      ctx.lineWidth = 9;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,225,130,.75)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(240,160,30,.9)';
      for (const p of beer) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const p of this.list) {
      const k = 1 - p.age / p.life;
      switch (p.kind) {
        case 'drop':
          ctx.fillStyle = `rgba(240,160,30,${0.9 * k})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'foam':
          ctx.fillStyle = `rgba(255,248,228,${0.95 * Math.min(1, k * 2)})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.2 - k * 0.2), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'bubble':
          ctx.strokeStyle = `rgba(255,255,255,${0.7 * k})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'spark': {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(255,${200 + ((p.size * 10) | 0) % 55},90,${k})`;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case 'confetti':
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.min(1, k * 3);
          ctx.fillRect(-5, -3, 10, 6);
          ctx.restore();
          break;
        case 'shard':
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = Math.min(1, k * 3);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(-p.size, -p.size * 0.4);
          ctx.lineTo(p.size, 0);
          ctx.lineTo(-p.size * 0.3, p.size * 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        case 'cap':
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = Math.min(1, k * 4);
          drawCap(ctx, 0, 0);
          ctx.restore();
          break;
      }
    }
  }
}
