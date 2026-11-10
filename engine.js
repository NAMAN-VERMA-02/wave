// Pure gesture -> action logic. No browser APIs, so it is testable without a camera.
// One observation per frame in: {t: ms, gesture: string|null, score: 0..1}. Actions out.
var WaveEngine = (function () {
  const DEFAULT_MAP = {
    Open_Palm: { type: 'toggle' },
    Closed_Fist: { type: 'mute' },
    Victory: { type: 'seek', by: 10 },
    Pointing_Up: { type: 'seek', by: -10 },
    Thumb_Up: { type: 'volume', by: 0.1, repeat: true },
    Thumb_Down: { type: 'volume', by: -0.1, repeat: true },
  };
  const CFG = { holdMs: 500, repeatMs: 400, cooldownMs: 1000, minScore: 0.6, gapMs: 200, idleFps: 2, activeFps: 15, activeForMs: 5000 };

  function create(map = DEFAULT_MAP, cfg = CFG) {
    let cur = null, since = 0, lastSeen = -Infinity, firedAt = -Infinity, lastAnyFire = -Infinity, handAt = -Infinity;

    function step({ t, gesture, score }) {
      const g = gesture && score >= cfg.minScore && map[gesture] ? gesture : null;
      const out = [];
      if (gesture) handAt = t;
      if (g) {
        // A gap shorter than gapMs (a flickering frame) does not restart the hold.
        if (g !== cur || t - lastSeen > cfg.gapMs) { cur = g; since = t; firedAt = -Infinity; }
        lastSeen = t;
        const a = map[g];
        const held = t - since >= cfg.holdMs;
        const first = firedAt === -Infinity;
        const again = a.repeat && t - firedAt >= cfg.repeatMs;
        if (held && (first ? t - lastAnyFire >= cfg.cooldownMs || a.repeat : again)) {
          out.push(a); firedAt = t; lastAnyFire = t;
        }
      } else if (t - lastSeen > cfg.gapMs) {
        cur = null;
      }
      // Battery-smart: slow polling until a hand has been seen recently.
      const fps = t - handAt <= cfg.activeForMs ? cfg.activeFps : cfg.idleFps;
      return { actions: out, fps };
    }
    return { step };
  }
  return { create, DEFAULT_MAP, CFG };
})();
if (typeof module !== 'undefined') module.exports = WaveEngine;
