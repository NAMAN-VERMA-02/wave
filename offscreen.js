import { startCamera } from './camera.js';

const send = (m) => chrome.runtime.sendMessage(m).catch(() => {});

startCamera({
  onAction: (action) => send({ type: 'action', action }),
  onGesture: (o) => (globalThis.last = o.gesture),
  onStats: (s) => send({ type: 'stats', ...s, gesture: globalThis.last || null }),
}).catch((e) => send({ type: 'stats', error: e.name === 'NotAllowedError' ? 'Camera not allowed. Open Wave options and press "Allow camera".' : String(e.message || e) }));
