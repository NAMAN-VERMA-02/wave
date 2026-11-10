const on = document.getElementById('on'), s = document.getElementById('s');

async function paint() {
  const { enabled = true } = await chrome.storage.local.get('enabled');
  const { diag } = await chrome.storage.session.get('diag');
  on.checked = enabled;
  s.textContent = !enabled ? 'Off. Camera is not used.'
    : !diag ? 'Waiting for a video to play. Camera is off.'
    : diag.error ? diag.error
    : `Camera on · seeing: ${diag.gesture || 'no hand'} · ${diag.capturedFps} fps captured, ${diag.processedFps} analysed`;
}
on.onchange = () => chrome.storage.local.set({ enabled: on.checked });
chrome.storage.onChanged.addListener(paint);
paint();
