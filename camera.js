// Opens the webcam, runs Google's gesture model on frames, feeds the engine.
// Shared by the hidden offscreen page (real use) and the options page (live preview).
// Frames stay in memory and are closed right after use; nothing is stored or sent.
import { FilesetResolver, GestureRecognizer } from './vendor/vision_bundle.mjs';

export async function startCamera({ video, onGesture = () => {}, onAction = () => {}, onStats = () => {} }) {
  const fileset = await FilesetResolver.forVisionTasks(chrome.runtime.getURL('vendor/wasm'));
  const rec = await GestureRecognizer.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: chrome.runtime.getURL('models/gesture_recognizer.task'), delegate: 'CPU' },
    runningMode: 'VIDEO',
    numHands: 1,
  });
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, frameRate: 30 } });
  const track = stream.getVideoTracks()[0];
  if (video) { video.srcObject = stream; await video.play(); }

  const engine = WaveEngine.create();
  let fps = 2, lastRun = 0, captured = 0, processed = 0, stopped = false;

  function process(source) {
    captured++;
    const now = performance.now();
    if (now - lastRun < 1000 / fps) return;
    lastRun = now; processed++;
    const top = rec.recognizeForVideo(source, now).gestures[0]?.[0];
    const obs = { t: now, gesture: top ? top.categoryName : null, score: top ? top.score : 0 };
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

  return () => { stopped = true; clearInterval(stats); track.stop(); rec.close(); };
}
