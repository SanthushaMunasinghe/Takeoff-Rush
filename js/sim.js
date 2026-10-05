'use strict';

// Battle simulation: flight, weapons, projectiles, damage and arrivals.
(function () {
  const { W, GROUND, clamp, lerp, rand } = TR;
  const fx = TR.fx;
  const sfx = (name) => { if (TR.audio) TR.audio.play(name); };

  TR.altFor = function (def, angle) {
    return lerp(def.altLow, def.altHigh, (angle - def.aMin) / (def.aMax - def.aMin));
  };

  // The moving body for a launch. Real units and path previews share this, so
  // the dotted preview is exactly the path the unit will fly.
  TR.makeBody = function (type, team, angle) {
    const def = TR.UNITS[type];
    const b = { type, def, team, age: 0, launchA: angle, x: TR.spawnX(team), y: GROUND - def.sit, a: 0, vx: 0, vy: 0 };
    if (def.kind === 'shell') {
      b.x += team * Math.cos(angle) * def.muzzle;
      b.y -= Math.sin(angle) * def.muzzle;
      b.vx = team * Math.cos(angle) * def.speed;
      b.vy = -Math.sin(angle) * def.speed;
    } else {
      b.targetY = TR.altFor(def, angle);
      // Planes roll out level and pull up; helicopters and missiles leave at the launch angle.
      b.a = def.kind === 'plane' ? 0 : angle;
    }
    return b;
  };

  function seek(b, units) {
    const d = b.def;
    let best = null, bd = d.seekRange;
    for (const e of units) {
      if (e.team === b.team || e.dead || e.def.kind === 'missile') continue;
      const lead = Math.hypot(e.x - b.x, e.y - b.y) / d.speed * 0.9;
      const dx = (e.x + e.vx * lead - b.x) * b.team, dy = b.y - (e.y + e.vy * lead);
      if (dx < 0) continue;
      const dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
      if (dist < bd && Math.abs(ang - b.a) < d.seekCone) { bd = dist; best = ang; }
    }
    return best === null ? null : clamp(best, -1.2, 1.2);
  }

  TR.stepBody = function (b, dt, units) {
    const d = b.def;
    b.age += dt;
    if (d.kind === 'shell') {
      b.vy += d.g * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      return;
    }
    // Climb at up to the launch angle, easing level as the cruise altitude nears.
    let want = clamp((b.y - b.targetY) * d.gain, -d.dive, b.launchA);
    if (d.roll && b.age < d.roll) want = 0;   // planes roll down the runway before pulling up
    if (d.kind === 'missile' && units && b.age > 0.3) {
      const aim = seek(b, units);
      if (aim !== null) want = aim;
    }
    const turn = d.turn * dt;
    b.a += clamp(want - b.a, -turn, turn);
    const sp = d.speed * (b.age < d.accel ? 0.4 + 0.6 * b.age / d.accel : 1);
    b.vx = b.team * Math.cos(b.a) * sp;
    b.vy = -Math.sin(b.a) * sp;
    b.x += b.vx * dt; b.y += b.vy * dt;
  };

  // Sample a body's future path, either for a path length or a duration.
  TR.tracePath = function (src, o) {
    const b = Object.assign({}, src);
    const pts = [{ x: b.x, y: b.y }];
    const dt = 1 / 30;
    let len = 0, t = 0;
    while ((o.len ? len < o.len : t < o.time) && t < 14) {
      const px = b.x, py = b.y;
      TR.stepBody(b, dt, null);
      len += Math.hypot(b.x - px, b.y - py); t += dt;
      pts.push({ x: b.x, y: b.y });
      if (b.y > GROUND - 2 && b.def.kind === 'shell') break;
    }
    return pts;
  };

  TR.launch = function (G, team, type, angle) {
    const def = TR.UNITS[type];
    const b = TR.makeBody(type, team, angle);
    if (def.kind === 'shell') {
      b.k = 'shell';
      G.shots.push(b);
      for (let i = 0; i < 4; i++) fx.puff(b.x, b.y, { r: rand(8, 14), vx: b.vx * rand(0.1, 0.3), vy: b.vy * rand(0.1, 0.3), life: 0.5 });
      sfx('thump');
      return b;
    }
    b.id = G.nextId++;
    b.hp = b.maxHp = def.hp;
    b.cool = rand(0.1, 0.4);
    b.flash = 0; b.dead = false; b.smokeT = 0;
    G.units.push(b);
    if (def.kind === 'missile') { fx.dust(b.x - team * 20, 26); sfx('whoosh'); } else sfx('takeoff');
    return b;
  };

  // ---------------------------------------------------------------- damage

  function hurt(G, e, dmg) {
    if (e.dead) return;
    e.hp -= dmg;
    e.flash = 0.14;
    if (e.hp <= 0) kill(G, e);
  }

  function kill(G, e) {
    e.dead = true;
    G.teams[-e.team].kills++;
    fx.boom(e.x, e.y, e.def.radius * 1.7, true);
    fx.debris(e.x, e.y, TR.art.PAL[e.team].body, 6, 1);
    if (e.def.kind !== 'missile') fx.wreck(e);
    sfx('boom');
  }

  function blast(G, team, x, y, wh) {
    for (const e of G.units) {
      if (e.team === team || e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y) - e.def.radius * 0.5;
      if (d >= wh.aoe) continue;
      // Full damage in the core of the blast, fading to 40% at its edge.
      const fade = clamp((d - wh.aoe * 0.4) / (wh.aoe * 0.6), 0, 1);
      hurt(G, e, wh.dmg * (1 - 0.6 * fade));
    }
    fx.boom(x, y, wh.aoe * 0.72, true);
    if (y > GROUND - 30) fx.dust(x, wh.aoe * 0.5);
    sfx('boom');
  }

  function arrive(G, u) {
    u.dead = true;
    const foe = G.teams[-u.team];
    const dmg = u.def.baseDmg;
    foe.hp = Math.max(0, foe.hp - dmg);
    foe.hurtT = 0.5;
    G.teams[u.team].landed++;
    const ex = u.team === 1 ? W - 96 : 96;
    fx.boom(ex + rand(-30, 30), GROUND - 60 + rand(-20, 20), 46 + dmg * 1.6, 'CRASH!');
    fx.debris(ex, GROUND - 50, TR.art.PAL[-u.team].body, 7, 1.1);
    fx.float(ex, GROUND - 190, '-' + dmg, u.team === 1 ? '#ffe55c' : '#ff8a7a', 44);
    fx.shake = Math.max(fx.shake, 10 + dmg * 0.25);
    sfx('crash');
  }

  // --------------------------------------------------------------- weapons

  function pickTarget(G, u, w) {
    const face = u.def.kind === 'heli' ? 0 : u.a;
    let best = null, bd = w.range;
    for (const e of G.units) {
      if (e.team === u.team || e.dead) continue;
      const dx = (e.x - u.x) * u.team, dy = u.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist > bd) continue;
      if (Math.abs(Math.atan2(dy, dx) - face) > w.cone) continue;
      bd = dist; best = e;
    }
    return best;
  }

  function fire(G, u) {
    const d = u.def, w = d.weapon;
    if (w.type === 'gun') {
      const e = pickTarget(G, u, w);
      if (!e) return;
      let mx, my;
      if (d.kind === 'heli') { mx = u.x + u.team * 38; my = u.y + 13; }
      else { mx = u.x + u.team * Math.cos(u.a) * d.nose; my = u.y - Math.sin(u.a) * d.nose; }
      const tt = Math.hypot(e.x - mx, e.y - my) / w.speed;
      const ang = Math.atan2(e.y + e.vy * tt - my, e.x + e.vx * tt - mx) + rand(-w.spread, w.spread);
      G.shots.push({ k: 'bullet', team: u.team, x: mx, y: my, vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed, life: w.range / w.speed * 1.25, dmg: w.dmg });
      fx.spark(mx, my, 8);
      sfx('gun');
      u.cool = w.reload;
    } else if (w.type === 'bomb') {
      for (const e of G.units) {
        if (e.team === u.team || e.dead) continue;
        const fall = e.y - u.y;
        if (fall < 50) continue;
        const tt = Math.sqrt(2 * fall / w.g);
        if (Math.abs((u.x + u.vx * tt) - (e.x + e.vx * tt)) < w.window) {
          G.shots.push({ k: 'bomb', team: u.team, x: u.x, y: u.y + 18, vx: u.vx, vy: 20, w });
          sfx('drop');
          u.cool = w.reload;
          break;
        }
      }
    } else if (w.type === 'rocket') {
      const e = pickTarget(G, u, w);
      if (!e) return;
      G.shots.push({
        k: 'rocket', team: u.team, x: u.x + u.team * 8, y: u.y + 18, ang: (u.team === 1 ? 0 : Math.PI) + u.team * 0.35,
        sp: 130, target: e, life: w.life, w, puffT: 0,
      });
      sfx('whoosh');
      u.cool = w.reload;
    }
  }

  // ------------------------------------------------------------------ step

  function nearFoe(G, team, x, y, pad) {
    for (const e of G.units) {
      if (e.team === team || e.dead) continue;
      if (Math.hypot(e.x - x, e.y - y) < pad + e.def.radius * 0.6) return e;
    }
    return null;
  }

  function stepShot(G, s, dt) {
    if (s.k === 'bullet') {
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0 || s.y > GROUND) return true;
      for (const e of G.units) {
        if (e.team === s.team || e.dead) continue;
        if (Math.hypot(e.x - s.x, e.y - s.y) < e.def.radius * 0.85) {
          hurt(G, e, s.dmg);
          fx.spark(s.x, s.y, 10);
          if (Math.random() < 0.3) fx.puff(s.x, s.y, { r: 6, life: 0.35, col: '#f1ece4' });
          sfx('hit');
          return true;
        }
      }
      return false;
    }
    if (s.k === 'bomb') {
      s.vy += s.w.g * dt; s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.y >= GROUND - 6 || nearFoe(G, s.team, s.x, s.y, 20)) { blast(G, s.team, s.x, Math.min(s.y, GROUND - 8), s.w); return true; }
      return false;
    }
    if (s.k === 'shell') {
      TR.stepBody(s, dt, null);
      s.puffT = (s.puffT || 0) - dt;
      if (s.puffT <= 0) { s.puffT = 0.07; fx.puff(s.x, s.y, { r: 5, life: 0.4, vy: 0, col: '#f1ece4', ink: false, back: true, grow: 0.4 }); }
      if (s.y >= GROUND - 6 || nearFoe(G, s.team, s.x, s.y, s.def.fuse)) { blast(G, s.team, s.x, Math.min(s.y, GROUND - 8), s.def.warhead); return true; }
      return s.x < -200 || s.x > W + 200;
    }
    if (s.k === 'rocket') {
      const w = s.w;
      s.life -= dt;
      s.sp = Math.min(w.speed, s.sp + 520 * dt);
      const e = s.target;
      if (e && !e.dead) {
        const tt = Math.hypot(e.x - s.x, e.y - s.y) / w.speed * 0.6;
        let diff = Math.atan2(e.y + e.vy * tt - s.y, e.x + e.vx * tt - s.x) - s.ang;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        s.ang += clamp(diff, -w.turn * dt, w.turn * dt);
      }
      s.x += Math.cos(s.ang) * s.sp * dt; s.y += Math.sin(s.ang) * s.sp * dt;
      s.puffT -= dt;
      if (s.puffT <= 0) { s.puffT = 0.035; fx.puff(s.x, s.y, { r: 5.5, life: 0.45, vy: -6, col: '#f7f3ea', ink: false, back: true, grow: 0.7 }); }
      const hit = nearFoe(G, s.team, s.x, s.y, 6);
      if (hit) { hurt(G, hit, w.dmg); fx.boom(s.x, s.y, 30, Math.random() < 0.5); sfx('pop'); return true; }
      if (s.y >= GROUND - 4) { fx.boom(s.x, GROUND - 8, 24, false); fx.dust(s.x, 16); sfx('pop'); return true; }
      if (s.life <= 0) { fx.puff(s.x, s.y, { r: 12, life: 0.5 }); return true; }
      return false;
    }
    return true;
  }

  TR.simStep = function (G, dt) {
    const units = G.units, shots = G.shots;
    for (const u of units) {
      if (u.dead) continue;
      const d = u.def;
      TR.stepBody(u, dt, units);
      if (u.flash > 0) u.flash -= dt;

      if (d.kind === 'missile') {
        u.smokeT -= dt;
        if (u.smokeT <= 0) { u.smokeT = 0.03; fx.puff(u.x - u.vx * 0.08, u.y - u.vy * 0.08, { r: 8, life: 0.6, vy: -8, col: '#f7f3ea', ink: false, back: true, grow: 0.8 }); }
        if (u.y > GROUND - 8 || nearFoe(G, u.team, u.x, u.y, d.fuse)) {
          u.dead = true;
          blast(G, u.team, u.x, Math.min(u.y, GROUND - 10), d.warhead);
        } else if (u.x < -80 || u.x > W + 80) {
          u.dead = true;
        }
        continue;
      }

      if (u.hp < u.maxHp * 0.5) {
        u.smokeT -= dt;
        if (u.smokeT <= 0) {
          u.smokeT = u.hp < u.maxHp * 0.25 ? 0.07 : 0.14;
          fx.puff(u.x - u.team * d.radius * 0.6, u.y - 4, { r: rand(6, 10), life: 0.7, vx: -u.vx * 0.3, vy: -22, col: u.hp < u.maxHp * 0.25 ? '#4d4541' : '#9a918b', back: true });
        }
      }

      if (u.team === 1 ? u.x >= W - TR.GOAL : u.x <= TR.GOAL) { arrive(G, u); continue; }

      u.cool -= dt;
      if (u.cool <= 0 && u.age > 0.7) fire(G, u);
    }

    for (let i = shots.length - 1; i >= 0; i--) {
      if (stepShot(G, shots[i], dt)) shots.splice(i, 1);
    }
    for (let i = units.length - 1; i >= 0; i--) {
      if (units[i].dead) units.splice(i, 1);
    }
  };
})();
