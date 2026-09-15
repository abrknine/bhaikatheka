import './style.css';
import { W, H, dist, makeCanvas, clamp } from './util.js';
import { Vision } from './vision.js';
import { Audio } from './audio.js';
import { VoiceCommand } from './speech.js';
import { PostFX } from './fx.js';
import { Game } from './game.js';
import { drawPlaceholder } from './characters.js';
import { track } from './analytics.js';
import { THEMES, DEFAULT_THEME } from './themes/index.js';

const $ = (s) => document.querySelector(s);
// Render resolution multiplier (1.0 = 1600x900).
const RS = clamp(((window.devicePixelRatio || 1) * Math.min(innerWidth, (innerHeight * 16) / 9)) / W, 1, 1.35);

let view = $('#view');
view.width = Math.round(W * RS);
view.height = Math.round(H * RS);
const sceneCanvas = makeCanvas(W * RS, H * RS);
const sctx = sceneCanvas.getContext('2d');

let fx;
try {
  fx = new PostFX(view);
} catch (err) {
  console.warn('[fx] post-processing disabled', err);
  const c = view.cloneNode();
  view.replaceWith(c);
  view = c;
  const c2d = c.getContext('2d');
  fx = { render: (src) => c2d.drawImage(src, 0, 0) };
}

const audio = new Audio();
const vision = new Vision();
const video = $('#cam');
let game;
let camOn = false;
let visionOn = false;
const mouse = { x: W / 2, y: H / 2, down: false, roll: 0, last: -1e9 };
const keys = new Set();

const store = {
  get(key, fallback) {
    try {
      return localStorage.getItem(key) ?? fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode */
    }
  },
};

const THEME_KEY = 'theka.theme.v1';
const CAL_KEY = 'theka.cal.v1';
const CAL_DEFAULT = { scale: 0.92, ox: 150, oy: 0 };
const cal = (() => {
  try {
    return { ...CAL_DEFAULT, ...JSON.parse(store.get(CAL_KEY, '{}')) };
  } catch {
    return { ...CAL_DEFAULT };
  }
})();
const saveCal = () => store.set(CAL_KEY, JSON.stringify(cal));

function toast(msg, ms = 3200) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), ms);
}

function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H);
  view.style.width = `${W * s}px`;
  view.style.height = `${H * s}px`;
}

// Where the (mirrored) webcam frame sits inside the 1600x900 scene.
function camRect() {
  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const s = Math.max(W / vw, H / vh) * cal.scale;
  const dw = vw * s;
  const dh = vh * s;
  return { dx: (W - dw) / 2 + cal.ox, dy: H - dh + cal.oy, dw, dh };
}

function drawPerson(ctx) {
  if (!camOn || video.readyState < 2) {
    drawPlaceholder(ctx, game.t);
    return;
  }
  const r = camRect();
  const cutout = vision.useSeg && vision.hasMask;
  ctx.save();
  ctx.translate(r.dx + r.dw, r.dy);
  ctx.scale(-1, 1);
  if (cutout) {
    ctx.shadowColor = 'rgba(0,0,0,.5)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetX = 18;
    ctx.shadowOffsetY = 12;
    ctx.drawImage(vision.personCanvas, 0, 0, r.dw, r.dh);
  } else {
    ctx.drawImage(video, 0, 0, r.dw, r.dh);
  }
  ctx.restore();
}

function processVision() {
  const r = camRect();
  const map = (p) => ({ x: r.dx + (1 - p.x) * r.dw, y: r.dy + p.y * r.dh });
  const raw = vision.hands.map((hd) => {
    const pts = hd.landmarks.map(map);
    let px = 0;
    let py = 0;
    for (const i of [0, 5, 9, 13, 17]) {
      px += pts[i].x / 5;
      py += pts[i].y / 5;
    }
    // world landmarks are in metres and rotation-independent: great for gestures
    const wl = hd.world || hd.landmarks;
    const wd = (a, b) => Math.hypot(wl[a].x - wl[b].x, wl[a].y - wl[b].y, wl[a].z - wl[b].z);
    const tips = wd(8, 0) + wd(12, 0) + wd(16, 0) + wd(20, 0);
    const mcps = wd(5, 0) + wd(9, 0) + wd(13, 0) + wd(17, 0);
    return {
      x: px,
      y: py,
      ratio: tips / mcps,
      pinch: wd(4, 8),
      roll: Math.atan2(pts[17].y - pts[5].y, pts[17].x - pts[5].x),
      pts,
    };
  });
  game.setCameraHands(raw);

  const f = vision.face;
  if (f && vision.faceAge < 6) {
    const m = map({ x: (f[13].x + f[14].x) / 2, y: (f[13].y + f[14].y) / 2 });
    const top = map(f[10]);
    const chin = map(f[152]);
    const up = map(f[13]);
    const lo = map(f[14]);
    const fh = dist(top.x, top.y, chin.x, chin.y);
    game.setFace({ present: true, x: m.x, y: m.y, top: top.y, h: fh, open: dist(up.x, up.y, lo.x, lo.y) / fh > 0.08 });
  } else game.setFace({ present: false });
}

const voice = new VoiceCommand({
  onWaiter: () => game?.callWaiter('voice'),
  onHeard: (text) => {
    if (!game) return;
    game.ui.heard = text.trim();
    game.ui.heardT = game.t;
  },
  // ignore the mic while our own characters are talking ("...bula WAITER ko!")
  canTrigger: () => !!game?.started && !audio.isSpeaking,
  getWake: () => game?.theme.voice.wake,
});

let last = performance.now();
let fpsAcc = 0;
let fpsN = 0;
function loop(now) {
  const dt = clamp((now - last) / 1000, 0.001, 0.05);
  last = now;
  if (camOn && visionOn) {
    try {
      if (vision.detect(now)) processVision();
    } catch (err) {
      console.error(err);
      visionOn = false;
      game.ui.camera = false;
      toast('Hand tracking crashed 😵 — use the mouse');
    }
  }
  if (keys.has('q')) mouse.roll -= dt * 2.5;
  if (keys.has('e')) mouse.roll += dt * 2.5;
  game.setMouse({ active: mouse.down || now - mouse.last < 2500, x: mouse.x, y: mouse.y, down: mouse.down, roll: mouse.roll });
  game.ui.mic = voice.state;
  game.personOpaque = camOn && video.readyState >= 2 && !(vision.useSeg && vision.hasMask);
  game.update(dt);
  sctx.setTransform(RS, 0, 0, RS, 0, 0);
  game.render(sctx, drawPerson);
  fx.render(sceneCanvas, { time: now / 1000, drunk: game.fxDrunk, flash: game.flash, hurt: game.hurt });
  fpsAcc += dt;
  fpsN++;
  if (fpsAcc > 0.5) {
    game.ui.fps = Math.round(fpsN / fpsAcc);
    fpsAcc = 0;
    fpsN = 0;
  }
  requestAnimationFrame(loop);
}

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera API unavailable — open the game over https or localhost');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  if (video.readyState < 2) await new Promise((r) => video.addEventListener('loadeddata', r, { once: true }));
}

// ------------------------------------------------------------------ themes

function buildThemePicker() {
  const box = $('#themes');
  box.innerHTML = '';
  for (const th of THEMES) {
    const card = document.createElement('button');
    card.className = 'theme-card';
    card.dataset.theme = th.id;
    card.type = 'button';
    card.innerHTML = '<span class="te"></span><span class="tn"></span><span class="tb"></span>';
    card.querySelector('.te').textContent = th.emoji;
    card.querySelector('.tn').textContent = th.name;
    card.querySelector('.tb').textContent = th.blurb;
    card.addEventListener('click', () => setTheme(th.id));
    box.appendChild(card);
  }
}

function applyThemeUI() {
  const th = game.theme;
  document.body.dataset.theme = th.id;
  $('#title-a').textContent = th.title[0];
  $('#title-b').textContent = th.title[1];
  $('#subtitle').textContent = th.subtitle;
  $('#tagline').textContent = th.tagline;
  $('#step-refill-icon').textContent = th.refillIcon;
  $('#step-refill').innerHTML = th.refillStep; // static theme copy, not user input
  $('#go').textContent = th.enter;
  $('#toolbar [data-act="waiter"]').textContent = th.refillButton;
  $('#help-refill-a').textContent = th.help[0];
  $('#help-refill-b').textContent = th.help[1];
  for (const c of document.querySelectorAll('.theme-card')) c.classList.toggle('active', c.dataset.theme === th.id);
  audio.setStyle(th.music, th.ambience);
}

function setTheme(id, announce = false) {
  if (game.theme.id === id) return;
  game.setTheme(id);
  store.set(THEME_KEY, id);
  applyThemeUI();
  track('theme_change', { theme: id });
  if (announce) toast(`${game.theme.emoji} ${game.theme.name}`, 1600);
}

function nextTheme() {
  const i = THEMES.findIndex((t) => t.id === game.theme.id);
  setTheme(THEMES[(i + 1) % THEMES.length].id, true);
}

// ------------------------------------------------------------------ start

async function enter(withCam) {
  audio.init();
  $('#start').classList.add('hidden');
  if (withCam) {
    $('#loading').classList.remove('hidden');
    const msg = $('.loader-msg');
    const bar = $('.bar i');
    const lines = game.theme.loading;
    let li = 0;
    msg.textContent = lines[0];
    const spin = setInterval(() => (msg.textContent = lines[++li % lines.length]), 1600);
    const camP = startCamera()
      .then(() => (camOn = true))
      .catch((err) => {
        console.warn(err);
        toast(err.name === 'NotAllowedError' ? '📷 Camera blocked — playing with mouse' : `📷 ${err.message || 'No camera'} — mouse mode`, 5000);
      });
    const visP = vision
      .init((label, p) => {
        bar.style.width = `${Math.round(p * 100)}%`;
        $('.loader-title').textContent = label;
      })
      .then(() => (visionOn = true))
      .catch((err) => {
        console.error(err);
        toast('AI models failed to load — mouse mode', 5000);
      });
    await Promise.all([camP, visP]);
    clearInterval(spin);
    $('#loading').classList.add('hidden');
    if (camOn) vision.setVideo(video);
  }
  game.ui.camera = camOn && visionOn;
  track('game_start', {
    mode: camOn && visionOn ? 'camera' : 'mouse',
    camera_ok: camOn,
    tracking_ok: visionOn,
    background_removal: !!vision.seg,
    theme: game.theme.id,
  });
  $('#toolbar').classList.remove('hidden');
  voice.start();
  game.start();
  syncToolbar();
  if (!camOn) toast('🖱️ Mouse mode: click & hold to grab, scroll or Q/E to tilt', 5000);
}

const actions = {
  waiter: () => game.callWaiter('key'),
  theme: () => nextTheme(),
  music: () => toast(audio.toggleMusic() ? '🎵 Music on' : '🎵 Music off', 1200),
  voice: () => {
    audio.voiceOn = !audio.voiceOn;
    if (!audio.voiceOn) window.speechSynthesis?.cancel();
    toast(audio.voiceOn ? '🗣️ Character voices on' : '🗣️ Character voices off', 1200);
  },
  bg: () => {
    vision.useSeg = !vision.useSeg;
    toast(vision.useSeg ? '🎭 Virtual background on' : '🎭 Showing your real room', 1400);
  },
  skeleton: () => (game.opts.skeleton = !game.opts.skeleton),
  assist: () => {
    game.opts.assist = !game.opts.assist;
    toast(game.opts.assist ? '🎯 Pour assist on' : '🎯 Pour assist off — hardcore mode', 1600);
  },
  fullscreen: () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  },
  help: () => $('#help').classList.toggle('hidden'),
  reset: () => {
    game.reset();
    toast('🔄 Naya round!', 1200);
  },
  debug: () => (game.ui.debug = !game.ui.debug),
};

function syncToolbar() {
  const set = (act, on) => $(`#toolbar [data-act="${act}"]`)?.classList.toggle('off', !on);
  set('music', audio.musicOn);
  set('voice', audio.voiceOn);
  set('bg', vision.useSeg);
  set('skeleton', game.opts.skeleton);
  set('assist', game.opts.assist);
}

$('#toolbar').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b) return;
  actions[b.dataset.act]();
  syncToolbar();
  b.blur();
});

addEventListener('keydown', (e) => {
  if (!game?.started) return;
  const k = e.key.toLowerCase();
  keys.add(k);
  const step = e.shiftKey ? 5 : 20;
  const calMsg = () => {
    saveCal();
    toast(`📐 Camera: zoom ${cal.scale.toFixed(2)}  x ${cal.ox}  y ${cal.oy}`, 900);
  };
  if (e.repeat && !k.startsWith('arrow') && k !== '[' && k !== ']') return;
  switch (k) {
    case 'w': actions.waiter(); break;
    case 't': actions.theme(); break;
    case 'm': actions.music(); break;
    case 'v': actions.voice(); break;
    case 'b': actions.bg(); break;
    case 'h': actions.skeleton(); break;
    case 'a': actions.assist(); break;
    case 'f': actions.fullscreen(); break;
    case 'r': actions.reset(); break;
    case 'd': actions.debug(); break;
    case '?':
    case '/': actions.help(); break;
    case 'escape': $('#help').classList.add('hidden'); break;
    case '[': cal.scale = clamp(cal.scale - 0.03, 0.5, 1.4); calMsg(); break;
    case ']': cal.scale = clamp(cal.scale + 0.03, 0.5, 1.4); calMsg(); break;
    case 'arrowleft': cal.ox -= step; calMsg(); break;
    case 'arrowright': cal.ox += step; calMsg(); break;
    case 'arrowup': cal.oy -= step; calMsg(); break;
    case 'arrowdown': cal.oy += step; calMsg(); break;
    case 'c': Object.assign(cal, CAL_DEFAULT); calMsg(); break;
    default: return;
  }
  e.preventDefault();
  syncToolbar();
});
addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());

function toScene(e) {
  const r = view.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}
function bindPointer(el) {
  el.addEventListener('pointermove', (e) => {
    Object.assign(mouse, toScene(e));
    mouse.last = performance.now();
  });
  el.addEventListener('pointerdown', (e) => {
    Object.assign(mouse, toScene(e));
    mouse.down = true;
    mouse.last = performance.now();
    el.setPointerCapture?.(e.pointerId);
  });
  el.addEventListener('pointerup', () => (mouse.down = false));
  el.addEventListener('pointercancel', () => (mouse.down = false));
  el.addEventListener(
    'wheel',
    (e) => {
      mouse.roll += clamp(e.deltaY, -60, 60) * 0.012;
      mouse.last = performance.now();
      e.preventDefault();
    },
    { passive: false },
  );
}

async function boot() {
  fit();
  addEventListener('resize', fit);
  bindPointer(view);
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('40px Bangers'),
        document.fonts.load('700 40px "Baloo 2"', 'AB'),
        document.fonts.load('800 40px "Baloo 2"', 'अंग्रेज़ी शराब'),
      ]),
      new Promise((r) => setTimeout(r, 3000)),
    ]);
  } catch {
    /* fonts are optional */
  }
  game = new Game(audio, RS, store.get(THEME_KEY, DEFAULT_THEME));
  window.theka = { game, vision, audio, cal };
  buildThemePicker();
  applyThemeUI();
  requestAnimationFrame((t) => {
    last = t;
    loop(t);
  });
  $('#go').addEventListener('click', () => enter(true));
  $('#nocam').addEventListener('click', () => enter(false));
  $('#help-close').addEventListener('click', () => $('#help').classList.add('hidden'));
  document.body.classList.add('ready');
}

boot();
