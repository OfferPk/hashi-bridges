/**
 * Zen Bridges — pure Hashiwokakero rules (no DOM).
 * Works in Node (tests) and browser (window.HashiLogic).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HashiLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function keyBridge(a, b) {
    return a < b ? a + '-' + b : b + '-' + a;
  }

  function cloneState(state) {
    return {
      rows: state.rows,
      cols: state.cols,
      islands: state.islands.map((i) => ({ id: i.id, r: i.r, c: i.c, clue: i.clue })),
      bridges: Object.assign({}, state.bridges),
    };
  }

  function createPuzzle(rows, cols, islands) {
    const list = islands.map((i, idx) => ({
      id: i.id != null ? i.id : idx,
      r: i.r,
      c: i.c,
      clue: i.clue,
    }));
    return { rows, cols, islands: list, bridges: {} };
  }

  function islandAt(state, r, c) {
    return state.islands.find((i) => i.r === r && i.c === c) || null;
  }

  function islandById(state, id) {
    return state.islands.find((i) => i.id === id) || null;
  }

  /** Are two islands aligned (same row or col) with clear path (no island between)? */
  function canSee(state, aId, bId) {
    const a = islandById(state, aId);
    const b = islandById(state, bId);
    if (!a || !b || a.id === b.id) return false;
    if (a.r !== b.r && a.c !== b.c) return false;
    const r0 = Math.min(a.r, b.r);
    const r1 = Math.max(a.r, b.r);
    const c0 = Math.min(a.c, b.c);
    const c1 = Math.max(a.c, b.c);
    for (const i of state.islands) {
      if (i.id === a.id || i.id === b.id) continue;
      if (a.r === b.r) {
        if (i.r === a.r && i.c > c0 && i.c < c1) return false;
      } else {
        if (i.c === a.c && i.r > r0 && i.r < r1) return false;
      }
    }
    return true;
  }

  function bridgeCrosses(state, aId, bId) {
    const a = islandById(state, aId);
    const b = islandById(state, bId);
    if (!a || !b) return true;
    const horiz = a.r === b.r;
    const r0 = Math.min(a.r, b.r);
    const r1 = Math.max(a.r, b.r);
    const c0 = Math.min(a.c, b.c);
    const c1 = Math.max(a.c, b.c);

    for (const k of Object.keys(state.bridges)) {
      if (!state.bridges[k]) continue;
      const [x, y] = k.split('-').map(Number);
      if (x === aId || x === bId || y === aId || y === bId) continue; // share endpoint: not a cross
      const p = islandById(state, x);
      const q = islandById(state, y);
      if (!p || !q) continue;
      const oh = p.r === q.r;
      if (horiz === oh) continue; // parallel, no cross
      if (horiz) {
        // new horizontal at row a.r, cols (c0,c1); other vertical at col p.c, rows (pr0,pr1)
        const pr0 = Math.min(p.r, q.r);
        const pr1 = Math.max(p.r, q.r);
        const pc = p.c;
        if (pc > c0 && pc < c1 && a.r > pr0 && a.r < pr1) return true;
      } else {
        const pc0 = Math.min(p.c, q.c);
        const pc1 = Math.max(p.c, q.c);
        const pr = p.r;
        if (a.c > pc0 && a.c < pc1 && pr > r0 && pr < r1) return true;
      }
    }
    return false;
  }

  function degree(state, id) {
    let d = 0;
    for (const k of Object.keys(state.bridges)) {
      const n = state.bridges[k] || 0;
      if (!n) continue;
      const [x, y] = k.split('-').map(Number);
      if (x === id || y === id) d += n;
    }
    return d;
  }

  function neighborsVisible(state, id) {
    return state.islands.filter((i) => i.id !== id && canSee(state, id, i.id)).map((i) => i.id);
  }

  /**
   * Cycle bridge count between a and b: 0 -> 1 -> 2 -> 0.
   * Returns { ok, state, reason }.
   */
  function cycleBridge(state, aId, bId) {
    const next = cloneState(state);
    if (!canSee(next, aId, bId)) return { ok: false, state, reason: 'blocked' };
    const k = keyBridge(aId, bId);
    const cur = next.bridges[k] || 0;
    // Temporarily remove to check crossing for a new bridge
    delete next.bridges[k];
    if (cur < 2 && bridgeCrosses(next, aId, bId)) {
      next.bridges[k] = cur; // restore
      if (!cur) delete next.bridges[k];
      return { ok: false, state, reason: 'cross' };
    }
    const neu = (cur + 1) % 3;
    // Check degrees would not exceed clues after setting neu
    next.bridges[k] = neu;
    if (!neu) delete next.bridges[k];
    const a = islandById(next, aId);
    const b = islandById(next, bId);
    if (degree(next, aId) > a.clue || degree(next, bId) > b.clue) {
      return { ok: false, state, reason: 'over' };
    }
    return { ok: true, state: next, reason: 'ok' };
  }

  function setBridge(state, aId, bId, count) {
    const next = cloneState(state);
    if (count < 0 || count > 2) return { ok: false, state, reason: 'range' };
    if (!canSee(next, aId, bId)) return { ok: false, state, reason: 'blocked' };
    const k = keyBridge(aId, bId);
    delete next.bridges[k];
    if (count > 0 && bridgeCrosses(next, aId, bId)) {
      return { ok: false, state, reason: 'cross' };
    }
    if (count > 0) next.bridges[k] = count;
    const a = islandById(next, aId);
    const b = islandById(next, bId);
    if (degree(next, aId) > a.clue || degree(next, bId) > b.clue) {
      return { ok: false, state, reason: 'over' };
    }
    return { ok: true, state: next, reason: 'ok' };
  }

  function isComplete(state) {
    for (const i of state.islands) {
      if (degree(state, i.id) !== i.clue) return false;
    }
    return isConnected(state);
  }

  function isConnected(state) {
    if (state.islands.length <= 1) return true;
    const adj = new Map();
    for (const i of state.islands) adj.set(i.id, []);
    for (const k of Object.keys(state.bridges)) {
      if (!state.bridges[k]) continue;
      const [x, y] = k.split('-').map(Number);
      adj.get(x).push(y);
      adj.get(y).push(x);
    }
    const start = state.islands[0].id;
    const seen = new Set([start]);
    const q = [start];
    while (q.length) {
      const u = q.shift();
      for (const v of adj.get(u) || []) {
        if (!seen.has(v)) {
          seen.add(v);
          q.push(v);
        }
      }
    }
    return seen.size === state.islands.length;
  }

  function statusMap(state) {
    // per island: 'ok' | 'under' | 'over' | 'exact'
    const map = {};
    for (const i of state.islands) {
      const d = degree(state, i.id);
      if (d > i.clue) map[i.id] = 'over';
      else if (d === i.clue) map[i.id] = 'exact';
      else map[i.id] = 'under';
    }
    return map;
  }

  /** Simple backtracking solver; returns one solution bridges map or null. */
  function solve(state, opts) {
    const limit = (opts && opts.nodeLimit) || 200000;
    let nodes = 0;
    const base = cloneState(state);
    // Clear player bridges — solve from empty unless keepPartial
    if (!(opts && opts.keepPartial)) base.bridges = {};

    const islands = base.islands;
    // Candidate pairs: visible pairs, stable order
    const pairs = [];
    for (let i = 0; i < islands.length; i++) {
      for (let j = i + 1; j < islands.length; j++) {
        if (canSee(base, islands[i].id, islands[j].id)) {
          pairs.push([islands[i].id, islands[j].id]);
        }
      }
    }

    function feasible(st) {
      for (const isl of st.islands) {
        if (degree(st, isl.id) > isl.clue) return false;
      }
      // Remaining capacity must be placeable (loose check)
      for (const isl of st.islands) {
        const need = isl.clue - degree(st, isl.id);
        if (need < 0) return false;
        let cap = 0;
        for (const nid of neighborsVisible(st, isl.id)) {
          const k = keyBridge(isl.id, nid);
          const cur = st.bridges[k] || 0;
          const other = islandById(st, nid);
          const otherNeed = other.clue - degree(st, nid);
          // Max additional on this edge
          let addMax = 2 - cur;
          if (addMax <= 0) continue;
          // Crossing?
          if (cur === 0) {
            const tmp = cloneState(st);
            delete tmp.bridges[k];
            if (bridgeCrosses(tmp, isl.id, nid)) continue;
          }
          addMax = Math.min(addMax, need, Math.max(0, otherNeed + (degree(st, nid) - (st.bridges[k] ? 0 : 0))));
          // simpler: remaining slots on edge limited by both clues remaining + edge room
          const room = 2 - cur;
          const aRem = isl.clue - degree(st, isl.id);
          const bRem = other.clue - degree(st, nid);
          cap += Math.min(room, aRem, bRem);
        }
        if (cap < need) return false;
      }
      return true;
    }

    function dfs(idx, st) {
      nodes++;
      if (nodes > limit) return null;
      if (!feasible(st)) return null;
      if (idx >= pairs.length) {
        return isComplete(st) ? st.bridges : null;
      }
      const [a, b] = pairs[idx];
      const k = keyBridge(a, b);
      const already = st.bridges[k] || 0;
      // If partial keep, don't reduce — try already..2
      const options = already > 0 ? [already] : [0, 1, 2];
      // Prefer filling when both need a lot
      const ordered = options.slice().sort((x, y) => {
        // try higher first when underfilled
        return y - x;
      });
      for (const n of ordered) {
        let next = st;
        if (n !== already) {
          const res = setBridge(st, a, b, n);
          if (!res.ok) continue;
          next = res.state;
        }
        const sol = dfs(idx + 1, next);
        if (sol) return sol;
      }
      return null;
    }

    return dfs(0, base);
  }

  /** Suggest one helpful bridge change from current state toward a solution. */
  function hint(state) {
    const sol = solve(state, { keepPartial: false, nodeLimit: 300000 });
    if (!sol) return null;
    // Find first differing edge
    const keys = new Set([...Object.keys(sol), ...Object.keys(state.bridges)]);
    for (const k of keys) {
      const want = sol[k] || 0;
      const have = state.bridges[k] || 0;
      if (want !== have) {
        const [a, b] = k.split('-').map(Number);
        return { a, b, count: want };
      }
    }
    return null;
  }

  /** Validate a packed level definition. */
  function validateLevel(level) {
    const st = createPuzzle(level.rows, level.cols, level.islands);
    if (level.solution) {
      st.bridges = Object.assign({}, level.solution);
      if (!isComplete(st)) return { ok: false, reason: 'bad_solution' };
      return { ok: true };
    }
    const sol = solve(st, { nodeLimit: 400000 });
    if (!sol) return { ok: false, reason: 'unsolvable' };
    return { ok: true, solution: sol };
  }

  return {
    keyBridge,
    cloneState,
    createPuzzle,
    islandAt,
    islandById,
    canSee,
    bridgeCrosses,
    degree,
    neighborsVisible,
    cycleBridge,
    setBridge,
    isComplete,
    isConnected,
    statusMap,
    solve,
    hint,
    validateLevel,
  };
});
