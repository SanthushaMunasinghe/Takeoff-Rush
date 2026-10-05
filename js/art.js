'use strict';

// All drawing is procedural canvas vector art: painted, outline-free backdrops
// with thick ink-outlined props on top, in the spirit of classic 2D cartoons.
(function () {
  const TAU = Math.PI * 2;
  const { W, GROUND } = TR;
  const INK = '#2b1a12';
  const FONT = '"Luckiest Guy", "Arial Rounded MT Bold", "Chalkboard SE", "Comic Sans MS", "Trebuchet MS", sans-serif';

  const PAL = {
    '1': { body: '#4f9dff', dark: '#2c6cd6', light: '#cfe6ff', trim: '#ffd23f', glass: '#dcf5ff', ui: '#3f8cf5' },
    '-1': { body: '#ff5d4d', dark: '#cc3226', light: '#ffd2c9', trim: '#ffd23f', glass: '#fff0dd', ui: '#f2493a' },
    '0': { body: '#4d433e', dark: '#342c28', light: '#6b605a', trim: '#5a4f49', glass: '#7a6e67', ui: '#4d433e' },
  };

  const art = TR.art = { INK, FONT, PAL };

  function paint(c, fill, lw) {
    c.fillStyle = fill;
    c.fill();
    c.lineWidth = lw || 3;
    c.strokeStyle = INK;
    c.stroke();
  }

  function rrect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  art.rrect = rrect;

  // Outlined cartoon lettering.
  art.text = function (c, str, x, y, size, fill, o) {
    o = o || {};
    c.font = (o.weight || '400') + ' ' + size + 'px ' + FONT;
    c.textAlign = o.align || 'center';
    c.textBaseline = o.base || 'middle';
    c.lineJoin = 'round';
    if (o.stroke !== false) {
      c.lineWidth = o.lw || Math.max(3, size * 0.22);
      c.strokeStyle = o.stroke || INK;
      c.strokeText(str, x, y);
    }
    c.fillStyle = fill;
    c.fillText(str, x, y);
  };

  // ---------------------------------------------------------------- props

  function wheel(c, x, y, r) {
    c.beginPath(); c.arc(x, y, r, 0, TAU); paint(c, '#3a3440', 2.5);
    c.beginPath(); c.arc(x, y, r * 0.35, 0, TAU); c.fillStyle = '#d9d4cc'; c.fill();
  }

  // Spinning propeller seen edge-on: a faint disc plus one blade that pulses in length.
  function prop(c, x, y, len, t, phase) {
    const s = Math.cos(t * 38 + (phase || 0));
    c.beginPath(); c.ellipse(x, y, 3.2, len, 0, 0, TAU);
    c.fillStyle = 'rgba(70,60,60,0.22)'; c.fill();
    c.beginPath(); c.moveTo(x, y - len * s); c.lineTo(x, y + len * s);
    c.lineWidth = 3.4; c.strokeStyle = 'rgba(43,26,18,0.75)'; c.stroke();
  }

  function rotor(c, x, y, len, t, phase) {
    const s = Math.cos(t * 30 + (phase || 0));
    c.beginPath(); c.ellipse(x, y, len, 4.5, 0, 0, TAU);
    c.fillStyle = 'rgba(70,60,60,0.2)'; c.fill();
    c.beginPath(); c.moveTo(x - len * s, y); c.lineTo(x + len * s, y);
    c.lineWidth = 4.2; c.strokeStyle = 'rgba(43,26,18,0.8)'; c.stroke();
    c.beginPath(); c.arc(x, y, 3.5, 0, TAU); c.fillStyle = INK; c.fill();
  }

  function roundel(c, x, y, r, p) {
    c.beginPath(); c.arc(x, y, r, 0, TAU); paint(c, '#fffaf0', 2);
    c.beginPath(); c.arc(x, y, r * 0.48, 0, TAU); c.fillStyle = p.dark; c.fill();
  }

  function eye(c, x, y, r) {
    c.beginPath(); c.arc(x, y, r, 0, TAU); paint(c, '#fff', 1.6);
    c.beginPath(); c.arc(x + r * 0.35, y + r * 0.1, r * 0.5, 0, TAU); c.fillStyle = INK; c.fill();
    c.beginPath(); c.moveTo(x - r * 1.2, y - r * 1.5); c.lineTo(x + r * 1.3, y - r * 0.7);
    c.lineWidth = 2.2; c.strokeStyle = INK; c.stroke();
  }

  function flame(c, x, y, len, w, t) {
    const f = 1 + 0.25 * Math.sin(t * 60) + 0.12 * Math.sin(t * 97);
    c.beginPath();
    c.moveTo(x, y - w); c.quadraticCurveTo(x - len * f, y, x, y + w); c.closePath();
    c.fillStyle = '#ff8a1e'; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    c.beginPath();
    c.moveTo(x, y - w * 0.5); c.quadraticCurveTo(x - len * f * 0.55, y, x, y + w * 0.5); c.closePath();
    c.fillStyle = '#ffe873'; c.fill();
  }

  // -------------------------------------------------------------- sprites
  // Every sprite faces +x with its centre at the origin.

  const SPR = {};

  SPR.mustang = function (c, p, t, gear) {
    if (gear > 0.02) {
      c.save(); c.globalAlpha *= gear;
      c.beginPath(); c.moveTo(8, 8); c.lineTo(10, 18); c.moveTo(-45, 4); c.lineTo(-46, 12);
      c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
      wheel(c, 10, 18.5, 5.5); wheel(c, -46, 12.5, 3.2);
      c.restore();
    }
    c.beginPath(); c.ellipse(-47, -7, 10, 3.2, 0.15, 0, TAU); paint(c, p.dark);
    // fin
    c.beginPath(); c.moveTo(-28, -9); c.quadraticCurveTo(-40, -31, -51, -32);
    c.quadraticCurveTo(-58, -31, -55, -22); c.lineTo(-49, -3); c.closePath(); paint(c, p.body);
    // fuselage
    c.beginPath(); c.moveTo(-52, -3);
    c.bezierCurveTo(-30, -14, 6, -17, 30, -12);
    c.quadraticCurveTo(44, -9, 45, 0);
    c.quadraticCurveTo(44, 9, 30, 12);
    c.bezierCurveTo(8, 17, -28, 10, -52, 3);
    c.closePath(); paint(c, p.body);
    // belly
    c.beginPath(); c.moveTo(-40, 5.5); c.bezierCurveTo(-20, 11, 8, 15, 29, 10.5);
    c.bezierCurveTo(10, 9, -14, 8, -40, 5.5); c.fillStyle = p.light; c.fill();
    // cowling
    c.beginPath(); c.moveTo(30, -12); c.quadraticCurveTo(44, -9, 45, 0); c.quadraticCurveTo(44, 9, 30, 12);
    c.quadraticCurveTo(34, 0, 30, -12); c.closePath(); paint(c, p.trim, 2.5);
    // shark grin
    c.beginPath(); c.moveTo(29, 3); c.lineTo(8, 5); c.quadraticCurveTo(16, 12.5, 28, 10); c.closePath(); paint(c, '#fff', 1.8);
    c.beginPath(); c.moveTo(10, 5.6); c.lineTo(13, 9); c.lineTo(16, 5.6); c.lineTo(19, 9.6); c.lineTo(22, 5); c.lineTo(25, 9.4); c.lineTo(28, 4.2);
    c.lineWidth = 1.5; c.stroke();
    eye(c, 22, -4.5, 3.6);
    // canopy with a tiny pilot
    c.beginPath(); c.moveTo(-14, -14); c.quadraticCurveTo(-8, -28, 4, -26);
    c.quadraticCurveTo(12, -24, 16, -14.4); c.closePath(); paint(c, p.glass, 2.5);
    c.beginPath(); c.arc(-1, -17.5, 4.6, 0, TAU); paint(c, '#f6cfa5', 1.6);
    c.beginPath(); c.arc(-1, -18.4, 4.8, Math.PI * 1.02, TAU * 0.99); c.lineTo(-1, -18.4); c.closePath(); c.fillStyle = '#7a4a2a'; c.fill();
    c.beginPath(); c.moveTo(-9, -24); c.quadraticCurveTo(-4, -26, 0, -25.4);
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.stroke();
    // tailplane, wing
    c.beginPath(); c.ellipse(-45, -1, 12, 4, -0.08, 0, TAU); paint(c, p.dark);
    c.beginPath(); c.moveTo(6, 3); c.quadraticCurveTo(-2, 21, -18, 27);
    c.quadraticCurveTo(-27, 28, -24, 20); c.lineTo(-12, 3); c.closePath(); paint(c, p.dark);
    c.beginPath(); c.moveTo(-2, 7); c.quadraticCurveTo(-8, 17, -18, 22);
    c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.35)'; c.stroke();
    roundel(c, -27, -2, 6.2, p);
    // spinner + prop
    c.beginPath(); c.moveTo(45, -5.5); c.quadraticCurveTo(55, -3.5, 56, 0); c.quadraticCurveTo(55, 3.5, 45, 5.5); c.closePath(); paint(c, p.dark, 2.5);
    prop(c, 51, 0, 25, t, 0);
  };

  SPR.bomber = function (c, p, t, gear) {
    if (gear > 0.02) {
      c.save(); c.globalAlpha *= gear;
      c.beginPath(); c.moveTo(14, 12); c.lineTo(15, 26); c.moveTo(-66, 4); c.lineTo(-67, 14);
      c.lineWidth = 3.4; c.strokeStyle = INK; c.stroke();
      wheel(c, 15, 27, 7); wheel(c, -67, 14.5, 4);
      c.restore();
    }
    c.beginPath(); c.ellipse(-72, -10, 15, 4.5, 0.12, 0, TAU); paint(c, p.dark);
    // fin
    c.beginPath(); c.moveTo(-46, -13); c.quadraticCurveTo(-60, -46, -76, -48);
    c.quadraticCurveTo(-86, -46, -82, -34); c.lineTo(-73, -4); c.closePath(); paint(c, p.body);
    c.beginPath(); c.moveTo(-70, -42); c.lineTo(-62, -18); c.lineWidth = 2.2; c.strokeStyle = INK; c.stroke();
    // far engine
    c.beginPath(); c.ellipse(30, 5, 12, 6, 0, 0, TAU); paint(c, p.dark, 2.5);
    prop(c, 43, 5, 16, t, 1.3);
    // fuselage
    c.beginPath(); c.moveTo(-80, -5);
    c.bezierCurveTo(-50, -18, 18, -22, 48, -18);
    c.quadraticCurveTo(70, -14, 72, 0);
    c.quadraticCurveTo(70, 13, 50, 17);
    c.bezierCurveTo(10, 22, -46, 14, -80, 3);
    c.closePath(); paint(c, p.body, 3.4);
    c.beginPath(); c.moveTo(-62, 7); c.bezierCurveTo(-30, 15, 14, 20, 50, 15.5);
    c.bezierCurveTo(18, 14, -22, 12, -62, 7); c.fillStyle = p.light; c.fill();
    // glass nose
    c.beginPath(); c.moveTo(52, -17.5); c.quadraticCurveTo(70, -14, 72, 0); c.quadraticCurveTo(70, 12, 54, 16.4);
    c.quadraticCurveTo(59, 0, 52, -17.5); c.closePath(); paint(c, p.glass, 2.6);
    c.beginPath(); c.moveTo(57, -1); c.lineTo(71.5, -1); c.moveTo(63, -15); c.quadraticCurveTo(66, 0, 62, 14);
    c.lineWidth = 1.8; c.strokeStyle = INK; c.stroke();
    // flight deck + turret
    c.beginPath(); c.moveTo(22, -20.5); c.quadraticCurveTo(30, -31, 43, -27); c.quadraticCurveTo(48, -24, 49, -18); c.closePath(); paint(c, p.glass, 2.5);
    c.beginPath(); c.arc(-14, -19.5, 8, Math.PI, TAU); c.closePath(); paint(c, p.glass, 2.5);
    c.beginPath(); c.moveTo(-14, -25); c.lineTo(-3, -30); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    // portholes
    for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(-40 + i * 13, -6, 3.2, 0, TAU); paint(c, p.glass, 1.8); }
    eye(c, 44, -7, 3.8);
    roundel(c, -56, -3, 7, p);
    // bomb bay seam
    c.beginPath(); c.moveTo(-24, 14.2); c.quadraticCurveTo(0, 18.4, 22, 18);
    c.lineWidth = 1.8; c.strokeStyle = INK; c.stroke();
    // tailplane, wing, near engines
    c.beginPath(); c.ellipse(-70, -3, 16, 5, -0.06, 0, TAU); paint(c, p.dark);
    c.beginPath(); c.moveTo(22, 2); c.quadraticCurveTo(10, 27, -18, 38);
    c.quadraticCurveTo(-32, 40, -28, 29); c.lineTo(-12, 2); c.closePath(); paint(c, p.dark, 3.2);
    c.beginPath(); c.ellipse(12, 12, 14, 7, 0.05, 0, TAU); paint(c, p.body, 2.6);
    c.beginPath(); c.ellipse(24.5, 12.4, 3, 6.6, 0, 0, TAU); paint(c, p.trim, 2);
    prop(c, 29, 12.4, 18, t, 0.4);
    c.beginPath(); c.ellipse(-6, 27, 12, 6, 0.05, 0, TAU); paint(c, p.body, 2.6);
    c.beginPath(); c.ellipse(4.8, 27.3, 2.8, 5.7, 0, 0, TAU); paint(c, p.trim, 2);
    prop(c, 9, 27.3, 16, t, 2.2);
  };

  SPR.heli = function (c, p, t) {
    // skids
    c.beginPath(); c.moveTo(-8, 14); c.lineTo(-9, 23); c.moveTo(14, 15); c.lineTo(15, 23);
    c.moveTo(-16, 23.5); c.lineTo(24, 23.5); c.quadraticCurveTo(31, 23, 32, 17);
    c.lineWidth = 3.4; c.strokeStyle = INK; c.stroke();
    // tail boom, fin, tail rotor
    c.beginPath(); c.moveTo(-8, -11); c.lineTo(-58, -10); c.quadraticCurveTo(-63, -7, -58, -3); c.lineTo(-8, 7); c.closePath(); paint(c, p.body);
    c.beginPath(); c.moveTo(-48, -10); c.lineTo(-61, -27); c.quadraticCurveTo(-67, -27, -66, -20); c.lineTo(-58, -4); c.closePath(); paint(c, p.dark);
    c.beginPath(); c.arc(-63, -17, 10, 0, TAU); c.fillStyle = 'rgba(70,60,60,0.22)'; c.fill();
    const s = t * 45;
    c.beginPath(); c.moveTo(-63 - Math.cos(s) * 10, -17 - Math.sin(s) * 10); c.lineTo(-63 + Math.cos(s) * 10, -17 + Math.sin(s) * 10);
    c.lineWidth = 3; c.strokeStyle = 'rgba(43,26,18,0.8)'; c.stroke();
    // chin gun
    c.beginPath(); c.moveTo(22, 11); c.lineTo(41, 12.5); c.lineWidth = 5; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.moveTo(22, 11); c.lineTo(39.5, 12.4); c.lineWidth = 2; c.strokeStyle = '#8d8792'; c.stroke();
    // engine hump
    c.beginPath(); c.moveTo(-16, -15); c.quadraticCurveTo(-10, -27, 4, -26); c.quadraticCurveTo(12, -25, 12, -17); c.closePath(); paint(c, p.dark);
    // cabin
    c.beginPath(); c.moveTo(-18, -12);
    c.bezierCurveTo(-10, -22, 16, -23, 27, -13);
    c.quadraticCurveTo(38, -3, 35, 7);
    c.quadraticCurveTo(29, 17, 10, 17);
    c.lineTo(-9, 15);
    c.quadraticCurveTo(-23, 9, -18, -12);
    c.closePath(); paint(c, p.body, 3.2);
    c.beginPath(); c.moveTo(-12, 9); c.quadraticCurveTo(6, 16, 24, 12.5); c.quadraticCurveTo(6, 12, -12, 9); c.fillStyle = p.light; c.fill();
    // bubble glass
    c.beginPath(); c.moveTo(5, -19); c.quadraticCurveTo(20, -20, 27, -13); c.quadraticCurveTo(37, -3, 35, 5);
    c.lineTo(9, 3); c.quadraticCurveTo(3, -7, 5, -19); c.closePath(); paint(c, p.glass, 2.6);
    c.beginPath(); c.moveTo(19, -18); c.quadraticCurveTo(24, -6, 22, 4); c.lineWidth = 2; c.strokeStyle = INK; c.stroke();
    c.beginPath(); c.moveTo(9, -15); c.quadraticCurveTo(13, -17, 17, -16); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.stroke();
    eye(c, 28, -5, 3.4);
    roundel(c, -6, -2, 6, p);
    // mast + rotor
    c.beginPath(); c.moveTo(-2, -25); c.lineTo(-2, -33); c.lineWidth = 4.5; c.strokeStyle = INK; c.stroke();
    rotor(c, -2, -34, 54, t, 0);
  };

  // Tandem-rotor gunship with a rocket rack.
  SPR.mheli = function (c, p, t) {
    c.beginPath(); c.moveTo(-28, 13); c.lineTo(-29, 21); c.moveTo(24, 13); c.lineTo(25, 21);
    c.lineWidth = 3.2; c.strokeStyle = INK; c.stroke();
    wheel(c, -29, 22, 4.6); wheel(c, 25, 22, 4.6);
    // rotor pylons
    c.beginPath(); c.moveTo(-52, -10); c.quadraticCurveTo(-54, -36, -40, -37); c.lineTo(-30, -37);
    c.quadraticCurveTo(-23, -34, -20, -19); c.closePath(); paint(c, p.dark);
    c.beginPath(); c.moveTo(12, -19); c.quadraticCurveTo(14, -30, 22, -30); c.lineTo(30, -30);
    c.quadraticCurveTo(36, -28, 36, -17); c.closePath(); paint(c, p.dark);
    // hull
    c.beginPath(); c.moveTo(-54, -5);
    c.quadraticCurveTo(-56, -19, -42, -20);
    c.lineTo(22, -20);
    c.quadraticCurveTo(44, -18, 48, -2);
    c.quadraticCurveTo(48, 11, 34, 14);
    c.lineTo(-40, 14);
    c.quadraticCurveTo(-55, 10, -54, -5);
    c.closePath(); paint(c, p.body, 3.2);
    c.beginPath(); c.moveTo(-46, 8); c.quadraticCurveTo(-4, 13, 38, 9.5); c.quadraticCurveTo(-4, 10, -46, 8); c.fillStyle = p.light; c.fill();
    c.beginPath(); c.moveTo(-50, -9); c.lineTo(20, -9); c.lineWidth = 4; c.strokeStyle = p.trim; c.stroke();
    // cockpit
    c.beginPath(); c.moveTo(25, -18.4); c.quadraticCurveTo(42, -16, 46.6, -3); c.lineTo(31, -2);
    c.quadraticCurveTo(25, -8, 25, -18.4); c.closePath(); paint(c, p.glass, 2.6);
    eye(c, 38, -9, 3.4);
    for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(-36 + i * 17, 0, 3.6, 0, TAU); paint(c, p.glass, 1.8); }
    // rocket rack
    c.beginPath(); c.moveTo(-18, 9); c.lineTo(-18, 18); c.moveTo(8, 9); c.lineTo(8, 18); c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    for (let i = 0; i < 2; i++) {
      const y = 15.5 + i * 6.5;
      rrect(c, -24, y - 3, 34, 6, 3); paint(c, '#f4f1ea', 2);
      c.beginPath(); c.moveTo(10, y - 3); c.quadraticCurveTo(18, y, 10, y + 3); c.closePath(); paint(c, '#e23b2e', 2);
    }
    // rotors
    c.beginPath(); c.moveTo(-38, -37); c.lineTo(-38, -42); c.moveTo(25, -30); c.lineTo(25, -35);
    c.lineWidth = 4.5; c.strokeStyle = INK; c.stroke();
    rotor(c, -38, -43, 42, t, 0);
    rotor(c, 25, -36, 42, t, 1.6);
  };

  SPR.missile = function (c, p, t, gear, lit) {
    if (lit !== false) flame(c, -28, 0, 26, 6, t);
    c.beginPath(); c.moveTo(-14, -6); c.lineTo(-29, -18); c.lineTo(-35, -15); c.lineTo(-28, -5); c.closePath(); paint(c, p.dark, 2.6);
    c.beginPath(); c.moveTo(-14, 6); c.lineTo(-29, 18); c.lineTo(-35, 15); c.lineTo(-28, 5); c.closePath(); paint(c, p.dark, 2.6);
    c.beginPath(); c.moveTo(-28, -6.5); c.lineTo(10, -7.5); c.quadraticCurveTo(26, -6.5, 33, 0);
    c.quadraticCurveTo(26, 6.5, 10, 7.5); c.lineTo(-28, 6.5); c.closePath(); paint(c, '#f6f2e8', 3);
    c.beginPath(); c.moveTo(9, -7.5); c.quadraticCurveTo(26, -6.5, 33, 0); c.quadraticCurveTo(26, 6.5, 9, 7.5);
    c.quadraticCurveTo(12, 0, 9, -7.5); c.closePath(); paint(c, p.body, 2.6);
    c.beginPath(); c.rect(-17, -6.6, 6, 13.2); paint(c, p.body, 2);
    eye(c, 1, -1.2, 3);
  };

  // Mortar tube. Origin is the pivot at the foot of the tube; `ang` is its elevation.
  SPR.mortar = function (c, p, t, gear, ang) {
    const a = ang == null ? 0.9 : ang;
    c.beginPath(); c.ellipse(-2, 13, 20, 4.5, 0, 0, TAU); paint(c, '#57525c', 2.6);
    const mx = Math.cos(a) * 22, my = -Math.sin(a) * 22;
    c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + 12, 13); c.moveTo(mx, my); c.lineTo(mx + 22, 12);
    c.lineWidth = 3; c.strokeStyle = INK; c.stroke();
    c.save(); c.rotate(-a);
    rrect(c, -4, -7, 40, 14, 5); paint(c, '#6c7a66', 3);
    c.beginPath(); c.rect(22, -7, 7, 14); paint(c, p.body, 2);
    c.beginPath(); c.ellipse(36, 0, 2.6, 6, 0, 0, TAU); c.fillStyle = INK; c.fill();
    c.restore();
    c.beginPath(); c.arc(0, 0, 5, 0, TAU); paint(c, '#57525c', 2.4);
  };

  // ---------------------------------------------------------- projectiles

  art.shell = function (c, x, y, ang, team) {
    const p = PAL[team];
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(-9, -3); c.lineTo(-16, -7); c.lineTo(-16, 7); c.lineTo(-9, 3); c.closePath(); paint(c, p.dark, 2.2);
    c.beginPath(); c.moveTo(-10, -5.5); c.quadraticCurveTo(6, -8.5, 13, 0); c.quadraticCurveTo(6, 8.5, -10, 5.5); c.closePath(); paint(c, '#4a4753', 2.6);
    c.beginPath(); c.rect(-5, -6.4, 4, 12.8); c.fillStyle = p.body; c.fill();
    c.restore();
  };

  art.bomb = function (c, x, y, ang, team) {
    const p = PAL[team];
    c.save(); c.translate(x, y); c.rotate(ang);
    c.beginPath(); c.moveTo(-8, -3); c.lineTo(-15, -8); c.lineTo(-15, 8); c.lineTo(-8, 3); c.closePath(); paint(c, p.body, 2.2);
    c.beginPath(); c.moveTo(-10, -5); c.quadraticCurveTo(4, -9, 12, 0); c.quadraticCurveTo(4, 9, -10, 5); c.closePath(); paint(c, '#3b3843', 2.6);
    c.beginPath(); c.moveTo(-2, -4.4); c.quadraticCurveTo(3, -5.2, 6, -2.6); c.lineWidth = 1.8; c.strokeStyle = 'rgba(255,255,255,0.6)'; c.stroke();
    c.restore();
  };

  art.rocket = function (c, x, y, ang, team, t) {
    c.save(); c.translate(x, y); c.rotate(ang);
    flame(c, -9, 0, 14, 3.4, t);
    rrect(c, -10, -3.4, 18, 6.8, 3); paint(c, '#f6f2e8', 2.2);
    c.beginPath(); c.moveTo(7, -3.4); c.quadraticCurveTo(15, 0, 7, 3.4); c.closePath(); paint(c, PAL[team].body, 2.2);
    c.restore();
  };

  art.bullet = function (c, s) {
    const len = 16, sp = Math.hypot(s.vx, s.vy) || 1;
    const dx = s.vx / sp * len, dy = s.vy / sp * len;
    c.beginPath(); c.moveTo(s.x - dx, s.y - dy); c.lineTo(s.x, s.y);
    c.lineWidth = 6; c.strokeStyle = INK; c.stroke();
    c.lineWidth = 3; c.strokeStyle = s.team === 1 ? '#ffe55c' : '#ffb347'; c.stroke();
  };

  // ---------------------------------------------------------------- units

  art.sprite = function (c, type, team, t, gear, extra) {
    SPR[type](c, PAL[team], t, gear, extra);
  };

  // A unit in flight (or a charred wreck when team is 0).
  art.drawUnit = function (c, u, t) {
    const def = u.def;
    c.save();
    let rot = u.a, y = u.y;
    if (def.kind === 'heli') {
      rot = -0.16 * Math.cos(u.a) * TR.clamp(u.age * 2, 0, 1);
      y += Math.sin(t * 3 + u.id) * 1.6 * TR.clamp(u.age, 0, 1);
    }
    c.translate(u.x, y);
    c.scale(u.team, 1);
    c.rotate(-rot);
    if (u.flash > 0) { c.translate(TR.rand(-2, 2), TR.rand(-2, 2)); }
    const gear = def.kind === 'plane' ? 1 - TR.clamp((u.age - 0.5) / 0.5, 0, 1) : 1;
    SPR[u.type](c, PAL[u.team], t + u.id, gear);
    c.restore();
  };

  // A unit waiting on the runway during the planning phase.
  art.drawPending = function (c, type, team, ang, t, pop) {
    const def = TR.UNITS[type];
    const x = TR.spawnX(team), y = GROUND - def.sit;
    const s = 0.6 + 0.4 * easeOutBack(TR.clamp(pop, 0, 1));
    c.save();
    c.translate(x, y); c.scale(team * s, s);
    if (type === 'mortar') {
      SPR.mortar(c, PAL[team], t, 1, ang);
    } else if (type === 'missile') {
      // launch rail
      c.beginPath(); c.moveTo(-26, def.sit); c.lineTo(-6, 6); c.lineTo(14, def.sit); c.closePath(); paint(c, '#6c7a66', 3);
      c.save(); c.rotate(-ang);
      rrect(c, -30, 7, 52, 6, 3); paint(c, '#57525c', 2.4);
      SPR.missile(c, PAL[team], t, 1, false);
      c.restore();
    } else {
      SPR[type](c, PAL[team], t, 1);
    }
    c.restore();
  };

  // Card artwork: the unit scaled to sit inside a card.
  art.drawIcon = function (c, type, x, y, scale, team, t) {
    c.save(); c.translate(x, y); c.scale(scale, scale);
    if (type === 'mortar') { c.translate(-12, 8); SPR.mortar(c, PAL[team], 0, 1, 1.0); art.shell(c, 34, -34, -0.75, team); }
    else if (type === 'missile') { c.rotate(-0.42); SPR.missile(c, PAL[team], t, 1, true); }
    else SPR[type](c, PAL[team], t, 0);
    c.restore();
  };

  function easeOutBack(k) { const s = 1.70158; k -= 1; return k * k * ((s + 1) * k + s) + 1; }
  art.easeOutBack = easeOutBack;

  // ------------------------------------------------------------- backdrop

  function seeded(seed) {
    let s = seed;
    return function () { s = (s * 16807) % 2147483647; return (s & 0xffff) / 0xffff; };
  }

  function ridge(c, x0, x1, base, amp, f, ph, bottom, fill) {
    c.beginPath(); c.moveTo(x0, bottom);
    for (let x = x0; x <= x1 + 12; x += 12) {
      c.lineTo(x, base + Math.sin(x * f + ph) * amp + Math.sin(x * f * 2.7 + ph * 1.9) * amp * 0.35);
    }
    c.lineTo(x1 + 12, bottom); c.closePath();
    c.fillStyle = fill; c.fill();
  }

  function tree(c, x, y, s, r) {
    c.fillStyle = '#6b4a2f'; c.fillRect(x - 2 * s, y - 10 * s, 4 * s, 12 * s);
    c.fillStyle = '#3f9a55';
    c.beginPath(); c.arc(x, y - 22 * s, 13 * s, 0, TAU); c.arc(x - 10 * s, y - 13 * s, 10 * s, 0, TAU); c.arc(x + 10 * s, y - 13 * s, 10 * s, 0, TAU); c.fill();
    c.fillStyle = '#62bd6c';
    c.beginPath(); c.arc(x - 4 * s, y - 25 * s, 7 * s, 0, TAU); c.arc(x + 7 * s, y - 16 * s, 5 * s * (0.7 + r * 0.5), 0, TAU); c.fill();
  }

  // Static scenery for the whole visible area (cached to an offscreen canvas by the caller).
  art.paintBackdrop = function (c, v) {
    const x0 = v.left, x1 = v.right, top = v.top;
    const sky = c.createLinearGradient(0, top, 0, GROUND);
    sky.addColorStop(0, '#2f9fe8');
    sky.addColorStop(0.45, '#6cc6f5');
    sky.addColorStop(0.8, '#b9e6f8');
    sky.addColorStop(1, '#fdf1c9');
    c.fillStyle = sky; c.fillRect(x0, top, x1 - x0, GROUND - top);

    // sun
    const sx = 1180, sy = 120;
    const glow = c.createRadialGradient(sx, sy, 20, sx, sy, 230);
    glow.addColorStop(0, 'rgba(255,248,200,0.85)'); glow.addColorStop(1, 'rgba(255,248,200,0)');
    c.fillStyle = glow; c.fillRect(sx - 240, sy - 240, 480, 480);
    c.fillStyle = '#fff3a8'; c.beginPath(); c.arc(sx, sy, 58, 0, TAU); c.fill();
    c.fillStyle = '#ffe66b'; c.beginPath(); c.arc(sx, sy, 46, 0, TAU); c.fill();

    // layered hills, palest furthest away
    ridge(c, x0, x1, 500, 26, 0.0042, 1.1, GROUND, '#bfe6d6');
    ridge(c, x0, x1, 532, 20, 0.0071, 4.0, GROUND, '#9bd9a6');
    const rnd = seeded(77);
    for (let x = Math.floor(x0 / 90) * 90; x < x1; x += 90) {
      const r = seeded(Math.abs(x * 31 + 7) + 3)();
      const tx = x + r * 60;
      const ty = 532 + Math.sin(tx * 0.0071 + 4.0) * 20 + Math.sin(tx * 0.0071 * 2.7 + 7.6) * 7;
      if (r > 0.25) tree(c, tx, ty + 6, 0.55 + r * 0.35, rnd());
    }
    ridge(c, x0, x1, 566, 13, 0.011, 2.2, GROUND, '#7bcb78');
    for (let x = Math.floor(x0 / 130) * 130; x < x1; x += 130) {
      const r = seeded(Math.abs(x * 17 + 11) + 5)();
      const tx = x + r * 90;
      if (tx > 190 && tx < W - 190 && r > 0.35) tree(c, tx, 584, 0.95 + r * 0.4, rnd());
    }
    // haze where the land meets the field
    const haze = c.createLinearGradient(0, 560, 0, GROUND);
    haze.addColorStop(0, 'rgba(255,255,255,0)'); haze.addColorStop(1, 'rgba(255,250,220,0.35)');
    c.fillStyle = haze; c.fillRect(x0, 560, x1 - x0, 40);

    // grass
    const grass = c.createLinearGradient(0, GROUND, 0, v.bottom);
    grass.addColorStop(0, '#8fe08a'); grass.addColorStop(1, '#5fc06a');
    c.fillStyle = grass; c.fillRect(x0, GROUND, x1 - x0, v.bottom - GROUND);
    c.fillStyle = 'rgba(255,255,255,0.14)';
    for (let x = Math.floor(x0 / 220) * 220; x < x1; x += 220) {
      c.beginPath(); c.ellipse(x + 90, GROUND + 70, 120, 9, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(x + 10, GROUND + 104, 90, 7, 0, 0, TAU); c.fill();
    }

    // runway
    c.fillStyle = '#4d4a55'; c.fillRect(x0, GROUND, x1 - x0, 20);
    c.fillStyle = '#6f6b78'; c.fillRect(x0, GROUND, x1 - x0, 4);
    c.fillStyle = '#35323b'; c.fillRect(x0, GROUND + 18, x1 - x0, 3);
    c.fillStyle = '#f4efe0';
    for (let x = 200; x < W - 200; x += 70) c.fillRect(x, GROUND + 9, 34, 4);

    airport(c, 1);
    airport(c, -1);
  };

  function airport(c, team) {
    const p = PAL[team];
    c.save();
    if (team === -1) { c.translate(W, 0); c.scale(-1, 1); }
    c.lineJoin = 'round';
    // apron
    c.fillStyle = team === 1 ? 'rgba(79,157,255,0.28)' : 'rgba(255,93,77,0.28)';
    c.fillRect(0, GROUND, 190, 20);
    // tower shaft
    c.beginPath(); c.moveTo(22, GROUND); c.lineTo(28, 440); c.lineTo(60, 440); c.lineTo(66, GROUND); c.closePath(); paint(c, '#f3ead6', 3.4);
    c.fillStyle = p.body; c.fillRect(27, 486, 34, 12); c.fillRect(25, 536, 38, 12);
    c.lineWidth = 2.4; c.strokeRect(27, 486, 34, 12); c.strokeRect(25, 536, 38, 12);
    // cab
    c.beginPath(); c.moveTo(8, 398); c.lineTo(80, 398); c.lineTo(72, 442); c.lineTo(16, 442); c.closePath(); paint(c, p.glass, 3.4);
    c.beginPath(); c.moveTo(32, 398); c.lineTo(34, 442); c.moveTo(56, 398); c.lineTo(54, 442); c.lineWidth = 2.6; c.stroke();
    rrect(c, 2, 384, 84, 16, 5); paint(c, p.body, 3.4);
    rrect(c, 12, 440, 64, 10, 4); paint(c, p.dark, 3);
    // antenna + flag
    c.beginPath(); c.moveTo(44, 384); c.lineTo(44, 340); c.lineWidth = 3.4; c.stroke();
    c.beginPath(); c.moveTo(44, 342); c.quadraticCurveTo(58, 336, 70, 344); c.quadraticCurveTo(58, 350, 44, 358); c.closePath(); paint(c, p.body, 2.6);
    // hangar
    c.beginPath(); c.moveTo(40, GROUND); c.lineTo(40, 540); c.quadraticCurveTo(108, 478, 176, 540); c.lineTo(176, GROUND); c.closePath(); paint(c, p.body, 3.6);
    c.beginPath(); c.moveTo(40, 540); c.quadraticCurveTo(108, 478, 176, 540); c.lineTo(176, 552); c.quadraticCurveTo(108, 492, 40, 552); c.closePath(); paint(c, p.dark, 3);
    c.beginPath(); c.moveTo(58, GROUND); c.lineTo(58, 556); c.quadraticCurveTo(108, 520, 158, 556); c.lineTo(158, GROUND); c.closePath(); paint(c, '#3b2f3a', 3);
    c.beginPath(); c.arc(108, 523, 9, 0, TAU); paint(c, '#fffaf0', 2.4);
    c.beginPath(); c.arc(108, 523, 4.2, 0, TAU); c.fillStyle = p.dark; c.fill();
    // windsock
    c.beginPath(); c.moveTo(196, GROUND); c.lineTo(196, 548); c.lineWidth = 3; c.stroke();
    c.beginPath(); c.moveTo(196, 548); c.lineTo(226, 553); c.lineTo(226, 561); c.lineTo(196, 562); c.closePath(); paint(c, '#fffaf0', 2.4);
    c.fillStyle = '#ff8a1e'; c.fillRect(203, 549.5, 7, 12); c.fillRect(217, 552, 7, 9);
    c.restore();
  }

  // Drifting clouds, drawn every frame behind the action.
  const CLOUDS = [];
  (function () {
    const r = seeded(4242);
    for (let i = 0; i < 9; i++) {
      CLOUDS.push({ x: r() * 2200 - 300, y: 70 + r() * 330, s: 0.7 + r() * 1.0, v: 4 + r() * 8, k: (r() * 3) | 0 });
    }
  })();

  const CLOUD_SHAPES = [
    [[-46, 6, 22], [-18, -8, 30], [18, -2, 26], [46, 8, 18], [0, 10, 26]],
    [[-34, 4, 20], [-6, -10, 26], [26, 2, 22], [-2, 8, 22]],
    [[-60, 8, 18], [-34, -4, 26], [0, -12, 30], [34, -2, 26], [62, 8, 18], [0, 10, 28], [-30, 10, 22], [30, 10, 22]],
  ];

  art.drawClouds = function (c, v, t, top) {
    const span = (v.right - v.left) + 500;
    for (const cl of CLOUDS) {
      const x = v.left - 250 + ((((cl.x + cl.v * t) - v.left + 250) % span) + span) % span;
      const y = cl.y + (top < 0 ? top * 0.35 * (1 - cl.y / 400) : 0);
      const shape = CLOUD_SHAPES[cl.k];
      c.save(); c.translate(x, y); c.scale(cl.s, cl.s);
      c.fillStyle = 'rgba(160,205,235,0.75)';
      c.beginPath(); for (const b of shape) { c.moveTo(b[0] + b[2], b[1] + 7); c.arc(b[0], b[1] + 7, b[2], 0, TAU); } c.fill();
      c.fillStyle = '#ffffff';
      c.beginPath(); for (const b of shape) { c.moveTo(b[0] + b[2], b[1]); c.arc(b[0], b[1], b[2], 0, TAU); } c.fill();
      c.restore();
    }
  };

  // ------------------------------------------------------------------- UI

  art.drop = function (c, x, y, s) {
    c.save(); c.translate(x, y);
    c.beginPath(); c.moveTo(0, -s);
    c.bezierCurveTo(s * 0.95, 0, s * 0.8, s * 0.92, 0, s * 0.92);
    c.bezierCurveTo(-s * 0.8, s * 0.92, -s * 0.95, 0, 0, -s);
    c.closePath(); paint(c, '#ffc93c', Math.max(2, s * 0.16));
    c.beginPath(); c.moveTo(-s * 0.36, s * 0.5); c.quadraticCurveTo(-s * 0.5, s * 0.1, -s * 0.2, -s * 0.25);
    c.lineWidth = s * 0.13; c.strokeStyle = 'rgba(255,255,255,0.75)'; c.stroke();
    c.beginPath();
    c.moveTo(s * 0.12, -s * 0.22); c.lineTo(-s * 0.26, s * 0.3); c.lineTo(0, s * 0.3);
    c.lineTo(-s * 0.1, s * 0.72); c.lineTo(s * 0.3, s * 0.12); c.lineTo(s * 0.04, s * 0.12); c.closePath();
    c.fillStyle = '#1f8a52'; c.fill();
    c.restore();
  };

  // A dotted path with an arrowhead, like a pencilled flight plan.
  art.dotted = function (c, pts, col, o) {
    o = o || {};
    const r = o.r || 4.2, gap = o.gap || 15, head = o.head === undefined ? 20 : o.head;
    c.fillStyle = col;
    let carry = o.offset || 0;
    let last = pts[0], total = 0;
    for (let i = 1; i < pts.length; i++) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    const stop = total - (head ? head * 0.9 : 0);
    let run = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const seg = Math.hypot(b.x - a.x, b.y - a.y);
      let d = carry;
      while (d < seg && run + d < stop) {
        const k = d / seg;
        const x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k;
        if (o.ink) { c.beginPath(); c.arc(x, y, r + 1.6, 0, TAU); c.fillStyle = INK; c.fill(); c.fillStyle = col; }
        c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
        d += gap;
      }
      carry = d - seg; run += seg; last = b;
    }
    if (head && pts.length > 1) {
      const a = pts[Math.max(0, pts.length - 4)];
      const ang = Math.atan2(last.y - a.y, last.x - a.x);
      c.save(); c.translate(last.x, last.y); c.rotate(ang);
      c.beginPath(); c.moveTo(head * 0.5, 0); c.lineTo(-head * 0.7, -head * 0.62); c.lineTo(-head * 0.3, 0); c.lineTo(-head * 0.7, head * 0.62); c.closePath();
      if (o.ink) { c.lineWidth = 3; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(); }
      c.fillStyle = col; c.fill();
      c.restore();
    }
  };

  // Five-point star path (caller fills/strokes).
  art.star = function (c, x, y, r) {
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.46 : r;
      if (i) c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else c.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  };

  art.healthBar = function (c, x, y, w, h, frac, lag, team, hp, shake) {
    const p = PAL[team];
    c.save();
    c.translate(shake ? TR.rand(-shake, shake) : 0, shake ? TR.rand(-shake, shake) : 0);
    rrect(c, x, y, w, h, h / 2); c.fillStyle = 'rgba(43,26,18,0.25)'; c.save(); c.translate(0, 5); c.fill(); c.restore();
    rrect(c, x, y, w, h, h / 2); paint(c, '#4a3a33', 4);
    const inner = (f) => {
      const iw = Math.max(0, (w - 8) * f);
      if (iw < 2) return false;
      const ix = team === 1 ? x + 4 : x + w - 4 - iw;
      rrect(c, ix, y + 4, iw, h - 8, (h - 8) / 2);
      return true;
    };
    if (lag > frac && inner(lag)) { c.fillStyle = '#fff6d6'; c.fill(); }
    if (inner(frac)) {
      c.fillStyle = p.ui; c.fill();
      c.save(); c.clip();
      c.fillStyle = 'rgba(255,255,255,0.32)'; c.fillRect(x, y + 4, w, (h - 8) * 0.42);
      c.restore();
    }
    // badge on the outer end
    const bx = team === 1 ? x + 2 : x + w - 2;
    c.beginPath(); c.arc(bx, y + h / 2, h * 0.82, 0, TAU); paint(c, p.body, 4);
    c.save(); c.translate(bx, y + h / 2 + 1); c.scale(team * 0.36, 0.36);
    SPR.mustang(c, { body: '#fffaf0', dark: '#e8e0d0', light: '#fffaf0', trim: '#fffaf0', glass: p.dark }, 0, 0);
    c.restore();
    art.text(c, String(Math.max(0, Math.ceil(hp))), team === 1 ? x + w - 16 : x + 16, y + h / 2 + 2, h * 0.72, '#fff', { align: team === 1 ? 'right' : 'left' });
    c.restore();
  };

  art.card = function (c, r, type, o) {
    const def = TR.UNITS[type];
    c.save();
    c.translate(r.x + r.w / 2, r.y + r.h / 2);
    c.rotate(o.tilt || 0);
    c.scale(o.scale || 1, o.scale || 1);
    const w = r.w, h = r.h, x = -w / 2, y = -h / 2;
    rrect(c, x + 3, y + 7, w, h, 16); c.fillStyle = 'rgba(43,26,18,0.3)'; c.fill();
    if (o.selected) { rrect(c, x - 6, y - 6, w + 12, h + 12, 21); c.fillStyle = '#ffd83a'; c.fill(); c.lineWidth = 3; c.strokeStyle = INK; c.stroke(); }
    rrect(c, x, y, w, h, 16); paint(c, o.disabled ? '#c9c4bd' : '#fff6dc', 4);
    // art window
    rrect(c, x + 8, y + 8, w - 16, h * 0.52, 10);
    c.fillStyle = o.disabled ? '#a9a6a8' : '#8fd6f7'; c.fill(); c.lineWidth = 2.6; c.strokeStyle = INK; c.stroke();
    c.save();
    rrect(c, x + 8, y + 8, w - 16, h * 0.52, 10); c.clip();
    if (!o.disabled) {
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.beginPath(); c.arc(x + 26, y + h * 0.5, 18, 0, TAU); c.arc(x + 52, y + h * 0.53, 22, 0, TAU); c.arc(x + w - 26, y + h * 0.52, 20, 0, TAU); c.fill();
    }
    const sc = { mustang: 0.82, heli: 0.78, bomber: 0.56, mheli: 0.74, missile: 1.05, mortar: 0.95 }[type];
    if (o.disabled) c.globalAlpha = 0.55;
    art.drawIcon(c, type, 0, y + 8 + h * 0.27 + (type === 'heli' || type === 'mheli' ? 6 : 0), sc, o.disabled ? 0 : 1, o.t || 0);
    c.restore();
    // name + cost
    const name = { mustang: 'MUSTANG', heli: 'HELI', bomber: 'BOMBER', mheli: 'MISSILE HELI', missile: 'MISSILE', mortar: 'MORTAR' }[type];
    art.text(c, name, 0, y + h * 0.69, name.length > 8 ? 13 : 17, o.disabled ? '#6f6a66' : '#3b2a22', { stroke: false });
    art.drop(c, -15, y + h - 23, 13);
    art.text(c, String(def.cost), 12, y + h - 20, 26, o.short ? '#ff6b5c' : '#fff', { lw: 5 });
    c.restore();
  };

  art.button = function (c, r, label, o) {
    o = o || {};
    const press = o.pressed ? 4 : 0;
    rrect(c, r.x + 2, r.y + 8, r.w, r.h, 18); c.fillStyle = 'rgba(43,26,18,0.35)'; c.fill();
    rrect(c, r.x, r.y + press, r.w, r.h, 18); paint(c, o.fill || '#ffd83a', 4.5);
    c.save(); rrect(c, r.x, r.y + press, r.w, r.h, 18); c.clip();
    c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(r.x, r.y + press, r.w, r.h * 0.42);
    if (o.progress != null) { c.fillStyle = 'rgba(43,26,18,0.22)'; c.fillRect(r.x, r.y + press, r.w * o.progress, r.h); }
    c.restore();
    art.text(c, label, r.x + r.w / 2, r.y + r.h / 2 + 3 + press, o.size || 34, o.color || '#fff', { lw: 6 });
  };
})();
