// Keeps the hidden camera page alive only while a video is playing (or was paused < 2 min ago),
// and forwards gesture actions to the tab that last had a video.
const GRACE_MS = 2 * 60 * 1000;
const tabs = new Map(); // tabId -> { playing, at }

const enabled = async () => (await chrome.storage.local.get({ enabled: true })).enabled;

async function sync() {
  const now = Date.now();
  const wanted = (await enabled()) && [...tabs.values()].some((t) => t.playing || now - t.at < GRACE_MS);
  const has = (await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] })).length > 0;
  if (wanted && !has) {
    await chrome.offscreen.createDocument({ url: 'offscreen.html', reasons: ['USER_MEDIA'], justification: 'Webcam gesture recognition for video control' });
  } else if (!wanted && has) {
    await chrome.offscreen.closeDocument();
    chrome.storage.session.set({ diag: null });
  }
}

chrome.runtime.onMessage.addListener((m, sender) => {
  if (m.type === 'video-state' && sender.tab) {
    tabs.set(sender.tab.id, { playing: m.playing, at: Date.now() });
    sync();
  } else if (m.type === 'action') {
    const [id] = [...tabs.entries()].sort((a, b) => b[1].at - a[1].at)[0] || [];
    if (id != null) chrome.tabs.sendMessage(id, { type: 'wave', action: m.action }).catch(() => {});
  } else if (m.type === 'slept') {
    chrome.storage.local.set({ slept: { url: m.url, title: m.title, time: m.time, at: Date.now() } });
  } else if (m.type === 'bookmark') {
    chrome.storage.local.get({ bookmarks: [] }).then(({ bookmarks }) => {
      bookmarks.unshift({ url: m.url, title: m.title, time: m.time, at: Date.now() });
      chrome.storage.local.set({ bookmarks: bookmarks.slice(0, 200) }); // shortcut: capped at 200, oldest dropped
    });
  } else if (m.type === 'stats') {
    chrome.storage.session.set({ diag: { ...m, at: Date.now() } });
  }
});

chrome.tabs.onRemoved.addListener((id) => { tabs.delete(id); sync(); });
chrome.storage.onChanged.addListener((c) => c.enabled && sync());
chrome.commands.onCommand.addListener(async () => chrome.storage.local.set({ enabled: !(await enabled()) }));
chrome.alarms.create('sync', { periodInMinutes: 0.5 });
chrome.alarms.onAlarm.addListener(sync);
