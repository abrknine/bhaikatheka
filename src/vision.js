// Real-time computer vision: hands (21 landmarks x2), face mesh (478 landmarks)
// and selfie segmentation (cuts you out of your room and drops you in the theka).
import { FilesetResolver, HandLandmarker, FaceLandmarker, ImageSegmenter } from '@mediapipe/tasks-vision';
import { makeCanvas } from './util.js';

const asset = (p) => new URL(p, document.baseURI).href;

async function create(Task, fileset, options, delegates) {
  let lastErr;
  for (const delegate of delegates) {
    try {
      return await Task.createFromOptions(fileset, {
        ...options,
        baseOptions: { ...options.baseOptions, delegate },
      });
    } catch (err) {
      lastErr = err;
      console.warn(`[vision] ${delegate} delegate failed`, err);
    }
  }
  throw lastErr;
}

// Soft edge for the person mask.
const MASK_LUT = new Uint8ClampedArray(256);
for (let i = 0; i < 256; i++) {
  const t = Math.min(1, Math.max(0, (i / 255 - 0.3) / 0.45));
  MASK_LUT[i] = Math.round(t * t * (3 - 2 * t) * 255);
}

export class Vision {
  constructor() {
    this.hands = [];
    this.face = null;
    this.faceAge = 99;
    this.useSeg = true;
    this.hasMask = false;
    this.lastVideoTime = -1;
    this.lastTs = 0;
    this.frame = 0;
  }

  async init(onStep) {
    onStep('Waking up the AI brain…', 0.1);
    const fileset = await FilesetResolver.forVisionTasks(asset('wasm'));

    onStep('Teaching it your hands…', 0.35);
    this.handLm = await create(
      HandLandmarker,
      fileset,
      {
        baseOptions: { modelAssetPath: asset('models/hand_landmarker.task') },
        runningMode: 'VIDEO',
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      },
      ['GPU', 'CPU'],
    );

    onStep('Finding your mouth (important)…', 0.6);
    try {
      this.faceLm = await create(
        FaceLandmarker,
        fileset,
        {
          baseOptions: { modelAssetPath: asset('models/face_landmarker.task') },
          runningMode: 'VIDEO',
          numFaces: 1,
        },
        ['GPU', 'CPU'],
      );
    } catch (e) {
      console.warn('[vision] face landmarker unavailable', e);
    }

    onStep('Teleporting you into the theka…', 0.85);
    try {
      this.seg = await create(
        ImageSegmenter,
        fileset,
        {
          baseOptions: { modelAssetPath: asset('models/selfie_segmenter.tflite') },
          runningMode: 'VIDEO',
          outputConfidenceMasks: true,
          outputCategoryMask: false,
        },
        ['CPU', 'GPU'],
      );
    } catch (e) {
      console.warn('[vision] segmenter unavailable', e);
      this.useSeg = false;
    }
    onStep('Thandi beer ready!', 1);
  }

  setVideo(video) {
    this.video = video;
  }

  ensureBuffers(w, h) {
    if (this.personCanvas && this.personCanvas.width === w && this.personCanvas.height === h) return;
    this.personCanvas = makeCanvas(w, h);
    this.personCtx = this.personCanvas.getContext('2d');
    this.maskCanvas = makeCanvas(w, h);
    this.maskCtx = this.maskCanvas.getContext('2d');
    this.maskImg = this.maskCtx.createImageData(w, h);
    this.maskImg.data.fill(255);
    this.prevMask = new Float32Array(w * h);
    this.hasMask = false;
  }

  // Returns true when a new camera frame was processed.
  detect(now) {
    const v = this.video;
    if (!v || v.readyState < 2 || !this.handLm) return false;
    if (v.currentTime === this.lastVideoTime) return false;
    this.lastVideoTime = v.currentTime;
    const ts = Math.max(now, this.lastTs + 1);
    this.lastTs = ts;

    const hr = this.handLm.detectForVideo(v, ts);
    this.hands = hr.landmarks.map((lm, i) => ({
      landmarks: lm,
      world: hr.worldLandmarks[i],
      handedness: hr.handedness?.[i]?.[0]?.categoryName,
    }));

    if (this.faceLm && this.frame % 2 === 0) {
      const fr = this.faceLm.detectForVideo(v, ts);
      if (fr.faceLandmarks[0]) {
        this.face = fr.faceLandmarks[0];
        this.faceAge = 0;
      } else this.faceAge++;
    }

    if (this.seg && this.useSeg) {
      const sr = this.seg.segmentForVideo(v, ts);
      const mask = sr.confidenceMasks?.[0];
      if (mask) this.compositePerson(mask.getAsFloat32Array(), mask.width, mask.height);
      sr.close?.();
    }
    this.frame++;
    return true;
  }

  compositePerson(data, mw, mh) {
    const v = this.video;
    this.ensureBuffers(mw, mh);
    const px = this.maskImg.data;
    const prev = this.prevMask;
    const n = Math.min(data.length, prev.length);
    for (let i = 0, j = 3; i < n; i++, j += 4) {
      // light temporal smoothing kills edge shimmer
      const m = (prev[i] = prev[i] * 0.3 + data[i] * 0.7);
      px[j] = MASK_LUT[m >= 1 ? 255 : (m * 255) | 0];
    }
    this.maskCtx.putImageData(this.maskImg, 0, 0);

    const c = this.personCtx;
    c.globalCompositeOperation = 'copy';
    c.drawImage(v, 0, 0, mw, mh);
    c.globalCompositeOperation = 'destination-in';
    c.filter = 'blur(1.5px)';
    c.drawImage(this.maskCanvas, 0, 0);
    c.filter = 'none';
    c.globalCompositeOperation = 'source-over';
    this.hasMask = true;
  }
}
