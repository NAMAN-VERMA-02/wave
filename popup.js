const $ = (id) => document.getElementById(id);
const mmss = (s) => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

// YouTube takes ?t=; everything else gets #wave-t= which content.js reads.
function link(url, time) {
  try {
    const u = new URL(url);
    if (u.hostname.endsWith('youtube.com')) { u.searchParams.set('t', time + 's'); return u.href; }
    u.hash = 'wave-t=' + time; return u.href;
  } catch { return url; }
}

async function paint() {
  const { enabled = true, slept, bookmarks = [] } = await chrome.storage.local.get(['enabled', 'slept', 'bookmarks']);
  const { diag } = await chrome.storage.session.get('diag');
  $('on').checked = enabled;
  $('s').textContent = !enabled ? 'Off. Camera is not used.'
    : !diag ? 'Waiting for a video to play. Camera is off.'
    : diag.error ? diag.error
    : `Camera on · seeing: ${diag.gesture || 'no hand'} · ${diag.capturedFps} fps captured, ${diag.processedFps} analysed`;

  const sl = $('slept');
  sl.hidden = !(slept && Date.now() - slept.at < 864e5);
  if (!sl.hidden) {
    const clock = new Date(slept.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    sl.replaceChildren(`😴 You dozed off at ${clock} (${mmss(slept.time)} into “${slept.title.slice(0, 40)}”). `);
    const go = Object.assign(document.createElement('a'), { href: link(slept.url, slept.time), target: '_blank', textContent: 'Resume' });
    const x = Object.assign(document.createElement('button'), { textContent: 'Dismiss', onclick: () => chrome.storage.local.remove('slept') });
    sl.append(go, ' ', x);
  }

  $('bm').hidden = !bookmarks.length;
  $('list').replaceChildren(...bookmarks.map((b) => Object.assign(document.createElement('a'), { href: link(b.url, b.time), target: '_blank', textContent: `${mmss(b.time)}  ${b.title}` })));
  $('copy').onclick = () => navigator.clipboard.writeText(bookmarks.map((b) => `- [${b.title} @ ${mmss(b.time)}](${link(b.url, b.time)})`).join('\n'));
}
$('on').onchange = () => chrome.storage.local.set({ enabled: $('on').checked });
chrome.storage.onChanged.addListener(paint);
paint();
