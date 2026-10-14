const assert = require('assert');
const H = require('../www/js/logic.js');
const LEVELS = require('../www/js/levels.js');

function test(name, fn) {
  try {
    fn();
    console.log('ok -', name);
  } catch (e) {
    console.error('FAIL -', name);
    throw e;
  }
}

test('create + degree empty', () => {
  const st = H.createPuzzle(3, 3, [
    { id: 0, r: 0, c: 0, clue: 1 },
    { id: 1, r: 0, c: 2, clue: 1 },
  ]);
  assert.strictEqual(H.degree(st, 0), 0);
  assert.ok(H.canSee(st, 0, 1));
});

test('cycle bridge 0-1-2-0 and complete', () => {
  const st0 = H.createPuzzle(3, 3, [
    { id: 0, r: 0, c: 0, clue: 2 },
    { id: 1, r: 0, c: 2, clue: 2 },
  ]);
  let r = H.cycleBridge(st0, 0, 1);
  assert.ok(r.ok);
  assert.strictEqual(r.state.bridges[H.keyBridge(0, 1)], 1);
  r = H.cycleBridge(r.state, 0, 1);
  assert.ok(r.ok);
  assert.strictEqual(r.state.bridges[H.keyBridge(0, 1)], 2);
  assert.ok(H.isComplete(r.state));
  r = H.cycleBridge(r.state, 0, 1);
  assert.ok(r.ok);
  assert.ok(!r.state.bridges[H.keyBridge(0, 1)]);
});

test('bridges cannot cross', () => {
  // 4 islands in a square — diagonals aren't allowed; orthogonal cross:
  // A(0,1) — C(2,1) vertical and B(1,0) — D(1,2) horizontal cross at (1,1)
  const st = H.createPuzzle(3, 3, [
    { id: 0, r: 0, c: 1, clue: 1 },
    { id: 1, r: 1, c: 0, clue: 1 },
    { id: 2, r: 1, c: 2, clue: 1 },
    { id: 3, r: 2, c: 1, clue: 1 },
  ]);
  let r = H.setBridge(st, 0, 3, 1);
  assert.ok(r.ok);
  r = H.setBridge(r.state, 1, 2, 1);
  assert.ok(!r.ok);
  assert.strictEqual(r.reason, 'cross');
});

test('island blocks line of sight', () => {
  const st = H.createPuzzle(1, 5, [
    { id: 0, r: 0, c: 0, clue: 1 },
    { id: 1, r: 0, c: 2, clue: 2 },
    { id: 2, r: 0, c: 4, clue: 1 },
  ]);
  assert.ok(!H.canSee(st, 0, 2));
  assert.ok(H.canSee(st, 0, 1));
});

test('over-clue rejected', () => {
  const st = H.createPuzzle(1, 3, [
    { id: 0, r: 0, c: 0, clue: 1 },
    { id: 1, r: 0, c: 2, clue: 1 },
  ]);
  let r = H.setBridge(st, 0, 1, 2);
  assert.ok(!r.ok);
  assert.strictEqual(r.reason, 'over');
});

test('solver solves tiny puzzle', () => {
  const st = H.createPuzzle(3, 3, [
    { id: 0, r: 0, c: 0, clue: 1 },
    { id: 1, r: 0, c: 2, clue: 2 },
    { id: 2, r: 2, c: 2, clue: 1 },
  ]);
  const sol = H.solve(st, { nodeLimit: 50000 });
  assert.ok(sol);
  st.bridges = sol;
  assert.ok(H.isComplete(st));
});

test('all packed levels have complete solutions', () => {
  assert.ok(LEVELS.length >= 30, 'expected 30+ levels');
  for (const lv of LEVELS) {
    const st = H.createPuzzle(lv.rows, lv.cols, lv.islands);
    st.bridges = Object.assign({}, lv.solution);
    assert.ok(H.isComplete(st), 'level ' + lv.id + ' solution invalid');
  }
});

test('solver recovers solution for first 8 levels from empty', () => {
  for (const lv of LEVELS.slice(0, 8)) {
    const st = H.createPuzzle(lv.rows, lv.cols, lv.islands);
    const sol = H.solve(st, { nodeLimit: 400000 });
    assert.ok(sol, 'unsolvable level ' + lv.id);
    st.bridges = sol;
    assert.ok(H.isComplete(st));
  }
});

test('hint returns a useful change', () => {
  const lv = LEVELS[0];
  const st = H.createPuzzle(lv.rows, lv.cols, lv.islands);
  const h = H.hint(st);
  assert.ok(h);
  assert.ok(h.count >= 1 && h.count <= 2);
});

console.log('\nAll tests passed.');
