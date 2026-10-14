(function () {
  'use strict';
  const H = window.HashiLogic;
  const LEVELS = window.HashiLevels;
  const STORE_KEY = 'zen-bridges-v1';

  const $ = (id) => document.getElementById(id);
  const screens = {
    home: $('home'),
    levels: $('levels'),
    play: $('play'),
    settings: $('settings'),
  };

  let save = load();
  let state = null;
  let levelIndex = 0;
  let selectedId = null;
  let activeId = null;
  let history = [];
  let animPulse = 0;

  const canvas = $('board');
  const ctx = canvas.getContext('2d');

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {
      cleared: {},
      current: 0,
      streak: 0,
      bestStreak: 0,
      sound: true,
      haptic: true,
    };
  }
  function persist() {
    localStorage.setItem(STORE_KEY, JSON.stringify(save));
  }

  function show(name) {
    Object.keys(screens).forEach((k) => screens[k].classList.toggle('active', k === name));
  }

  function haptic() {
    if (!save.haptic) return;
    try {
      if (navigator.vibrate) navigator.vibrate(12);
    } catch (_) {}
  }

  function updateHome() {
    const n = Object.keys(save.cleared).length;
    $('stat-cleared').textContent = String(n);
    $('stat-streak').textContent = String(save.bestStreak || 0);
    const cont = Math.min(save.current || 0, LEVELS.length - 1);
    const label = n === 0 && cont === 0 ? 'Play level 1' : `Continue · Level ${cont + 1}`;
    $('btn-continue').textContent = label;
    HashiSound.setEnabled(!!save.sound);
    $('play-sound').textContent = save.sound ? '🔊' : '🔇';
    $('play-sound').setAttribute('aria-label', save.sound ? 'Mute sound' : 'Enable sound');
    $('play-sound').setAttribute('aria-pressed', String(!!save.sound));
    $('sw-sound').classList.toggle('on', !!save.sound);
    $('sw-haptic').classList.toggle('on', !!save.haptic);
    $('sw-sound').setAttribute('aria-pressed', String(!!save.sound));
    $('sw-haptic').setAttribute('aria-pressed', String(!!save.haptic));
  }

  function canPlayLevel(i) {
    return i === 0 || !!save.cleared[i - 1] || !!save.cleared[i];
  }

  function renderLevels() {
    const grid = $('levels-grid');
    grid.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const b = document.createElement('button');
      b.className = 'lvl';
      const canPlay = canPlayLevel(i);
      if (!canPlay) b.classList.add('locked');
      if (save.cleared[i]) b.classList.add('done');
      b.innerHTML = `<span>${i + 1}</span><small>${lv.difficulty}</small>`;
      b.disabled = !canPlay;
      const levelState = save.cleared[i] ? 'completed' : canPlay ? 'available' : 'locked';
      b.setAttribute('aria-label', `Level ${i + 1}, ${lv.difficulty}, ${levelState}`);
      b.addEventListener('click', () => startLevel(i));
      grid.appendChild(b);
    });
  }

  function startLevel(i) {
    levelIndex = i;
    save.current = i;
    persist();
    const lv = LEVELS[i];
    state = H.createPuzzle(lv.rows, lv.cols, lv.islands);
    selectedId = null;
    activeId = state.islands.length ? state.islands[0].id : null;
    history = [];
    syncUndoButton();
    $('play-title').textContent = `Level ${i + 1}`;
    $('hint-bar').textContent = 'Tap an island, then a neighbor to build bridges.';
    show('play');
    resizeBoard();
    draw();
    try { canvas.focus({ preventScroll: true }); } catch (_) { canvas.focus(); }
    HashiSound.unlock();
  }

  function pushHist() {
    history.push(H.cloneState(state));
    if (history.length > 80) history.shift();
    syncUndoButton();
  }

  function syncUndoButton() {
    $('btn-undo').disabled = history.length === 0;
  }

  function resizeBoard() {
    const wrap = canvas.parentElement.getBoundingClientRect();
    const style = window.getComputedStyle(canvas.parentElement);
    const paddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const paddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const size = Math.max(0, Math.floor(Math.min(wrap.width - paddingX - 8, wrap.height - paddingY - 8, 560)));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  function layout() {
    if (!state) return null;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const pad = Math.max(38, Math.min(54, Math.min(w, h) * 0.12));
    const cellW = (w - pad * 2) / Math.max(1, state.cols - 1 || 1);
    const cellH = (h - pad * 2) / Math.max(1, state.rows - 1 || 1);
    // single-cell grids
    const cw = state.cols <= 1 ? 0 : cellW;
    const ch = state.rows <= 1 ? 0 : cellH;
    const rIsland = Math.max(14, Math.min(26, Math.min(cw || 40, ch || 40) * 0.32));
    return { pad, w, h, cw, ch, rIsland };
  }

  function islandXY(isl, L) {
    const x = L.pad + isl.c * (L.cw || 0);
    const y = L.pad + isl.r * (L.ch || 0);
    // center single dimension
    return {
      x: state.cols <= 1 ? L.w / 2 : x,
      y: state.rows <= 1 ? L.h / 2 : y,
    };
  }

  function draw() {
    if (!state) return;
    const L = layout();
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    // subtle grid dots
    ctx.fillStyle = 'rgba(148,163,184,0.12)';
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const x = state.cols <= 1 ? w / 2 : L.pad + c * L.cw;
        const y = state.rows <= 1 ? h / 2 : L.pad + r * L.ch;
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // bridges
    for (const k of Object.keys(state.bridges)) {
      const n = state.bridges[k];
      if (!n) continue;
      const [a, b] = k.split('-').map(Number);
      const A = H.islandById(state, a);
      const B = H.islandById(state, b);
      const pa = islandXY(A, L);
      const pb = islandXY(B, L);
      ctx.strokeStyle = selectedId === a || selectedId === b ? '#5eead4' : '#94a3b8';
      ctx.lineCap = 'round';
      if (n === 1) {
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      } else {
        const dx = pb.x - pa.x;
        const dy = pb.y - pa.y;
        const len = Math.hypot(dx, dy) || 1;
        const ox = (-dy / len) * 5;
        const oy = (dx / len) * 5;
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(pa.x + ox, pa.y + oy);
        ctx.lineTo(pb.x + ox, pb.y + oy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pa.x - ox, pa.y - oy);
        ctx.lineTo(pb.x - ox, pb.y - oy);
        ctx.stroke();
      }
    }

    // selection rays
    if (selectedId != null) {
      const sel = H.islandById(state, selectedId);
      const ps = islandXY(sel, L);
      for (const nid of H.neighborsVisible(state, selectedId)) {
        const o = H.islandById(state, nid);
        const po = islandXY(o, L);
        ctx.strokeStyle = 'rgba(45,212,191,0.25)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(ps.x, ps.y);
        ctx.lineTo(po.x, po.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    const status = H.statusMap(state);
    for (const isl of state.islands) {
      const p = islandXY(isl, L);
      const st = status[isl.id];
      let ring = '#64748b';
      if (st === 'exact') ring = '#34d399';
      if (st === 'over') ring = '#f87171';
      if (selectedId === isl.id) ring = '#5eead4';

      ctx.beginPath();
      ctx.arc(p.x, p.y, L.rIsland + (selectedId === isl.id ? 2 : 0), 0, Math.PI * 2);
      const grd = ctx.createRadialGradient(p.x - 4, p.y - 4, 2, p.x, p.y, L.rIsland);
      grd.addColorStop(0, '#334155');
      grd.addColorStop(1, '#0f172a');
      ctx.fillStyle = grd;
      ctx.fill();
      if (activeId === isl.id) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, L.rIsland + 6, 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = selectedId === isl.id ? 'rgba(88,224,193,0.78)' : 'rgba(108,203,255,0.72)';
        ctx.stroke();
      }
      ctx.lineWidth = 3;
      ctx.strokeStyle = ring;
      ctx.stroke();

      ctx.fillStyle = '#f8fafc';
      ctx.font = `700 ${Math.floor(L.rIsland * 0.95)}px system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(isl.clue), p.x, p.y + 1);
    }
  }

  function hitTest(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const L = layout();
    let best = null;
    let bestD = 1e9;
    for (const isl of state.islands) {
      const p = islandXY(isl, L);
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < L.rIsland + 14 && d < bestD) {
        bestD = d;
        best = isl.id;
      }
    }
    return best;
  }

  function onTap(id) {
    if (id == null) {
      selectedId = null;
      draw();
      return;
    }
    activeId = id;
    HashiSound.tap();
    if (selectedId == null) {
      selectedId = id;
      $('hint-bar').textContent = 'Island selected. Choose a visible neighbor, or press Escape to cancel.';
      draw();
      return;
    }
    if (selectedId === id) {
      selectedId = null;
      $('hint-bar').textContent = 'Selection cleared. Choose an island to begin.';
      draw();
      return;
    }
    if (!H.canSee(state, selectedId, id)) {
      selectedId = id;
      HashiSound.error();
      $('hint-bar').textContent = 'Pick an island in the same row or column with a clear path.';
      draw();
      return;
    }
    pushHist();
    const res = H.cycleBridge(state, selectedId, id);
    if (!res.ok) {
      history.pop();
      syncUndoButton();
      HashiSound.error();
      $('hint-bar').textContent =
        res.reason === 'cross' ? 'Bridges cannot cross.' :
        res.reason === 'over' ? 'That would exceed an island number.' :
        'Cannot place bridge.';
      selectedId = id;
      draw();
      return;
    }
    state = res.state;
    const k = H.keyBridge(selectedId, id);
    const n = state.bridges[k] || 0;
    if (n === 0) HashiSound.remove();
    else HashiSound.place();
    haptic();
    selectedId = null;
    $('hint-bar').textContent = n ? `${n} bridge${n > 1 ? 's' : ''} placed.` : 'Bridge removed.';
    draw();
    if (H.isComplete(state)) onWin();
  }

  function onWin() {
    HashiSound.win();
    const already = !!save.cleared[levelIndex];
    save.cleared[levelIndex] = true;
    if (!already) {
      save.streak = (save.streak || 0) + 1;
      save.bestStreak = Math.max(save.bestStreak || 0, save.streak);
    }
    save.current = Math.min(levelIndex + 1, LEVELS.length - 1);
    persist();
    updateHome();
    $('win-text').textContent = already
      ? `Level ${levelIndex + 1} solved again.`
      : `Level ${levelIndex + 1} cleared · streak ${save.streak}`;
    $('modal-win').classList.add('open');
    if (typeof Ads !== 'undefined') Ads.maybeInterstitial();
  }

  function moveActive(direction) {
    if (!state || !state.islands.length) return;
    if (activeId == null) activeId = state.islands[0].id;
    const current = H.islandById(state, activeId);
    const vertical = direction === 'ArrowUp' || direction === 'ArrowDown';
    const sign = direction === 'ArrowUp' || direction === 'ArrowLeft' ? -1 : 1;
    const candidates = H.neighborsVisible(state, activeId)
      .map((id) => H.islandById(state, id))
      .filter((island) => vertical
        ? (island.c === current.c && Math.sign(island.r - current.r) === sign)
        : (island.r === current.r && Math.sign(island.c - current.c) === sign));
    if (!candidates.length) {
      $('hint-bar').textContent = `No visible island ${direction === 'ArrowUp' ? 'above' : direction === 'ArrowDown' ? 'below' : direction === 'ArrowLeft' ? 'to the left' : 'to the right'}.`;
      return;
    }
    candidates.sort((a, b) => vertical ? Math.abs(a.r - current.r) - Math.abs(b.r - current.r) : Math.abs(a.c - current.c) - Math.abs(b.c - current.c));
    activeId = candidates[0].id;
    const number = state.islands.findIndex((island) => island.id === activeId) + 1;
    $('hint-bar').textContent = `Island ${number} of ${state.islands.length}. Press Enter to select or connect.`;
    draw();
  }

  canvas.addEventListener('keydown', (e) => {
    if (!state) return;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      moveActive(e.key);
      return;
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      if (activeId == null) activeId = state.islands[0]?.id ?? null;
      onTap(activeId);
      return;
    }
    if (e.key === 'Escape' && selectedId != null) {
      e.preventDefault();
      selectedId = null;
      $('hint-bar').textContent = 'Selection cancelled. Choose an island to begin.';
      draw();
    }
  });

  // Pointer
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    HashiSound.unlock();
    onTap(hitTest(e.clientX, e.clientY));
  });

  // Buttons
  $('btn-continue').onclick = () => startLevel(Math.min(save.current || 0, LEVELS.length - 1));
  $('btn-levels').onclick = () => { renderLevels(); show('levels'); };
  $('btn-levels2').onclick = () => { renderLevels(); show('levels'); };
  $('btn-howto').onclick = () => $('modal-howto').classList.add('open');
  $('btn-settings').onclick = () => show('settings');
  $('levels-back').onclick = () => { updateHome(); show('home'); };
  $('settings-back').onclick = () => { updateHome(); show('home'); };
  $('play-home').onclick = () => { updateHome(); show('home'); };
  $('play-sound').onclick = () => {
    save.sound = !save.sound;
    persist();
    updateHome();
  };
  $('sw-sound').onclick = () => {
    save.sound = !save.sound;
    persist();
    updateHome();
  };
  $('sw-haptic').onclick = () => {
    save.haptic = !save.haptic;
    persist();
    updateHome();
  };
  $('btn-reset-progress').onclick = () => {
    if (!confirm('Reset all level progress?')) return;
    save.cleared = {};
    save.current = 0;
    save.streak = 0;
    persist();
    updateHome();
    alert('Progress reset.');
  };
  $('btn-undo').onclick = () => {
    if (!history.length) return;
    state = history.pop();
    selectedId = null;
    syncUndoButton();
    $('hint-bar').textContent = 'Last move undone.';
    draw();
    HashiSound.remove();
  };
  $('btn-reset').onclick = () => {
    pushHist();
    state.bridges = {};
    selectedId = null;
    $('hint-bar').textContent = 'Board reset.';
    draw();
    HashiSound.remove();
  };
  $('btn-hint').onclick = async () => {
    $('hint-bar').textContent = 'Thinking…';
    await new Promise((r) => setTimeout(r, 20));
    const lv = LEVELS[levelIndex];
    let h = H.hint(state);
    if (!h && lv.solution) {
      // fallback to stored solution diff
      const keys = new Set([...Object.keys(lv.solution), ...Object.keys(state.bridges)]);
      for (const k of keys) {
        const want = lv.solution[k] || 0;
        const have = state.bridges[k] || 0;
        if (want !== have) {
          const [a, b] = k.split('-').map(Number);
          h = { a, b, count: want };
          break;
        }
      }
    }
    if (!h) {
      $('hint-bar').textContent = 'No hint available.';
      HashiSound.error();
      return;
    }
    // If rewarded ads later: Ads.showRewarded(() => apply)
    pushHist();
    const res = H.setBridge(state, h.a, h.b, h.count);
    if (res.ok) {
      state = res.state;
      HashiSound.place();
      $('hint-bar').textContent = 'Hint applied.';
      draw();
      if (H.isComplete(state)) onWin();
    } else {
      history.pop();
      syncUndoButton();
      $('hint-bar').textContent = 'Hint conflict — undo a few moves.';
      HashiSound.error();
    }
  };

  document.querySelectorAll('[data-close]').forEach((el) => {
    el.onclick = () => $(el.getAttribute('data-close')).classList.remove('open');
  });
  $('win-levels').onclick = () => {
    $('modal-win').classList.remove('open');
    renderLevels();
    show('levels');
  };
  $('win-next').onclick = () => {
    $('modal-win').classList.remove('open');
    const next = Math.min(levelIndex + 1, LEVELS.length - 1);
    startLevel(next);
  };

  window.addEventListener('resize', () => {
    if (screens.play.classList.contains('active')) resizeBoard();
  });

  // Boot
  updateHome();
  if (typeof Ads !== 'undefined') Ads.init();
})();
