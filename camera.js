// Opens the webcam, runs Google's hand + face models on frames, feeds the engine.
// Shared by the hidden offscreen page (real use) and the options page (live preview).
// Frames stay in memory and are closed right after use; nothing is stored or sent.
import { FilesetResolver, GestureRecognizer, FaceLandmarker } from './vendor/vision_bundle.mjs';

export async function startCamera({ video, onGesture = () => {}, onFace = () => {}, onAction = () => {}, onStats = () => {} }) {
  const fileset = await FilesetResolver.forVisionTasks(chrome.runtime.getURL('vendor/wasm'));
  const rec = await GestureRecognizer.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: chrome.runtime.getURL('models/gesture_recognizer.task'), delegate: 'CPU' },
    runningMode: 'VIDEO',
    numHands: 1,
  });
  // Face features are optional: if the face model fails to load, gestures still work.
  let face = null;
  try {
    face = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: chrome.runtime.getURL('models/face_landmarker.task'), delegate: 'CPU' },
      runningMode: 'VIDEO', numFaces: 2, outputFaceBlendshapes: true,
    });
  } catch (e) { console.warn('Wave: face model unavailable', e); }

  let F = { ...WaveEngine.FEATURES };
  chrome.storage.local.get('features').then(({ features }) => { F = { ...F, ...features }; });
  chrome.storage.onChanged.addListener((c) => c.features && (F = { ...WaveEngine.FEATURES, ...c.features.newValue }));

  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, frameRate: 30 } });
  const track = stream.getVideoTracks()[0];
  if (video) { video.srcObject = stream; await video.play(); }

  const engine = WaveEngine.create(undefined, undefined, () => F);
  let fps = 2, lastRun = 0, lastFace = 0, captured = 0, processed = 0, stopped = false;

  function faceObs(source, now) {
    const r = face.detectForVideo(source, now);
    const lm = r.faceLandmarks[0];
    const xs = lm ? lm.map((p) => p.x) : [0];
    const cats = r.faceBlendshapes[0]?.categories || [];
    const blink = (n) => cats.find((c) => c.categoryName === n)?.score ?? 0;
    return { n: r.faceLandmarks.length, width: Math.max(...xs) - Math.min(...xs), eyes: Math.min(blink('eyeBlinkLeft'), blink('eyeBlinkRight')) };
  }

  function process(source) {
    captured++;
    const now = performance.now();
    if (now - lastRun < 1000 / fps) return;
    lastRun = now; processed++;
    const res = rec.recognizeForVideo(source, now);
    const top = res.gestures[0]?.[0], lm = res.landmarks[0];
    const obs = { t: now, gesture: top ? top.categoryName : null, score: top ? top.score : 0 };
    if (lm) obs.pinch = { dist: Math.hypot(lm[4].x - lm[8].x, (lm[4].y - lm[8].y) * 0.75), x: lm[8].x, y: lm[8].y };
    if (face && (F.away || F.sleep || F.roommate || F.captions || video) && now - lastFace >= 500) {
      lastFace = now; obs.face = faceObs(source, now); onFace(obs.face);
    }
    onGesture(obs);
    const out = engine.step(obs);
    fps = out.fps;
    out.actions.forEach(onAction);
  }

  const stats = setInterval(() => { onStats({ capturedFps: captured, processedFps: processed, fps }); captured = processed = 0; }, 1000);

  // Frame stream keeps flowing in a hidden page; timers there get throttled.
  if ('MediaStreamTrackProcessor' in self) {
    const reader = new MediaStreamTrackProcessor({ track }).readable.getReader();
    (async () => {
      while (!stopped) {
        const { value: frame, done } = await reader.read();
        if (done) break;
        try { process(frame); } finally { frame.close(); }
      }
    })();
  } else {
    // shortcut: timer fallback is throttled in hidden pages; only reached on very old Chrome.
    const v = video || Object.assign(document.createElement('video'), { srcObject: stream, muted: true });
    if (!video) await v.play();
    const timer = setInterval(() => v.readyState >= 2 && process(v), 66);
    track.addEventListener('ended', () => clearInterval(timer));
  }

  return () => { stopped = true; clearInterval(stats); track.stop(); rec.close(); face?.close(); };
}
