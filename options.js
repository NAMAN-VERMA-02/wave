import { startCamera } from './camera.js';

const $ = (id) => document.getElementById(id);
$('go').onclick = async () => {
  $('go').disabled = true;
  try {
    await startCamera({
      video: $('v'),
      onGesture: (o) => { $('g').textContent = o.gesture && o.gesture !== 'None' ? `${o.gesture} (${Math.round(o.score * 100)}%)` : 'no gesture'; },
      onAction: (a) => { $('g').textContent = '✔ ' + a.type; },
      onStats: (s) => { $('st').textContent = `${s.capturedFps} fps captured, ${s.processedFps} analysed`; },
    });
  } catch (e) {
    $('go').disabled = false;
    $('g').textContent = e.name === 'NotAllowedError' ? 'Camera blocked. Allow it in the address bar and try again.' : String(e.message || e);
  }
};
