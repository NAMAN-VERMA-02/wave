// Reports play/pause of the page's main video and applies gesture actions to it.
(() => {
  const videos = () => [...document.querySelectorAll('video')].filter((v) => v.readyState > 0);
  const main = () => {
    const vs = videos();
    return vs.find((v) => !v.paused) || vs.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
  };
  const report = (playing) => chrome.runtime.sendMessage({ type: 'video-state', playing }).catch(() => {});

  // play/pause don't bubble, so listen in the capture phase on the document.
  document.addEventListener('play', () => report(true), true);
  document.addEventListener('pause', () => report(false), true);
  document.addEventListener('ended', () => report(false), true);
  if (videos().some((v) => !v.paused)) report(true);

  let host;
  function flash(text) {
    if (!host) {
      host = document.createElement('div');
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = '<style>div{position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#000c;color:#fff;font:600 20px system-ui;padding:10px 18px;border-radius:999px;opacity:0;transition:opacity .2s;pointer-events:none}div.on{opacity:1}</style><div role="status" aria-live="polite"></div>';
      document.documentElement.append(host);
    }
    const el = host.shadowRoot.querySelector('div');
    el.textContent = text; el.classList.add('on');
    clearTimeout(flash.t); flash.t = setTimeout(() => el.classList.remove('on'), 900);
  }

  chrome.runtime.onMessage.addListener((m) => {
    if (m.type !== 'wave') return;
    const v = main(); if (!v) return;
    const a = m.action;
    if (a.type === 'toggle') { v.paused ? v.play() : v.pause(); flash(v.paused ? '⏸ Paused' : '▶ Playing'); }
    else if (a.type === 'mute') { v.muted = !v.muted; flash(v.muted ? '🔇 Muted' : '🔊 Unmuted'); }
    else if (a.type === 'seek') { v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + a.by)); flash((a.by > 0 ? '⏩ +' : '⏪ ') + a.by + 's'); }
    else if (a.type === 'volume') { v.volume = Math.max(0, Math.min(1, v.volume + a.by)); flash('🔊 ' + Math.round(v.volume * 100) + '%'); }
  });
})();
