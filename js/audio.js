'use strict';

// Tiny synthesised sound kit (Web Audio), so the game ships with no asset files.
(function () {
  let ac = null, master = null, noiseBuf = null, muted = false;
  const last = {};
  try { muted = localStorage.getItem('takeoff-rush-muted') === '1'; } catch (e) { /* storage unavailable */ }

  function ensure() {
    if (ac) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      ac = new AC();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; return false; }
    return true;
  }

  function tone(freq, dur, type, vol, slide, delay) {
    const t0 = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, from, to, delay) {
    const t0 = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; s.loop = true;
    f.type = 'lowpass'; f.frequency.setValueAtTime(from, t0);
    f.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
  }

  const SOUNDS = {
    click: () => tone(660, 0.06, 'square', 0.12, 880),
    pick: () => { tone(520, 0.08, 'triangle', 0.3, 780); },
    deny: () => tone(190, 0.14, 'sawtooth', 0.14, 120),
    go: () => { tone(392, 0.09, 'triangle', 0.3); tone(587, 0.14, 'triangle', 0.3, 0, 0.09); },
    fuel: () => tone(1040, 0.09, 'sine', 0.12, 1560),
    takeoff: () => noise(0.55, 0.22, 300, 1500),
    whoosh: () => noise(0.38, 0.28, 2600, 500),
    thump: () => { tone(150, 0.2, 'sine', 0.5, 50); noise(0.14, 0.3, 900, 200); },
    gun: () => noise(0.05, 0.14, 2400, 900),
    hit: () => tone(880, 0.03, 'square', 0.04, 480),
    drop: () => tone(950, 0.32, 'sine', 0.08, 320),
    pop: () => noise(0.2, 0.34, 1300, 200),
    boom: () => { noise(0.5, 0.6, 1000, 80); tone(110, 0.36, 'sine', 0.5, 36); },
    thud: () => noise(0.28, 0.4, 520, 60),
    crash: () => { noise(0.75, 0.7, 1500, 60); tone(84, 0.5, 'sawtooth', 0.3, 30); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.32, 0, i * 0.13)),
    lose: () => [392, 330, 262, 196].forEach((f, i) => tone(f, 0.28, 'sawtooth', 0.16, 0, i * 0.17)),
  };
  // Minimum gap between repeats, so a big dogfight doesn't turn into static.
  const GAP = { gun: 0.055, hit: 0.05, boom: 0.07, pop: 0.06, whoosh: 0.08 };

  TR.audio = {
    get muted() { return muted; },
    // Browsers only allow audio after a user gesture.
    unlock() { if (ensure() && ac.state === 'suspended') ac.resume(); },
    play(name) {
      if (muted || !ac || ac.state !== 'running') return;
      const now = ac.currentTime;
      if (GAP[name] && now - (last[name] || -1) < GAP[name]) return;
      last[name] = now;
      SOUNDS[name]();
    },
    toggle() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.55;
      try { localStorage.setItem('takeoff-rush-muted', muted ? '1' : '0'); } catch (e) { /* ignore */ }
      return muted;
    },
  };
})();
