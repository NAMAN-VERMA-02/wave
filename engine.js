// Pure gesture/face -> action logic. No browser APIs, so it is testable without a camera.
// One observation per frame in:
//   {t: ms, gesture: string|null, score: 0..1, pinch?: {dist, x, y}, face?: {n, width, eyes}}
// `face` is only present on frames where the face model ran. Actions out.
var WaveEngine = (function () {
  const DEFAULT_MAP = {
    Open_Palm: { type: 'toggle' },
    Closed_Fist: { type: 'mute' },
    Victory: { type: 'seek', by: 10 },
    Pointing_Up: { type: 'seek', by: -10 },
    Thumb_Up: { type: 'volume', by: 0.1, repeat: true },
    Thumb_Down: { type: 'volume', by: -0.1, repeat: true },
    ILoveYou: { type: 'bookmark' },
  };
  const CFG = { holdMs: 500, repeatMs: 400, cooldownMs: 1000, minScore: 0.6, gapMs: 200, idleFps: 2, activeFps: 15, activeForMs: 5000,
    pinchDist: 0.05, scrubSeconds: 120, sleepMs: 60000, roommateMs: 1000, captionMs: 5000, eyesClosed: 0.6, captionOn: 0.6, captionOff: 0.75 };
  const FEATURES = { away: true, awayMs: 3000, sleep: true, roommate: false, captions: false, baseline: null, scrub: true };

  function create(map = DEFAULT_MAP, cfg = CFG, getF = FEATURES) {
    const feat = () => ({ ...FEATURES, ...(typeof getF === 'function' ? getF() : getF) });
    let cur = null, since = 0, lastSeen = -Infinity, firedAt = -Infinity, lastAnyFire = -Infinity, handAt = -Infinity;
    let pin = null, pinLast = null, quietUntil = -Infinity;
    const away = {}, eyes = {}, mate = {}, cap = { on: false };

    // Fires once after `cond` has held for `ms`; re-arms when it stops holding.
    function hold(st, t, cond, ms) {
      if (!cond) { st.s = null; st.fired = false; return false; }
      st.s ??= t;
      if (!st.fired && t - st.s >= ms) { st.fired = true; return true; }
      return false;
    }

    function faceRules(t, f, o, out) {
      if (o.away) {
        const gone = f.n === 0;
        if (hold(away, t, gone, o.awayMs)) out.push({ type: 'away-pause' });
        else if (!gone && away.wasFired) out.push({ type: 'away-resume' });
        away.wasFired = away.fired;
      }
      if (o.sleep && hold(eyes, t, f.n > 0 && f.eyes > cfg.eyesClosed, cfg.sleepMs)) out.push({ type: 'sleep' });
      if (o.roommate && hold(mate, t, f.n >= 2, cfg.roommateMs)) out.push({ type: 'roommate-pause' });
      if (o.captions && o.baseline && f.n > 0) {
        const r = f.width / o.baseline;
        const want = cap.on ? (r > cfg.captionOff ? false : null) : (r < cfg.captionOn ? true : null);
        if (want === null) cap.s = null;
        else { cap.s ??= t; if (t - cap.s >= cfg.captionMs) { cap.on = want; cap.s = null; out.push({ type: 'captions', on: want }); } }
      }
    }

    // Pinch, drag in the air, release: the dominant axis decides seek (x) or volume (y).
    function scrub(t, obs, out) {
      const pinching = obs.pinch && obs.pinch.dist < cfg.pinchDist;
      if (pinching) {
        pin ??= { x: obs.pinch.x, y: obs.pinch.y };
        pinLast = obs.pinch; quietUntil = t + 400;
        return;
      }
      if (!pin) return;
      const dx = -(pinLast.x - pin.x), dy = pin.y - pinLast.y; // camera image is not mirrored
      if (Math.abs(dx) >= Math.abs(dy)) {
        const by = Math.round(dx * cfg.scrubSeconds);
        if (Math.abs(by) >= 2) out.push({ type: 'seek', by });
      } else if (Math.abs(dy) >= 0.1) out.push({ type: 'volume', by: Math.round(dy * 10) / 10 });
      pin = null; quietUntil = t + 400;
    }

    function step(obs) {
      const { t, gesture, score } = obs;
      const o = feat(), out = [];
      if (gesture || obs.pinch) handAt = t;
      if (obs.face) faceRules(t, obs.face, o, out);
      if (o.scrub) scrub(t, obs, out);

      const g = t >= quietUntil && gesture && score >= cfg.minScore && map[gesture] ? gesture : null;
      if (t < quietUntil) cur = null;
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
      return { actions: out, fps: t - handAt <= cfg.activeForMs ? cfg.activeFps : cfg.idleFps };
    }
    return { step };
  }
  return { create, DEFAULT_MAP, CFG, FEATURES };
})();
if (typeof module !== 'undefined') module.exports = WaveEngine;
