'use strict';

// Cosmetic particles only: nothing in here affects the outcome of a battle.
(function () {
  const TAU = Math.PI * 2;
  const { GROUND, rand, clamp } = TR;
  const art = TR.art;
  const INK = art.INK;
  const WORDS = ['POW!', 'BAM!', 'BOOM!', 'KABLAM!', 'WHAM!', 'ZAP!', 'KAPOW!'];

  const fx = TR.fx = { list: [], shake: 0 };

  fx.clear = function () { fx.list.length = 0; fx.shake = 0; };

  function add(p) {
    if (fx.list.length > 520) fx.list.splice(0, 40);
    p.t = 0;
    fx.list.push(p);
    return p;
  }

  fx.puff = function (x, y, o) {
    o = o || {};
    return add({
      k: 'puff', x, y, vx: o.vx || 0, vy: o.vy == null ? -18 : o.vy, r: o.r || 10, life: o.life || 0.7,
      col: o.col || '#f1ece4', ink: o.ink !== false, back: !!o.back, grow: o.grow == null ? 0.9 : o.grow,
    });
  };

  fx.spark = function (x, y, size) {
    add({ k: 'spark', x, y, r: size || 9, life: 0.18, rot: rand(0, TAU) });
  };

  fx.word = function (x, y, str, col, size) {
    add({ k: 'word', x, y, str, col: col || '#ffd83a', size: size || 34, life: 0.85, rot: rand(-0.28, 0.28) });
  };

  fx.float = function (x, y, str, col, size) {
    add({ k: 'float', x, y, str, col: col || '#fff', size: size || 30, life: 1.3 });
  };

  fx.debris = function (x, y, col, n, power) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, TAU), s = rand(60, 220) * (power || 1);
      add({ k: 'debris', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, r: rand(3, 7), rot: rand(0, TAU), vr: rand(-12, 12), col, life: rand(0.7, 1.4) });
    }
  };

  // The full cartoon explosion: star burst, shock ring, smoke and sparks.
  fx.boom = function (x, y, size, word) {
    const spikes = [];
    const n = 11 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n * 2; i++) spikes.push(i % 2 ? rand(0.5, 0.64) : rand(0.86, 1.12));
    add({ k: 'burst', x, y, r: size, spikes, life: 0.42, rot: rand(0, TAU) });
    add({ k: 'ring', x, y, r: size * 1.35, life: 0.35 });
    const puffs = Math.round(clamp(size / 9, 3, 9));
    for (let i = 0; i < puffs; i++) {
      const a = rand(0, TAU), d = rand(0.2, 0.75) * size;
      fx.puff(x + Math.cos(a) * d, y + Math.sin(a) * d, {
        r: rand(0.22, 0.4) * size, life: rand(0.6, 1.1), vx: Math.cos(a) * 30, vy: Math.sin(a) * 30 - 24,
        col: i % 3 ? '#efe9df' : '#8d8580',
      });
    }
    for (let i = 0; i < 4; i++) fx.spark(x + rand(-size, size) * 0.7, y + rand(-size, size) * 0.7, rand(6, 11));
    if (word) fx.word(x + rand(-10, 10), y - size * 0.75, word === true ? TR.pick(WORDS) : word, '#ffd83a', clamp(size * 0.55, 22, 48));
    fx.shake = Math.max(fx.shake, clamp(size / 9, 2, 12));
  };

  fx.dust = function (x, size) {
    for (let i = 0; i < 6; i++) {
      fx.puff(x + rand(-size, size), GROUND - rand(0, 6), { r: rand(0.25, 0.5) * size, vx: rand(-50, 50), vy: rand(-45, -10), col: '#e9dcc0', life: rand(0.5, 0.9) });
    }
  };

  // A shot-down aircraft tumbles to the ground trailing smoke.
  fx.wreck = function (u) {
    add({
      k: 'wreck', x: u.x, y: u.y, vx: (u.vx || 0) * 0.7, vy: (u.vy || 0) * 0.5 - 40, type: u.type, dir: u.team,
      rot: u.def.kind === 'heli' ? 0 : u.a, vr: rand(1.5, 3.2) * (Math.random() < 0.5 ? -1 : 1), life: 6, puffT: 0, size: u.def.radius,
    });
  };

  fx.update = function (dt) {
    fx.shake = Math.max(0, fx.shake - dt * 28);
    const list = fx.list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.t += dt;
      let dead = p.t >= p.life;
      if (p.k === 'puff') {
        p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - 1.8 * dt; p.vy *= 1 - 1.2 * dt;
      } else if (p.k === 'debris') {
        p.vy += 520 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        if (p.y > GROUND + 2) dead = true;
      } else if (p.k === 'float') {
        p.y -= 46 * dt;
      } else if (p.k === 'wreck') {
        p.vy += 330 * dt; p.vx *= 1 - 0.5 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        p.puffT -= dt;
        if (p.puffT <= 0) {
          p.puffT = 0.05;
          fx.puff(p.x + rand(-6, 6), p.y + rand(-6, 6), { r: rand(7, 13), col: Math.random() < 0.3 ? '#ff9a3c' : '#5b534e', life: 0.75, vy: -30, back: true });
        }
        if (p.y > GROUND - 8) {
          dead = true;
          fx.boom(p.x, GROUND - 10, p.size * 1.3, false);
          fx.dust(p.x, p.size * 1.4);
          fx.debris(p.x, GROUND - 12, '#4d433e', 5, 0.8);
          if (TR.audio) TR.audio.play('thud');
        }
      }
      if (dead) list.splice(i, 1);
    }
  };

  function star(c, r, spikes, scaleIn) {
    const n = spikes.length;
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, rr = r * spikes[i] * (i % 2 ? scaleIn : 1);
      if (i) c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); else c.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    c.closePath();
  }

  const SPARK = [1, 0.3, 1, 0.3, 1, 0.3, 1, 0.3];

  fx.draw = function (c, back, t) {
    c.lineJoin = 'round';
    for (const p of fx.list) {
      if ((p.back || false) !== back) continue;
      const k = p.t / p.life;
      if (p.k === 'puff') {
        const r = p.r * (0.55 + p.grow * k);
        c.globalAlpha = clamp(1 - k * k, 0, 1) * (p.back ? 0.85 : 1);
        c.beginPath(); c.arc(p.x, p.y, r, 0, TAU);
        c.fillStyle = p.col; c.fill();
        if (p.ink) { c.lineWidth = 2.4; c.strokeStyle = INK; c.stroke(); }
        c.globalAlpha = 1;
      } else if (p.k === 'burst') {
        const s = art.easeOutBack(clamp(k * 2.4, 0, 1)) * (1 - clamp((k - 0.7) / 0.3, 0, 1) * 0.5);
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.scale(s, s);
        c.globalAlpha = 1 - clamp((k - 0.75) / 0.25, 0, 1);
        star(c, p.r, p.spikes, 1); c.fillStyle = '#ff7a1a'; c.fill(); c.lineWidth = 3.4 / Math.max(s, 0.3); c.strokeStyle = INK; c.stroke();
        star(c, p.r * 0.72, p.spikes, 0.95); c.fillStyle = '#ffd83a'; c.fill();
        star(c, p.r * 0.4, p.spikes, 0.9); c.fillStyle = '#fffbe6'; c.fill();
        c.restore(); c.globalAlpha = 1;
      } else if (p.k === 'ring') {
        c.globalAlpha = (1 - k) * 0.8;
        c.beginPath(); c.arc(p.x, p.y, p.r * (0.3 + 0.7 * k), 0, TAU);
        c.lineWidth = 6 * (1 - k) + 1; c.strokeStyle = '#fff'; c.stroke();
        c.globalAlpha = 1;
      } else if (p.k === 'spark') {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot); const s = 0.5 + k;
        c.scale(s, s); c.globalAlpha = 1 - k * 0.6;
        star(c, p.r, SPARK, 1); c.fillStyle = '#fff6a8'; c.fill(); c.lineWidth = 1.8; c.strokeStyle = INK; c.stroke();
        c.restore(); c.globalAlpha = 1;
      } else if (p.k === 'word') {
        const s = art.easeOutBack(clamp(k * 3.5, 0, 1));
        c.save(); c.translate(p.x, p.y - k * 16); c.rotate(p.rot); c.scale(s, s);
        c.globalAlpha = 1 - clamp((k - 0.7) / 0.3, 0, 1);
        art.text(c, p.str, 0, 0, p.size, p.col, { lw: p.size * 0.26 });
        c.restore(); c.globalAlpha = 1;
      } else if (p.k === 'float') {
        const s = art.easeOutBack(clamp(k * 5, 0, 1));
        c.save(); c.translate(p.x, p.y); c.scale(s, s);
        c.globalAlpha = 1 - clamp((k - 0.7) / 0.3, 0, 1);
        art.text(c, p.str, 0, 0, p.size, p.col, { lw: p.size * 0.26 });
        c.restore(); c.globalAlpha = 1;
      } else if (p.k === 'debris') {
        c.save(); c.translate(p.x, p.y); c.rotate(p.rot);
        c.globalAlpha = 1 - clamp((k - 0.8) / 0.2, 0, 1);
        c.beginPath(); c.moveTo(-p.r, -p.r * 0.6); c.lineTo(p.r, -p.r * 0.3); c.lineTo(p.r * 0.5, p.r * 0.7); c.lineTo(-p.r * 0.8, p.r * 0.5); c.closePath();
        c.fillStyle = p.col; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
        c.restore(); c.globalAlpha = 1;
      } else if (p.k === 'wreck') {
        c.save(); c.translate(p.x, p.y); c.scale(p.dir, 1); c.rotate(-p.rot);
        art.sprite(c, p.type, 0, t, 0, false);
        c.restore();
      }
    }
  };
})();
