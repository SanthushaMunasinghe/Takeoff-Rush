'use strict';

// Computer opponent. It plays by the same rules as the player: same fuel
// income, a random hand of three, one launch per turn. It never sees what the
// player is about to launch this turn, only what is already in the air.
(function () {
  const { W, rand, lerp } = TR;
  const STEP = 0.1, HORIZON = 70;

  // How far a unit has travelled towards the base it is attacking.
  const progress = (u) => (u.team === 1 ? u.x : W - u.x);

  function forecast(units) {
    return units.map((u) => {
      const b = Object.assign({}, u), pts = [];
      for (let i = 0; i < HORIZON; i++) {
        TR.stepBody(b, STEP, null);
        pts.push(progress(b) >= W - TR.GOAL ? null : { x: b.x, y: b.y });
      }
      return pts;
    });
  }

  // Fly a candidate launch against the forecast and measure how it meets the enemy.
  function tryAngle(type, team, ang, tracks) {
    const def = TR.UNITS[type], w = def.weapon;
    const b = TR.makeBody(type, team, ang);
    let closest = 1e9, engage = 0;
    for (let i = 0; i < HORIZON; i++) {
      TR.stepBody(b, STEP, null);
      if (b.y > TR.GROUND || b.x < 0 || b.x > W) break;
      for (const pts of tracks) {
        const p = pts[i];
        if (!p) continue;
        const dx = (p.x - b.x) * b.team, dy = b.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < closest) closest = dist;
        if (w && w.range && dist < w.range) {
          const face = def.kind === 'heli' ? 0 : b.a;
          if (Math.abs(Math.atan2(dy, dx) - face) < w.cone) engage++;
        }
        if (w && w.type === 'bomb' && dy < -50 && Math.abs(dx) < 70) engage++;
      }
    }
    return { closest, engage };
  }

  function bestAngle(type, team, tracks, score) {
    const def = TR.UNITS[type];
    let best = null;
    for (let i = 0; i <= 10; i++) {
      const ang = lerp(def.aMin, def.aMax, i / 10);
      const r = tryAngle(type, team, ang, tracks);
      const s = score(r) + rand(0, 0.01);
      if (!best || s > best.s) best = { s, ang, r };
    }
    return best;
  }

  TR.aiPlan = function (G, team) {
    const me = G.teams[team];
    const foes = G.units.filter((u) => u.team !== team && !u.dead && u.def.kind !== 'missile');
    const tracks = forecast(foes);
    const urgent = foes.filter((u) => progress(u) > W * 0.5).length;
    const options = [];

    for (const type of me.hand) {
      const def = TR.UNITS[type];
      if (def.cost > me.fuel) continue;
      let value, pick;
      if (type === 'missile') {
        pick = bestAngle(type, team, tracks, (r) => -r.closest);
        value = pick.r.closest < 170 ? 7 : pick.r.closest < 330 ? 4.5 : 0;
      } else if (type === 'mortar') {
        pick = bestAngle(type, team, tracks, (r) => -r.closest);
        value = pick.r.closest < 75 ? 6.5 : pick.r.closest < 120 ? 3.5 : 0;
      } else {
        // Aircraft: mostly pick the lane with the most shooting, sometimes just vary it.
        pick = bestAngle(type, team, tracks, (r) => r.engage + rand(0, foes.length ? 6 : 50));
        value = { mustang: 4.6, heli: 3.8, mheli: 5.4, bomber: 6.6 }[type];
        value += Math.min(3, pick.r.engage * 0.08);
        if (type === 'heli') value += urgent * 0.5;
        if (type === 'mheli') value += Math.min(2, foes.length * 0.5);
      }
      options.push({ type, angle: pick.ang, value: value + rand(0, 2.2), air: def.baseDmg > 0 });
    }
    if (!options.length) return null;

    // Bank fuel for a heavy hitter in hand when nothing is bearing down on us.
    const dream = me.hand.find((t) => TR.UNITS[t].cost > me.fuel && TR.UNITS[t].cost <= me.fuel + TR.FUEL.perTurn && TR.UNITS[t].cost >= 6);
    if (dream && urgent === 0 && Math.random() < 0.45) return null;

    options.sort((a, b) => b.value - a.value);
    let choice = options[0];
    if (choice.value < 2.4) {
      // Nothing worth shooting at: only spend if fuel would otherwise overflow.
      if (me.fuel < TR.FUEL.max - 1) return null;
      choice = options.find((o) => o.air) || null;
    }
    return choice && { type: choice.type, angle: choice.angle };
  };
})();
