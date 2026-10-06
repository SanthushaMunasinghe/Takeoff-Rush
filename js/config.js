'use strict';

// Shared namespace. Scripts are plain (non-module) so the game runs from file://.
const TR = window.TR = {};

(function () {
  const D = Math.PI / 180;

  TR.W = 1600;        // world width
  TR.H = 720;         // world height that is always on screen (extra sky shows above on taller screens)
  TR.GROUND = 600;    // y of the runway surface
  TR.TURN_TIME = 2;   // seconds simulated per Continue
  TR.BASE_HP = 100;
  TR.FUEL = { start: 5, max: 10, perTurn: 2 };
  TR.SPAWN = 132;     // launch spot, measured from a team's own edge
  TR.GOAL = 112;      // a unit has "arrived" when it is this close to the opposing edge

  // Angles are elevation above the horizon in the unit's own forward direction.
  // Every aircraft shares one band of sky, from skimming the runway (LOW) up to
  // the top of the control towers (HIGH). The launch angle sets how steeply a
  // unit climbs and where in that band it levels off: aim low to stay low.
  //
  // Aircraft only see straight ahead: a detection cone 30 degrees wide (CONE is
  // its half-angle; the Mustang's is narrower, 16 degrees) reaching out to weapon.range along the way they are heading
  // (see TR.facing). They engage hostile aircraft inside it and ignore anything
  // flying above or below it. Planes shoot as they fly past; units marked `stops`
  // halt in mid-air and fight until it is gone.
  //
  // Health is sized in hits: the lightest hit in the game (a 20-damage bullet)
  // downs any aircraft in 5 to 7. Rockets, bombs and shells need fewer.
  const LOW = 556, HIGH = 395;
  const CONE = 15 * D;
  TR.HULL = 0.5;      // share of a target's radius that has to poke into the cone to be seen
  TR.UNITS = {
    mustang: {
      name: 'P-51 Mustang', label: 'MUSTANG', tag: 'Long-range guns, never stops', kind: 'plane',
      cost: 3, hp: 120, speed: 130, radius: 24, baseDmg: 30,
      aMin: 3 * D, aMax: 46 * D, altLow: LOW, altHigh: HIGH,
      gain: 0.012, turn: 1.0, dive: 0.5, accel: 0.7, roll: 0.5, sit: 24, previewLen: 300, nose: 44,
      weapon: { type: 'gun', range: 380, cone: 8 * D, reload: 0.8, dmg: 20, speed: 820, spread: 0.035 },
    },
    heli: {
      name: 'Helicopter', label: 'HELI', tag: 'Short range, stops to fight', kind: 'heli', stops: true,
      cost: 3, hp: 100, speed: 90, radius: 26, baseDmg: 25,
      aMin: 8 * D, aMax: 66 * D, altLow: LOW, altHigh: HIGH,
      gain: 0.018, turn: 2.2, dive: 0.5, accel: 0.6, sit: 25, previewLen: 230, nose: 34,
      weapon: { type: 'gun', range: 190, cone: CONE, reload: 0.45, dmg: 20, speed: 760, spread: 0.05 },
    },
    mheli: {
      name: 'Missile Heli', label: 'MISSILE HELI', tag: 'Tough, slow long-range rockets, stops to fight', kind: 'heli', stops: true,
      cost: 5, hp: 140, speed: 70, radius: 30, baseDmg: 35,
      aMin: 8 * D, aMax: 66 * D, altLow: LOW, altHigh: HIGH,
      gain: 0.016, turn: 2.2, dive: 0.5, accel: 0.6, sit: 27, previewLen: 230, nose: 40,
      weapon: { type: 'rocket', range: 460, cone: CONE, reload: 2.2, dmg: 40, speed: 400, turn: 3.4, life: 2.3 },
    },
    bomber: {
      name: 'Bomber', label: 'BOMBER', tag: 'Short range, slow heavy bombs', kind: 'plane',
      cost: 7, hp: 120, speed: 105, radius: 38, baseDmg: 60,
      aMin: 3 * D, aMax: 46 * D, altLow: LOW, altHigh: HIGH,
      gain: 0.014, turn: 0.9, dive: 0.4, accel: 0.9, roll: 0.7, sit: 34, previewLen: 290, nose: 64,
      weapon: { type: 'bomb', range: 220, cone: CONE, reload: 1.9, dmg: 60, aoe: 80, speed: 300, g: 320 },
    },
    missile: {
      name: 'Missile', label: 'MISSILE', tag: 'Hunts the nearest enemy, one-hit kill', kind: 'missile',
      cost: 7, hp: 20, speed: 330, radius: 16, baseDmg: 0,
      aMin: 2 * D, aMax: 40 * D, altLow: LOW + 6, altHigh: HIGH,
      gain: 0.012, turn: 2.0, dive: 1.1, accel: 0.5, sit: 30, previewLen: 320, nose: 26,
      seekRange: 430, seekCone: 60 * D, fuse: 30,
      warhead: { dmg: 150, aoe: 90 },
    },
    mortar: {
      name: 'Mortar', label: 'MORTAR', tag: 'Lobbed shell, big splash', kind: 'shell',
      cost: 4, speed: 335, g: 120, radius: 10, baseDmg: 0,
      aMin: 30 * D, aMax: 68 * D, sit: 14, previewLen: 340, muzzle: 34, fuse: 42,
      warhead: { dmg: 70, aoe: 105 },
    },
  };

  // Opponent difficulty ladder, easiest first. The computer always obeys the
  // card rules; a level sets how well it plays (the skill fields are explained
  // next to SHARP in ai.js) plus its fuel income per turn (fractions pay out as
  // whole units when they add up), opening fuel and airport health.
  TR.LEVELS = [
    { name: 'Noob', blurb: 'Very easy. Refuels half as fast and never aims.', color: '#63cf5c',
      income: 1, start: 3, hp: 100, pass: 0.2, random: 1, aim: 0, noise: 4, save: 0 },
    { name: 'Rookie', blurb: 'Winnable. Plays whatever is in hand.', color: '#f2b61d',
      income: 2, start: 4, hp: 80, pass: 0.25, random: 0.8, aim: 0.25, noise: 4, save: 0 },
    { name: 'Veteran', blurb: 'A fair fight. Starts to counter you.', color: '#ff8a1e',
      income: 2, start: 5, hp: 100, pass: 0.05, random: 0.45, aim: 0.6, noise: 3, save: 0.3 },
    { name: 'Ace', blurb: 'Hard. Aims everything, wastes nothing.', color: '#f2493a',
      income: 2, start: 7, hp: 130, pass: 0, random: 0, aim: 1, noise: 1, save: 0.2 },
    { name: 'Legend', blurb: 'Brutal. Sharper still, with a fortress of an airport.', color: '#9b5cf0',
      income: 2, start: 8, hp: 180, pass: 0, random: 0, aim: 1, noise: 0.6, save: 0.2 },
  ];

  // Draw weights: each turn's hand is three different cards picked with these odds.
  TR.DECK = { mustang: 4, heli: 4, mheli: 2, bomber: 3, missile: 2, mortar: 2 };

  TR.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  TR.lerp = (a, b, t) => a + (b - a) * t;
  TR.rand = (a, b) => a + Math.random() * (b - a);
  TR.pick = (arr) => arr[(Math.random() * arr.length) | 0];
  TR.spawnX = (team) => (team === 1 ? TR.SPAWN : TR.W - TR.SPAWN);

  // `opening` deals aircraft only, so turn one always has something to send up.
  TR.drawHand = function (opening) {
    const pool = Object.assign({}, TR.DECK);
    if (opening) for (const k in pool) if (!TR.UNITS[k].baseDmg) delete pool[k];
    const hand = [];
    while (hand.length < 3) {
      let total = 0;
      for (const k in pool) total += pool[k];
      let r = Math.random() * total;
      for (const k in pool) {
        r -= pool[k];
        if (r <= 0) { hand.push(k); delete pool[k]; break; }
      }
    }
    return hand;
  };
})();
