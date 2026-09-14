// Copies MediaPipe's WASM runtime into public/ so the game is fully self-hosted.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';

const src = 'node_modules/@mediapipe/tasks-vision/wasm';
const dest = 'public/wasm';
if (existsSync(src)) {
  mkdirSync(dest, { recursive: true });
  // the "module" variant is only used when useModule=true; skip it to keep deploys small
  for (const f of readdirSync(src).filter((f) => !f.includes('_module_'))) copyFileSync(`${src}/${f}`, `${dest}/${f}`);
  console.log('[theka] MediaPipe wasm copied to public/wasm');
}
