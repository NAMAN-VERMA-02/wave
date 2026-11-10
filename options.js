import { startCamera } from './camera.js';

const $ = (id) => document.getElementById(id);
const BOOLS = ['away', 'sleep', 'roommate', 'captions', 'scrub'];
let features = { ...WaveEngine.FEATURES };
let cal = null; // widths sampled while calibrating

const save = () => chrome.storage.local.set({ features });
chrome.storage.local.get('features').then((r) => {
  features = { ...features, ...r.features };
  BOOLS.forEach((k) => { $(k).checked = features[k]; $(k).onchange = () => { features[k] = $(k).checked; save(); }; });
  $('awayMs').value = String(features.awayMs);
  $('awayMs').onchange = () => { features.awayMs = +$('awayMs').value; save(); };
  $('calst').textContent = features.baseline ? 'calibrated' : 'not calibrated';
});

$('cal').onclick = () => {
  if (!$('go').disabled) { $('calst').textContent = 'start the camera first'; return; }
  cal = []; $('calst').textContent = 'sit normally for 3 s…';
  setTimeout(() => {
    if (cal.length) { features.baseline = cal.reduce((a, b) => a + b) / cal.length; save(); $('calst').textContent = 'calibrated'; }
    else $('calst').textContent = 'no face seen, try again';
    cal = null;
  }, 3000);
};

$('go').onclick = async () => {
  $('go').disabled = true;
  try {
    await startCamera({
      video: $('v'),
      onGesture: (o) => { $('g').textContent = o.gesture && o.gesture !== 'None' ? `${o.gesture} (${Math.round(o.score * 100)}%)` : 'no gesture'; },
      onFace: (f) => { if (cal && f.n === 1) cal.push(f.width); },
      onAction: (a) => { $('g').textContent = '✔ ' + a.type; },
      onStats: (s) => { $('st').textContent = `${s.capturedFps} fps captured, ${s.processedFps} analysed`; },
    });
  } catch (e) {
    $('go').disabled = false;
    $('g').textContent = e.name === 'NotAllowedError' ? 'Camera blocked. Allow it in the address bar and try again.' : String(e.message || e);
  }
};
