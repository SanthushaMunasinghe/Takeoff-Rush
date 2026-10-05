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
  TR.FUEL = { start: 5, max: 10, perTurn: 3 };
  TR.SPAWN = 132;     // launch spot, measured from a team's own edge
  TR.GOAL = 112;      // a unit has "arrived" when it is this close to the opposing edge

  // Angles are elevation above the horizon in the unit's own forward direction.
  // The launch angle picks both how steeply a unit climbs and where in its
  // altitude band (altLow..altHigh, screen y) it levels off.
  TR.UNITS = {
    mustang: {
      name: 'P-51 Mustang', tag: 'Fast, fires forward', kind: 'plane',
      cost: 4, hp: 100, speed: 120, radius: 24, baseDmg: 14,
      aMin: 16 * D, aMax: 42 * D, altLow: 430, altHigh: 190,
      gain: 0.007, turn: 1.0, dive: 0.5, accel: 0.7, roll: 0.5, sit: 24, previewLen: 300, nose: 44,
      weapon: { type: 'gun', range: 330, cone: 28 * D, reload: 0.18, dmg: 4, speed: 820, spread: 0.07 },
    },
    heli: {
      name: 'Helicopter', tag: 'Flies low, swivel gun', kind: 'heli',
      cost: 3, hp: 150, speed: 90, radius: 26, baseDmg: 12,
      aMin: 50 * D, aMax: 82 * D, altLow: 528, altHigh: 425,
      gain: 0.018, turn: 2.2, dive: 0.5, accel: 0.6, sit: 25, previewLen: 210, nose: 34,
      weapon: { type: 'gun', range: 270, cone: 50 * D, reload: 0.26, dmg: 3, speed: 760, spread: 0.08 },
    },
    bomber: {
      name: 'Bomber', tag: 'Flies high, bombs below', kind: 'plane',
      cost: 7, hp: 210, speed: 70, radius: 38, baseDmg: 34,
      aMin: 28 * D, aMax: 44 * D, altLow: 240, altHigh: 115,
      gain: 0.009, turn: 0.9, dive: 0.4, accel: 0.9, roll: 0.7, sit: 34, previewLen: 290, nose: 64,
      weapon: { type: 'bomb', reload: 0.6, dmg: 36, aoe: 85, g: 320, window: 55 },
    },
    mheli: {
      name: 'Missile Heli', tag: 'Fires homing rockets', kind: 'heli',
      cost: 6, hp: 180, speed: 72, radius: 30, baseDmg: 18,
      aMin: 50 * D, aMax: 82 * D, altLow: 480, altHigh: 330,
      gain: 0.016, turn: 2.2, dive: 0.5, accel: 0.6, sit: 27, previewLen: 210, nose: 40,
      weapon: { type: 'rocket', range: 470, cone: 75 * D, reload: 2.1, dmg: 22, speed: 400, turn: 3.4, life: 2.3 },
    },
    missile: {
      name: 'Missile', tag: 'Hunts the nearest enemy', kind: 'missile',
      cost: 3, hp: 20, speed: 330, radius: 16, baseDmg: 0,
      aMin: 6 * D, aMax: 46 * D, altLow: 525, altHigh: 120,
      gain: 0.012, turn: 2.0, dive: 1.1, accel: 0.5, sit: 30, previewLen: 320, nose: 26,
      seekRange: 430, seekCone: 60 * D, fuse: 30,
      warhead: { dmg: 60, aoe: 85 },
    },
    mortar: {
      name: 'Mortar', tag: 'Lobbed shell, big splash', kind: 'shell',
      cost: 2, speed: 335, g: 120, radius: 10, baseDmg: 0,
      aMin: 30 * D, aMax: 68 * D, sit: 14, previewLen: 340, muzzle: 34, fuse: 42,
      warhead: { dmg: 42, aoe: 100 },
    },
  };

  // Draw weights: each turn's hand is three different cards picked with these odds.
  TR.DECK = { mustang: 5, heli: 4, bomber: 2, mheli: 2, missile: 2, mortar: 2 };

  TR.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  TR.lerp = (a, b, t) => a + (b - a) * t;
  TR.rand = (a, b) => a + Math.random() * (b - a);
  TR.pick = (arr) => arr[(Math.random() * arr.length) | 0];
  TR.spawnX = (team) => (team === 1 ? TR.SPAWN : TR.W - TR.SPAWN);

  TR.drawHand = function () {
    const pool = Object.assign({}, TR.DECK);
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
