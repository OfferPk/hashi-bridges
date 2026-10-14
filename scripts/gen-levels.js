/** Generate solvable Hashi levels and write www/js/levels.js */
const fs = require('fs');
const path = require('path');
const H = require('../www/js/logic.js');

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function tryGenerate(rows, cols, islandCount, seed) {
  const rnd = mulberry32(seed);
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) cells.push([r, c]);
  // shuffle
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }
  const picked = cells.slice(0, islandCount).map(([r, c], id) => ({ id, r, c, clue: 0 }));
  // Ensure minimum spacing? optional — allow adjacent for small puzzles
  let state = H.createPuzzle(rows, cols, picked);

  // Build a random spanning-ish connected bridge plan
  const ids = picked.map((p) => p.id);
  // Start from random order of potential edges
  const edges = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      if (H.canSee(state, ids[i], ids[j])) edges.push([ids[i], ids[j]]);
    }
  }
  for (let i = edges.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [edges[i], edges[j]] = [edges[j], edges[i]];
  }

  // Kruskal-like: connect components, then add extras
  const parent = {};
  ids.forEach((id) => (parent[id] = id));
  function find(x) {
    return parent[x] === x ? x : (parent[x] = find(parent[x]));
  }
  function uni(a, b) {
    a = find(a);
    b = find(b);
    if (a === b) return false;
    parent[a] = b;
    return true;
  }

  const solution = {};
  let components = ids.length;
  for (const [a, b] of edges) {
    if (components === 1) break;
    const k = H.keyBridge(a, b);
    // check cross against current solution
    const tmp = H.cloneState(state);
    tmp.bridges = Object.assign({}, solution);
    if (H.bridgeCrosses(tmp, a, b)) continue;
    if (uni(a, b)) {
      solution[k] = 1;
      components--;
    }
  }
  if (components !== 1) return null;

  // Add a few double bridges / extra edges
  const extras = Math.floor(islandCount * 0.35 + rnd() * 3);
  let added = 0;
  for (const [a, b] of edges) {
    if (added >= extras) break;
    const k = H.keyBridge(a, b);
    const tmp = H.cloneState(state);
    tmp.bridges = Object.assign({}, solution);
    if (!solution[k]) {
      if (H.bridgeCrosses(tmp, a, b)) continue;
      solution[k] = rnd() < 0.55 ? 1 : 2;
      added++;
    } else if (solution[k] === 1 && rnd() < 0.4) {
      solution[k] = 2;
      added++;
    }
  }

  // Set clues from degrees
  state.bridges = solution;
  const islands = picked.map((p) => ({
    id: p.id,
    r: p.r,
    c: p.c,
    clue: H.degree(state, p.id),
  }));
  // Reject islands with clue 0
  if (islands.some((i) => i.clue < 1 || i.clue > 8)) return null;

  const puzzle = H.createPuzzle(rows, cols, islands);
  // Verify completeness of intended solution
  puzzle.bridges = Object.assign({}, solution);
  if (!H.isComplete(puzzle)) return null;

  // Ensure solver finds a solution from empty (may differ but must exist)
  const empty = H.createPuzzle(rows, cols, islands);
  const sol = H.solve(empty, { nodeLimit: 250000 });
  if (!sol) return null;

  return {
    rows,
    cols,
    islands: islands.map(({ id, r, c, clue }) => ({ id, r, c, clue })),
    solution: sol, // canonical solver solution
  };
}

const specs = [
  // tutorial / easy
  ...Array.from({ length: 6 }, (_, i) => ({ rows: 5, cols: 5, n: 4 + (i % 2), label: 'easy' })),
  ...Array.from({ length: 8 }, (_, i) => ({ rows: 6, cols: 6, n: 5 + (i % 3), label: 'easy' })),
  ...Array.from({ length: 8 }, (_, i) => ({ rows: 7, cols: 7, n: 7 + (i % 3), label: 'medium' })),
  ...Array.from({ length: 8 }, (_, i) => ({ rows: 8, cols: 8, n: 9 + (i % 4), label: 'medium' })),
  ...Array.from({ length: 6 }, (_, i) => ({ rows: 9, cols: 9, n: 11 + (i % 4), label: 'hard' })),
  ...Array.from({ length: 4 }, (_, i) => ({ rows: 10, cols: 10, n: 14 + (i % 3), label: 'hard' })),
];

const levels = [];
let seed = 20261014;
for (let i = 0; i < specs.length && levels.length < 40; i++) {
  const sp = specs[i];
  let found = null;
  for (let attempt = 0; attempt < 80 && !found; attempt++) {
    seed++;
    found = tryGenerate(sp.rows, sp.cols, sp.n, seed);
  }
  if (found) {
    levels.push({
      id: levels.length + 1,
      name: `Level ${levels.length + 1}`,
      difficulty: sp.label,
      rows: found.rows,
      cols: found.cols,
      islands: found.islands,
      // store solution for tests / hints fallback
      solution: found.solution,
    });
    process.stdout.write('.');
  } else {
    process.stdout.write('x');
  }
}
console.log('\nGenerated', levels.length, 'levels');

const out = `/** Auto-generated Hashi level pack — do not hand-edit solutions. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HashiLevels = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  return ${JSON.stringify(levels)};
});
`;
fs.writeFileSync(path.join(__dirname, '..', 'www', 'js', 'levels.js'), out);
console.log('Wrote www/js/levels.js');
