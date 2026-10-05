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
    b.hold = false; b.holdK = 0;
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

  // Which way an aircraft's weapon looks: planes along their flight path (so up the
  // climb while they are still pitched), helicopters dead level.
  TR.heading = (b) => (b.def.kind === 'plane' ? b.a : 0);

  // Is something `dx` forward and `dy` up from a weapon `w` looking along `face`?
  // Aircraft only engage what is in front of them: in range and inside a cone
  // around their heading, widened by `pad`.
  TR.facing = function (w, face, dx, dy, pad) {
    const c = Math.cos(face), s = Math.sin(face);
    const ahead = dx * c + dy * s, off = dy * c - dx * s;
    return ahead > 0 && Math.hypot(dx, dy) <= w.range && Math.abs(off) <= ahead * Math.tan(w.cone) + pad;
  };

  // Nearest hostile facing `u`: aircraft, or (with `missiles`) incoming missiles instead.
  function pickTarget(G, u, w, missiles) {
    const face = TR.heading(u);
    let best = null, bd = w.range;
    for (const e of G.units) {
      if (e.team === u.team || e.dead || (e.def.kind === 'missile') !== missiles) continue;
      const dx = (e.x - u.x) * u.team, dy = u.y - e.y;
      const dist = Math.hypot(dx, dy);
      if (dist > bd || !TR.facing(w, face, dx, dy, (u.def.radius + e.def.radius) * TR.HULL)) continue;
      bd = dist; best = e;
    }
    return best;
  }

  // A friendly aircraft holding position right ahead: wait behind it rather than fly through it.
  function queued(G, u) {
    for (const f of G.units) {
      if (f === u || f.team !== u.team || f.dead || !f.hold) continue;
      const dx = (f.x - u.x) * u.team, pad = f.def.radius + u.def.radius;
      if (dx > 0 && dx < pad * 1.9 && Math.abs(f.y - u.y) < pad * 0.8) return true;
    }
    return false;
  }

  // Stopped in mid-air: it stays exactly where it is on its path, pitch included.
  function hover(u, dt) {
    u.age += dt;
    u.vx = u.vy = 0;
  }

  function fire(G, u, e) {
    const d = u.def, w = d.weapon;
    if (w.type === 'gun') {
      let mx, my;
      if (d.kind === 'heli') { mx = u.x + u.team * 38; my = u.y + 13; }
      else { mx = u.x + u.team * Math.cos(u.a) * d.nose; my = u.y - Math.sin(u.a) * d.nose; }
      const tt = Math.hypot(e.x - mx, e.y - my) / w.speed;
      const ang = Math.atan2(e.y + e.vy * tt - my, e.x + e.vx * tt - mx) + rand(-w.spread, w.spread);
      G.shots.push({ k: 'bullet', team: u.team, x: mx, y: my, vx: Math.cos(ang) * w.speed, vy: Math.sin(ang) * w.speed, life: w.range / w.speed * 1.25, dmg: w.dmg });
      fx.spark(mx, my, 8);
      sfx('gun');
    } else if (w.type === 'bomb') {
      // Lobbed: the flat speed sets the flight time and the arc is solved to come down on the target.
      const x = u.x + u.team * 12, y = u.y + 18;
      const tt = Math.max(0.3, Math.hypot(e.x - x, e.y - y) / w.speed);
      const tx = e.x + e.vx * tt, ty = e.y + e.vy * tt;
      G.shots.push({ k: 'bomb', team: u.team, x, y, vx: (tx - x) / tt, vy: (ty - y) / tt - 0.5 * w.g * tt, w });
      fx.puff(x, y, { r: 9, life: 0.4, col: '#f1ece4' });
      sfx('drop');
    }
    u.cool = w.reload;
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
    return true;
  }

  TR.simStep = function (G, dt) {
    const units = G.units, shots = G.shots;
    for (const u of units) {
      if (u.dead) continue;
      const d = u.def;
      if (u.flash > 0) u.flash -= dt;

      if (d.kind === 'missile') {
        TR.stepBody(u, dt, units);
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

      // Aircraft fly on until a hostile aircraft is ahead in range, then stop and fight it.
      const armed = u.age > 0.7;
      const foe = armed ? pickTarget(G, u, d.weapon, false) : null;
      u.hold = !!foe || queued(G, u);
      u.holdK = clamp(u.holdK + (u.hold ? dt : -dt) * 4, 0, 1);
      if (u.hold) hover(u, dt); else TR.stepBody(u, dt, units);

      if (u.hp < u.maxHp * 0.5) {
        u.smokeT -= dt;
        if (u.smokeT <= 0) {
          u.smokeT = u.hp < u.maxHp * 0.25 ? 0.07 : 0.14;
          fx.puff(u.x - u.team * d.radius * 0.6, u.y - 4, { r: rand(6, 10), life: 0.7, vx: -u.vx * 0.3, vy: -22, col: u.hp < u.maxHp * 0.25 ? '#4d4541' : '#9a918b', back: true });
        }
      }

      if (u.team === 1 ? u.x >= W - TR.GOAL : u.x <= TR.GOAL) { arrive(G, u); continue; }

      u.cool -= dt;
      if (u.cool <= 0 && armed) {
        // Guns also swat at passing missiles, without stopping for them.
        const e = foe || (d.weapon.type === 'gun' ? pickTarget(G, u, d.weapon, true) : null);
        if (e) fire(G, u, e);
      }
    }

    for (let i = shots.length - 1; i >= 0; i--) {
      if (stepShot(G, shots[i], dt)) shots.splice(i, 1);
    }
    for (let i = units.length - 1; i >= 0; i--) {
      if (units[i].dead) units.splice(i, 1);
    }
  };
})();
