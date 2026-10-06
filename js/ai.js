'use strict';

// Computer opponent. It plays by the same rules as the player: same fuel
// income, its own deck with a hand of four, one launch per turn. It never sees what the
// player is about to launch this turn, only what is already in the air.
(function () {
  const { W, rand, lerp } = TR;
  const STEP = 0.1, HORIZON = 70;

  // How far a unit has travelled towards the base it is attacking.
  const progress = (u) => (u.team === 1 ? u.x : W - u.x);

  // Where the enemy will be. Units that have stopped to fight are assumed to stay put.
  function forecast(units) {
    return units.map((u) => {
      const b = Object.assign({}, u), pts = [];
      for (let i = 0; i < HORIZON; i++) {
        if (!u.hold) TR.stepBody(b, STEP, null);
        pts.push(progress(b) >= W - TR.GOAL ? null : { x: b.x, y: b.y });
      }
      pts.r = u.def.radius;
      return pts;
    });
  }

  // Fly a candidate launch against the forecast and measure how it meets the enemy.
  function tryAngle(type, team, ang, tracks) {
    const def = TR.UNITS[type], w = def.weapon;
    const b = TR.makeBody(type, team, ang);
    let closest = 1e9, engage = 0, hold = false;
    for (let i = 0; i < HORIZON; i++) {
      // like the real thing, a unit that stops stays put for as long as it has someone to shoot
      if (!hold) TR.stepBody(b, STEP, null);
      hold = false;
      if (b.y > TR.GROUND || b.x < 0 || b.x > W) break;
      for (const pts of tracks) {
        const p = pts[i];
        if (!p) continue;
        const dx = (p.x - b.x) * b.team, dy = b.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < closest) closest = dist;
        if (w && TR.facing(w, TR.heading(b), dx, dy, pts.r * TR.HULL)) { engage++; hold = !!def.stops; }
      }
    }
    return { closest, engage };
  }

  function bestAngle(type, team, tracks, score) {
    const def = TR.UNITS[type];
    let best = null;
    for (let i = 0; i <= 16; i++) {
      const ang = lerp(def.aMin, def.aMax, i / 16);
      const r = tryAngle(type, team, ang, tracks);
      const s = score(r) + rand(0, 0.01);
      if (!best || s > best.s) best = { s, ang, r };
    }
    return best;
  }

  // Skill profile for a perfectly attentive computer. Difficulty levels (TR.LEVELS)
  // override these: `pass` = chance of dithering a turn away, `random` = chance of
  // playing any old card, `aim` = chance of bothering to aim, `noise` = fuzz on
  // how it rates its cards, `save` = willingness to bank fuel for a big unit.
  const SHARP = { pass: 0, random: 0, aim: 1, noise: 2.2, save: 0.25 };

  TR.aiPlan = function (G, team, skill) {
    const s = Object.assign({}, SHARP, skill);
    const me = G.teams[team];
    if (Math.random() < s.pass) return null;
    const foes = G.units.filter((u) => u.team !== team && !u.dead && u.def.kind !== 'missile');
    const tracks = forecast(foes);
    const urgent = foes.filter((u) => progress(u) > W * 0.5).length;
    const spend = (o) => {
      // after each launch, decide whether to hold out for a big card next time
      me.aiHold = Math.random() < s.save;
      return { type: o.type, angle: o.angle, slot: o.slot };
    };
    if (me.aiHold === undefined) me.aiHold = Math.random() < s.save;

    // Rate every card in hand, affordable or not.
    const all = [];
    for (let slot = 0; slot < me.hand.length; slot++) {
      const type = me.hand[slot], def = TR.UNITS[type];
      let value, pick;
      if (type === 'missile') {
        pick = bestAngle(type, team, tracks, (r) => -r.closest);
        value = pick.r.closest < 170 ? 7 : pick.r.closest < 330 ? 4.5 : 0;
      } else if (type === 'mortar') {
        pick = bestAngle(type, team, tracks, (r) => -r.closest);
        value = pick.r.closest < 75 ? 6.5 : pick.r.closest < 120 ? 3.5 : 0;
      } else {
        // Aircraft: mostly pick a lane with a fight in it; now and then, when nothing
        // is bearing down on us, slip down an empty lane to reach the airport instead.
        const lane = !urgent && Math.random() < 0.3 ? -1 : 1;
        pick = bestAngle(type, team, tracks, (r) => lane * Math.min(r.engage, 12) + rand(0, foes.length ? 6 : 50));
        value = { mustang: 6, heli: 5, mheli: 4.5, bomber: 4 }[type];
        value += Math.min(3, pick.r.engage * 0.08);
        if (def.stops) value += urgent * 0.5;   // something to park in the way
      }
      const angle = Math.random() < s.aim ? pick.ang : lerp(def.aMin, def.aMax, Math.random());
      all.push({ slot, type, angle, cost: def.cost, value: value + rand(0, s.noise), air: def.baseDmg > 0 });
    }
    const options = all.filter((o) => o.cost <= me.fuel);
    if (!options.length) return null;
    if (Math.random() < s.random) return spend(TR.pick(options));

    // Cards stay in hand until played, so now and then it saves up for the dearest
    // one it is holding, as long as nothing is bearing down on the airport.
    if (me.aiHold && !urgent) {
      const want = all.reduce((a, b) => (b.cost > a.cost ? b : a));
      if (want.cost > me.fuel) return null;
      if (want.air || want.value > 0) return spend(want);   // but never a missile or mortar at nothing
    }

    options.sort((a, b) => b.value - a.value);
    let choice = options[0];
    if (choice.value < 2.4) {
      // Nothing worth shooting at: only spend if fuel would otherwise overflow,
      // on an aircraft if there is one, else on anything just to turn the deck over.
      if (me.fuel < TR.FUEL.max - 1) return null;
      choice = options.find((o) => o.air) || (me.fuel >= TR.FUEL.max ? options[options.length - 1] : null);
    }
    return choice && spend(choice);
  };
})();
