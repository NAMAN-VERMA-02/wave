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
  assert.deepStrictEqual(run(W.create(), 'ILoveYou', 0, 2000), []);
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
