const test = require('node:test'), assert = require('node:assert');
const W = require('../engine.js');

// Feed `gesture` for [from, to) ms at 50 ms frames; returns all fired action types.
function run(e, gesture, from, to, score = 0.9) {
  const fired = [];
  for (let t = from; t < to; t += 50) fired.push(...e.step({ t, gesture, score }).actions.map((a) => a.type + (a.by ?? '')));
  return fired;
}

test('palm held 600 ms fires toggle once', () => {
  assert.deepStrictEqual(run(W.create(), 'Open_Palm', 0, 2000), ['toggle']);
});
test('300 ms flicker fires nothing', () => {
  assert.deepStrictEqual(run(W.create(), 'Open_Palm', 0, 300), []);
});
test('low confidence is ignored', () => {
  assert.deepStrictEqual(run(W.create(), 'Open_Palm', 0, 2000, 0.4), []);
});
test('unknown gesture is ignored', () => {
  assert.deepStrictEqual(run(W.create(), 'None', 0, 2000), []);
});
test('held thumbs-up repeats every 400 ms', () => {
  const f = run(W.create(), 'Thumb_Up', 0, 2000);
  assert.ok(f.length >= 4 && f.every((x) => x === 'volume0.1'), f.join());
});
test('one dropped frame does not restart the hold', () => {
  const e = W.create();
  const f = [...run(e, 'Victory', 0, 300), ...run(e, null, 300, 350), ...run(e, 'Victory', 350, 800)];
  assert.deepStrictEqual(f, ['seek10']);
});
test('cooldown blocks a different gesture right after a fire', () => {
  const e = W.create();
  const f = [...run(e, 'Open_Palm', 0, 700), ...run(e, null, 700, 800), ...run(e, 'Closed_Fist', 800, 1400)];
  assert.deepStrictEqual(f, ['toggle']);
});
test('lowering the hand allows firing again', () => {
  const e = W.create();
  const f = [...run(e, 'Open_Palm', 0, 700), ...run(e, null, 700, 1500), ...run(e, 'Open_Palm', 1500, 2300)];
  assert.deepStrictEqual(f, ['toggle', 'toggle']);
});
test('camera idles at 2 fps, speeds up near a hand, slows after 5 s', () => {
  const e = W.create();
  assert.equal(e.step({ t: 0, gesture: null, score: 0 }).fps, 2);
  assert.equal(e.step({ t: 100, gesture: 'None', score: 0.9 }).fps, 15);
  assert.equal(e.step({ t: 4000, gesture: null, score: 0 }).fps, 15);
  assert.equal(e.step({ t: 6000, gesture: null, score: 0 }).fps, 2);
});

// ---- phase 2 + 3 ----
const feed = (e, from, to, mk, dt = 100) => { const out = []; for (let t = from; t < to; t += dt) out.push(...e.step({ t, gesture: null, score: 0, ...mk(t) }).actions.map((a) => a.type + (a.by ?? ''))); return out; };
const FACE = { n: 1, width: 0.3, eyes: 0.1 };

test('look-away: 2.9 s does nothing, 3.1 s pauses, return resumes once', () => {
  const e = W.create();
  assert.deepStrictEqual(feed(e, 0, 2900, () => ({ face: { ...FACE, n: 0 } })), []);
  const e2 = W.create();
  assert.deepStrictEqual(feed(e2, 0, 3200, () => ({ face: { ...FACE, n: 0 } })), ['away-pause']);
  assert.deepStrictEqual(feed(e2, 3200, 4200, () => ({ face: FACE })), ['away-resume']);
});
test('return after a short absence does not resume', () => {
  const e = W.create();
  feed(e, 0, 2000, () => ({ face: { ...FACE, n: 0 } }));
  assert.deepStrictEqual(feed(e, 2000, 3000, () => ({ face: FACE })), []);
});
test('sleep: blink ignored, 60 s closed fires once', () => {
  const e = W.create();
  assert.deepStrictEqual(feed(e, 0, 300, () => ({ face: { ...FACE, eyes: 0.9 } })), []);
  feed(e, 300, 2000, () => ({ face: FACE }));
  assert.deepStrictEqual(feed(e, 2000, 70000, () => ({ face: { ...FACE, eyes: 0.9 } }), 1000), ['sleep']);
});
test('roommate off by default, pauses at 1 s when on', () => {
  const two = () => ({ face: { ...FACE, n: 2 } });
  assert.deepStrictEqual(feed(W.create(), 0, 3000, two), []);
  assert.deepStrictEqual(feed(W.create(undefined, undefined, { roommate: true }), 0, 3000, two), ['roommate-pause']);
  assert.deepStrictEqual(feed(W.create(undefined, undefined, { roommate: true }), 0, 700, two), []);
});
test('captions use hysteresis between 60% and 75% of baseline', () => {
  const e = W.create(undefined, undefined, { captions: true, baseline: 0.4 });
  const at = (w) => () => ({ face: { ...FACE, width: w } });
  assert.deepStrictEqual(feed(e, 0, 6000, at(0.2)), ['captions']);      // 50% -> on
  assert.deepStrictEqual(feed(e, 6000, 15000, at(0.28)), []);           // 70%: between limits, stays on
  assert.deepStrictEqual(feed(e, 15000, 22000, at(0.35)), ['captions']); // 87% -> off
});
test('features off emit nothing', () => {
  const e = W.create(undefined, undefined, { away: false, sleep: false });
  assert.deepStrictEqual(feed(e, 0, 70000, () => ({ face: { ...FACE, n: 0 } }), 1000), []);
});
test('air scrub: drag right = seek forward on release; small move = nothing', () => {
  const pinch = (x, y = 0.5) => () => ({ pinch: { dist: 0.02, x, y } });
  const open = { pinch: { dist: 0.2, x: 0.5, y: 0.5 } };
  let e = W.create();
  feed(e, 0, 300, pinch(0.7)); feed(e, 300, 600, pinch(0.4)); // image x falls = hand moves right
  assert.deepStrictEqual(feed(e, 600, 700, () => open), ['seek36']);
  e = W.create();
  feed(e, 0, 300, pinch(0.5)); feed(e, 300, 600, pinch(0.49));
  assert.deepStrictEqual(feed(e, 600, 700, () => open), []);
});
test('air scrub: vertical drag up = volume up', () => {
  const e = W.create();
  const p = (y) => () => ({ pinch: { dist: 0.02, x: 0.5, y } });
  feed(e, 0, 300, p(0.7)); feed(e, 300, 600, p(0.4));
  assert.deepStrictEqual(feed(e, 600, 700, () => ({ pinch: { dist: 0.2, x: 0.5, y: 0.4 } })), ['volume0.3']);
});
test('pinch suppresses gestures; bookmark gesture fires', () => {
  const e = W.create();
  const f = [];
  for (let t = 0; t < 1500; t += 50) f.push(...e.step({ t, gesture: 'Closed_Fist', score: 0.9, pinch: { dist: 0.02, x: 0.5, y: 0.5 } }).actions);
  assert.deepStrictEqual(f, []);
  assert.deepStrictEqual(run(W.create(), 'ILoveYou', 0, 2000), ['bookmark']);
});
