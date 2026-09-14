# 🍺 Bhai Ka Theka — AR Beer Simulator

A webcam AR game set in a desi theka. Grab virtual bottles with your **real hands**, pour into the jar, chug it, cheers with Bunty bhai, and when it's all gone shout **"WAITER!"**. Chhotu comes running and opens fresh bottles.

Everything runs in the browser. Camera frames are processed on-device, nothing is uploaded.

## How to play

| Do this | What happens |
| --- | --- |
| ✊ Fist or 🤏 pinch on a bottle | Pick it up |
| 🔄 Rotate your wrist / hover over the jar | Pour (liquid physics, foam, overflow, spills) |
| 😮 Bring the jar to your mouth | Drink. Open your mouth to chug faster |
| 🥂 Touch the jar to Bunty's glass | Cheers! |
| 🗣️ Say "WAITER" (or "bhaiya" / "chhotu"), ✋ hold a hand above your head, or press `W` | Waiter clears the empties and opens new bottles |
| Throw a bottle hard | It breaks. Bunty is not impressed |

Keys: `B` background removal · `H` hand skeleton · `A` pour assist · `M` music · `V` character voices · `F` fullscreen · `R` new round · `D` debug · `[` `]` + arrow keys move/zoom you inside the scene · `C` reset that.

No camera? Click **"Play with mouse"**: click-hold to grab, scroll or `Q`/`E` to tilt.

## Tech

- **MediaPipe Tasks Vision** (WASM + WebGL, self-hosted): HandLandmarker (2 hands, 21 3D landmarks), FaceLandmarker (mouth tracking), ImageSegmenter (cuts you out of your room and puts you in the theka)
- Gesture recognition from 3D world landmarks with hysteresis, plus a One-Euro filter for jitter-free hands
- Canvas 2D scene, all characters procedurally drawn with 2-bone IK arms, blinking and lip-flap
- Simulated liquid: the surface stays level as the glass rotates, and beer only pours once the surface reaches the mouth. Stream particles, foam, overflow, puddles
- **WebGL post-processing** tied to your talli meter: wobble, double vision, chromatic aberration, bloom, vignette, grain
- **Web Audio** synthesis for every sound (pour, glug, clink, cap pop, fizz, burp, dholak + harmonium loop, crowd murmur). No audio files
- **Web Speech API** for the "WAITER" voice command and Hinglish character voices

## Run locally

```bash
npm install      # also copies the MediaPipe wasm into public/wasm
npm run dev      # http://localhost:5173
```

Camera and mic need `localhost` or HTTPS. The voice command works best in Chrome or Edge.

## Deploy

`npm run build` outputs a fully static site to `dist/`, which you can host anywhere with HTTPS.

- **Vercel:** `npx vercel` (it auto-detects Vite), or import the repo at vercel.com
- **Netlify:** `npx netlify deploy --prod --dir=dist`, or drag `dist/` onto app.netlify.com/drop
- **GitHub Pages:** push `dist/` to a `gh-pages` branch. The build uses relative paths, so sub-paths work
- **Cloudflare Pages:** build command `npm run build`, output directory `dist`

---
Virtual beer only. Drink responsibly. 🍻
# bhaikatheka
