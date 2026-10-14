(function (root) {
  'use strict';
  let ctx = null;
  let enabled = true;

  function ac() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, gain) {
    if (!enabled) return;
    const c = ac();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type || 'sine';
    o.frequency.value = freq;
    g.gain.value = gain || 0.08;
    o.connect(g);
    g.connect(c.destination);
    const t = c.currentTime;
    g.gain.setValueAtTime(gain || 0.08, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  root.HashiSound = {
    setEnabled(v) { enabled = !!v; },
    isEnabled() { return enabled; },
    tap() { tone(520, 0.05, 'triangle', 0.06); },
    place() { tone(660, 0.07, 'sine', 0.07); tone(880, 0.05, 'sine', 0.04); },
    remove() { tone(320, 0.08, 'triangle', 0.05); },
    error() { tone(180, 0.12, 'sawtooth', 0.04); },
    win() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'sine', 0.07), i * 90));
    },
    unlock() { ac(); },
  };
})(typeof self !== 'undefined' ? self : this);
