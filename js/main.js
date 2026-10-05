'use strict';

// Game flow, input, HUD and the render loop.
(function () {
  const { W, H, GROUND, UNITS, FUEL, BASE_HP, TURN_TIME, clamp, lerp, rand } = TR;
  const art = TR.art, fx = TR.fx, audio = TR.audio;
  const TAU = Math.PI * 2;
  const FIXED = 1 / 60;

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const backdrop = document.createElement('canvas');
  const safe = document.getElementById('safe');

  // World-to-screen mapping. The 1600x720 world is fitted inside the safe area
  // and pinned to the bottom, so taller screens simply see more sky.
  const view = { scale: 1, dpr: 1, ox: 0, oy: 0, left: 0, right: W, top: 0, bottom: H, hudTop: 0 };

  const G = TR.G = { phase: 'menu', time: 0, turn: 0, units: [], shots: [], paths: [], teams: null };
  const ui = { picked: -1, aim: null, aiming: false, cardsT: 0, deny: -1, denyT: 0, press: 0, hintPick: true, hintAim: true, level: 0 };
  const LEVELS = TR.LEVELS;
  let acc = 0;

  // ---------------------------------------------------------------- layout

  const CARD = { w: 116, h: 152, gap: 16, y: 556 };
  const BTN_GO = { x: 1262, y: 624, w: 250, h: 80 };
  const BTN_PLAY = { x: W / 2 - 160, y: 462, w: 320, h: 90 };
  const BTN_AGAIN = { x: W / 2 - 170, y: 502, w: 340, h: 88 };
  const MENU_CHIPS = chipRects(338, 168, 76, 14);
  const OVER_CHIPS = chipRects(408, 140, 70, 10);

  // One selectable chip per difficulty level, centred in a row.
  function chipRects(y, w, h, gap) {
    const n = LEVELS.length, total = n * w + (n - 1) * gap;
    return LEVELS.map((_, i) => ({ x: W / 2 - total / 2 + i * (w + gap), y, w, h }));
  }
  function chipAt(rects, p) {
    for (let i = 0; i < rects.length; i++) if (hit(rects[i], p, 5)) return i;
    return -1;
  }

  function cardRect(i) {
    const total = 3 * CARD.w + 2 * CARD.gap;
    return { x: W / 2 - total / 2 + i * (CARD.w + CARD.gap), y: CARD.y, w: CARD.w, h: CARD.h };
  }
  function muteRect() { return { x: W / 2 + 92, y: view.hudTop + 18, w: 46, h: 46 }; }
  function hit(r, p, pad) {
    pad = pad || 0;
    return p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const cw = window.innerWidth, ch = window.innerHeight;
    canvas.width = Math.max(1, Math.round(cw * dpr));
    canvas.height = Math.max(1, Math.round(ch * dpr));
    const cs = getComputedStyle(safe);
    const il = parseFloat(cs.paddingLeft) || 0, ir = parseFloat(cs.paddingRight) || 0;
    const it = parseFloat(cs.paddingTop) || 0, ib = parseFloat(cs.paddingBottom) || 0;
    const aw = Math.max(1, cw - il - ir), ah = Math.max(1, ch - it - ib);
    const scale = Math.min(aw / W, ah / H);
    view.scale = scale; view.dpr = dpr;
    view.ox = il + (aw - W * scale) / 2;
    view.oy = it + ah - H * scale;
    view.left = -view.ox / scale; view.right = (cw - view.ox) / scale;
    view.top = -view.oy / scale; view.bottom = (ch - view.oy) / scale;
    view.hudTop = Math.max(H - ah / scale, -230);

    backdrop.width = canvas.width; backdrop.height = canvas.height;
    const c = backdrop.getContext('2d');
    c.setTransform(scale * dpr, 0, 0, scale * dpr, view.ox * dpr, view.oy * dpr);
    art.paintBackdrop(c, view);
  }

  // ------------------------------------------------------------- game flow

  function mkTeam(hp, fuel, income) {
    return { hp, maxHp: hp, lag: hp, fuel, income, hand: [], pending: null, hurtT: 0, smokeT: 0, kills: 0, landed: 0 };
  }

  function newGame() {
    G.units = []; G.shots = []; G.nextId = 1; G.turn = 0; G.winner = 0;
    // The opponent's level sets its fuel economy and airport health; yours never change.
    G.levelIndex = ui.level;
    G.level = LEVELS[ui.level];
    G.teams = { '1': mkTeam(BASE_HP, FUEL.start, FUEL.perTurn), '-1': mkTeam(G.level.hp, G.level.start, G.level.income) };
    fx.clear();
    startPlan(true);
  }

  function previewFor(type, team, angle) {
    return TR.tracePath(TR.makeBody(type, team, angle), { len: UNITS[type].previewLen });
  }

  // The whole lane an aircraft will fly, climb included, so launches can be lined
  // up with (or kept clear of) what is already in the air.
  function routeFor(type, team, angle) {
    if (!UNITS[type].weapon) return null;
    return TR.tracePath(TR.makeBody(type, team, angle), { len: W - 2 * TR.SPAWN, cap: 40 });
  }

  function startPlan(first) {
    G.phase = 'plan'; G.turn++; G.planT = 0;
    for (const k of [1, -1]) {
      const t = G.teams[k];
      if (!first) t.fuel = Math.min(FUEL.max, t.fuel + t.income);
      t.hand = TR.drawHand();
      t.pending = null;
    }
    if (!first) { fx.float(486, 606, '+' + G.teams[1].income, '#ffe55c', 34); audio.play('fuel'); }
    G.aiChoice = TR.aiPlan(G, -1, G.level);
    G.aiRevealAt = rand(0.45, 1.2);
    G.aiShown = false;
    ui.picked = -1; ui.aim = null; ui.aiming = false;
    // Where everything already in the air will travel during the next turn.
    G.paths = [];
    // (aircraft that have stopped to fight are going nowhere for now)
    for (const u of G.units) if (!u.hold) G.paths.push({ team: u.team, pts: TR.tracePath(u, { time: TURN_TIME }) });
    for (const s of G.shots) if (s.k === 'shell') G.paths.push({ team: s.team, pts: TR.tracePath(s, { time: TURN_TIME }) });
  }

  // Launch-direction samples across a unit's allowed range, used both to draw
  // the aiming fan and to turn a finger position back into a launch angle.
  function buildAim(type) {
    const def = UNITS[type], N = 20, samples = [];
    const ox = TR.spawnX(1), oy = GROUND - def.sit;
    for (let i = 0; i <= N; i++) {
      const ang = lerp(def.aMin, def.aMax, i / N);
      const pts = previewFor(type, 1, ang);
      const tip = pts[pts.length - 1];
      samples.push({ ang, pts, dir: Math.atan2(oy - tip.y, tip.x - ox) });
    }
    return { type, samples, ox, oy };
  }

  function setAim(angle) {
    const p = G.teams[1].pending;
    const def = UNITS[p.type];
    p.angle = clamp(angle, def.aMin, def.aMax);
    p.pts = previewFor(p.type, 1, p.angle);
    p.route = routeFor(p.type, 1, p.angle);
  }

  function aimAt(pt) {
    const a = ui.aim, s = a.samples;
    const dir = Math.atan2(a.oy - pt.y, Math.max(1, pt.x - a.ox));
    if (dir <= s[0].dir) return setAim(s[0].ang);
    for (let i = 1; i < s.length; i++) {
      if (dir <= s[i].dir) {
        const k = (dir - s[i - 1].dir) / Math.max(1e-6, s[i].dir - s[i - 1].dir);
        return setAim(lerp(s[i - 1].ang, s[i].ang, k));
      }
    }
    setAim(s[s.length - 1].ang);
  }

  function pickCard(i) {
    const me = G.teams[1], type = me.hand[i], def = UNITS[type];
    if (ui.picked === i) {
      ui.picked = -1; me.pending = null; ui.aim = null;
      audio.play('click');
      return;
    }
    if (def.cost > me.fuel) { ui.deny = i; ui.denyT = 0.4; audio.play('deny'); return; }
    ui.picked = i;
    ui.aim = buildAim(type);
    me.pending = { type, angle: 0, pop: 0, pts: null };
    setAim(lerp(def.aMin, def.aMax, 0.5));
    ui.hintPick = false;
    audio.play('pick');
  }

  function commit(team, p) {
    if (!p) return;
    const t = G.teams[team];
    t.fuel -= UNITS[p.type].cost;
    TR.launch(G, team, p.type, p.angle);
  }

  function go() {
    if (G.phase !== 'plan') return;
    commit(1, G.teams[1].pending);
    commit(-1, G.aiChoice);
    G.teams[1].pending = G.teams[-1].pending = null;
    G.aiChoice = null;
    ui.picked = -1; ui.aim = null; ui.aiming = false; ui.press = 0.15;
    G.phase = 'sim'; G.simT = 0; acc = 0;
    audio.play('go');
  }

  function beginEnding() {
    const a = G.teams[1].hp, b = G.teams[-1].hp;
    G.winner = a <= 0 && b <= 0 ? 0 : a <= 0 ? -1 : 1;
    G.phase = 'ending'; G.endT = 0; G.endBoom = 0;
  }

  // ---------------------------------------------------------------- update

  function update(dt) {
    G.time += dt;
    fx.update(dt);
    ui.cardsT = clamp(ui.cardsT + (G.phase === 'plan' ? dt : -dt) * 5, 0, 1);
    if (ui.denyT > 0) ui.denyT -= dt;
    if (ui.press > 0) ui.press -= dt;
    if (!G.teams) return;

    for (const k of [1, -1]) {
      const t = G.teams[k];
      if (t.hurtT > 0) t.hurtT -= dt;
      t.lag = t.lag > t.hp && t.hurtT <= 0 ? Math.max(t.hp, t.lag - 40 * dt) : Math.max(t.lag, t.hp);
      if (t.pending) t.pending.pop = Math.min(1, t.pending.pop + dt * 5);
      // a battered airport smokes
      if (t.hp < t.maxHp * 0.6 && G.phase !== 'menu') {
        t.smokeT -= dt;
        if (t.smokeT <= 0) {
          t.smokeT = t.hp < t.maxHp * 0.3 ? 0.09 : 0.2;
          const x = k === 1 ? rand(50, 170) : W - rand(50, 170);
          fx.puff(x, rand(500, 540), { r: rand(9, 16), life: 1.4, vx: rand(-8, 8), vy: -42, col: Math.random() < 0.25 && t.hp < t.maxHp * 0.3 ? '#ff9a3c' : '#5b534e', back: true });
        }
      }
    }

    if (G.phase === 'plan') {
      G.planT += dt;
      if (!G.aiShown && G.planT >= G.aiRevealAt) {
        G.aiShown = true;
        const c = G.aiChoice;
        if (c) {
          G.teams[-1].pending = { type: c.type, angle: c.angle, pop: 0, pts: previewFor(c.type, -1, c.angle), route: routeFor(c.type, -1, c.angle) };
          audio.play('click');
        }
      }
    } else if (G.phase === 'sim' || G.phase === 'ending') {
      acc += dt * (G.phase === 'ending' ? 0.45 : 1);
      while (acc >= FIXED) {
        acc -= FIXED;
        TR.simStep(G, FIXED);
        G.simT += FIXED;
        if (G.phase !== 'sim') continue;
        if (G.teams[1].hp <= 0 || G.teams[-1].hp <= 0) beginEnding();
        else if (G.simT >= TURN_TIME - 1e-6) { startPlan(false); break; }
      }
      if (G.phase === 'ending') {
        G.endT += dt; G.endBoom -= dt;
        if (G.endBoom <= 0) {
          G.endBoom = 0.16;
          for (const k of [1, -1]) {
            if (G.teams[k].hp > 0) continue;
            fx.boom(k === 1 ? rand(10, 200) : W - rand(10, 200), rand(400, 590), rand(40, 80), Math.random() < 0.4);
            audio.play('boom');
          }
        }
        if (G.endT > 2.3) {
          G.phase = 'over'; G.overT = 0;
          // Beat a level and the next one up is lined up for the rematch.
          if (G.winner === 1) ui.level = Math.min(LEVELS.length - 1, G.levelIndex + 1);
          audio.play(G.winner === 1 ? 'win' : 'lose');
        }
      }
    } else if (G.phase === 'over') {
      G.overT += dt;
    }
  }

  // ---------------------------------------------------------------- render

  function shadow(x, y, r) {
    const k = clamp(1 - (GROUND - y) / 560, 0.2, 1);
    ctx.fillStyle = 'rgba(30,20,30,' + (0.24 * k).toFixed(3) + ')';
    ctx.beginPath(); ctx.ellipse(x, GROUND + 10, r * 1.25 * (0.45 + 0.55 * k), 2 + 4 * k, 0, 0, TAU); ctx.fill();
  }

  function hpBar(u) {
    if (u.hp >= u.maxHp || u.def.kind === 'missile') return;
    const w = 42, x = u.x - w / 2, y = u.y - u.def.radius - 24, f = clamp(u.hp / u.maxHp, 0, 1);
    art.rrect(ctx, x - 2, y - 2, w + 4, 11, 5); ctx.fillStyle = art.INK; ctx.fill();
    art.rrect(ctx, x, y, Math.max(4, w * f), 7, 3.5);
    ctx.fillStyle = f > 0.5 ? '#7be36f' : f > 0.25 ? '#ffd83a' : '#ff5d4d'; ctx.fill();
  }

  function bubble(x, y, str) {
    ctx.save(); ctx.translate(x, y + Math.sin(G.time * 4) * 3);
    ctx.beginPath(); ctx.moveTo(14, 20); ctx.lineTo(30, 44); ctx.lineTo(34, 20); ctx.closePath();
    ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.lineWidth = 3.4; ctx.strokeStyle = art.INK; ctx.stroke();
    art.rrect(ctx, -52, -24, 104, 48, 22); ctx.fillStyle = '#fffaf0'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fffaf0'; ctx.fillRect(15, 14, 17, 9);
    art.text(ctx, str, 0, 2, 24, '#3b2a22', { stroke: false });
    ctx.restore();
  }

  function drawAim() {
    const me = G.teams[1], p = me.pending;
    if (!p || !ui.aim) return;
    const s = ui.aim.samples, lo = s[0].pts, hi = s[s.length - 1].pts;
    // the fan of directions this unit can be launched in
    ctx.beginPath();
    ctx.moveTo(lo[0].x, lo[0].y);
    for (const q of lo) ctx.lineTo(q.x, q.y);
    for (let i = 1; i < s.length - 1; i++) { const q = s[i].pts[s[i].pts.length - 1]; ctx.lineTo(q.x, q.y); }
    for (let i = hi.length - 1; i >= 0; i--) ctx.lineTo(hi[i].x, hi[i].y);
    ctx.closePath();
    ctx.fillStyle = 'rgba(79,157,255,0.22)'; ctx.fill();
    ctx.lineWidth = 2.5; ctx.setLineDash([10, 9]); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.stroke(); ctx.setLineDash([]);
    if (p.route) art.dotted(ctx, p.route, 'rgba(44,108,214,0.8)', { r: 3.4, gap: 16, head: 0 });
    art.dotted(ctx, p.pts, '#4f9dff', { ink: true, r: 5, gap: 18, head: 28, offset: (G.time * 30) % 18 });
    if (ui.hintAim) {
      const tip = p.pts[p.pts.length - 1];
      art.text(ctx, 'DRAG TO AIM', tip.x + 30, tip.y - 44 + Math.sin(G.time * 5) * 4, 26, '#fff', { align: 'left' });
    }
  }

  function drawWorld() {
    const t = G.time;
    if (G.phase === 'plan') {
      for (const p of G.paths) {
        art.dotted(ctx, p.pts, p.team === 1 ? 'rgba(44,108,214,0.5)' : 'rgba(204,50,38,0.5)', { r: 3.2, gap: 13, head: 15 });
      }
    }
    for (const u of G.units) shadow(u.x, u.y, u.def.radius);
    for (const s of G.shots) if (s.k === 'bomb' || s.k === 'shell') shadow(s.x, s.y, 9);
    fx.draw(ctx, true, t);

    for (const u of G.units) art.drawUnit(ctx, u, t);

    if (G.phase === 'plan') {
      const foe = G.teams[-1].pending;
      if (foe) {
        if (foe.route) art.dotted(ctx, foe.route, 'rgba(204,50,38,0.8)', { r: 3.4, gap: 16, head: 0 });
        art.dotted(ctx, foe.pts, '#ff5d4d', { ink: true, r: 5, gap: 18, head: 28, offset: (t * 30) % 18 });
        art.drawPending(ctx, foe.type, -1, foe.angle, t, foe.pop);
      } else {
        bubble(W - 236, 452, G.aiShown ? 'PASS' : '. . .');
      }
      drawAim();
      const me = G.teams[1].pending;
      if (me) art.drawPending(ctx, me.type, 1, me.angle, t, me.pop);
    }

    for (const s of G.shots) {
      if (s.k === 'bullet') art.bullet(ctx, s);
      else if (s.k === 'bomb') art.bomb(ctx, s.x, s.y, Math.atan2(s.vy, s.vx), s.team);
      else if (s.k === 'shell') art.shell(ctx, s.x, s.y, Math.atan2(s.vy, s.vx), s.team);
    }
    fx.draw(ctx, false, t);
    for (const u of G.units) hpBar(u);
  }

  function drawHud() {
    const me = G.teams[1], foe = G.teams[-1], top = view.hudTop, t = G.time;

    art.healthBar(ctx, 48, top + 24, 400, 34, me.hp / me.maxHp, me.lag / me.maxHp, 1, me.hp, me.hurtT > 0 ? 5 : 0);
    art.healthBar(ctx, W - 448, top + 24, 400, 34, foe.hp / foe.maxHp, foe.lag / foe.maxHp, -1, foe.hp, foe.hurtT > 0 ? 5 : 0);
    art.text(ctx, G.level.name.toUpperCase(), W - 440, top + 92, 24, G.level.color, { align: 'left' });
    // the opponent's fuel is public knowledge; their hand is not
    art.drop(ctx, W - 62, top + 90, 13);
    art.text(ctx, foe.fuel + '/' + FUEL.max, W - 82, top + 92, 24, '#fff', { align: 'right' });

    art.rrect(ctx, W / 2 - 78, top + 20, 156, 42, 21);
    ctx.fillStyle = 'rgba(43,26,18,0.55)'; ctx.fill();
    art.text(ctx, 'TURN ' + G.turn, W / 2, top + 43, 24, '#fff', { stroke: false });

    // fuel gauge
    const spending = ui.picked >= 0 ? UNITS[me.hand[ui.picked]].cost : 0;
    art.drop(ctx, 406, 658, 25);
    art.text(ctx, me.fuel + '/' + FUEL.max + 'L', 438, 662, 50, '#fff', { align: 'left', lw: 8 });
    for (let i = 0; i < FUEL.max; i++) {
      art.rrect(ctx, 386 + i * 21, 694, 17, 11, 4);
      const spend = i >= me.fuel - spending && i < me.fuel;
      ctx.fillStyle = i >= me.fuel ? 'rgba(43,26,18,0.35)' : spend ? (Math.sin(t * 10) > 0 ? '#ff8a1e' : '#ffe9a8') : '#ffd83a';
      ctx.fill(); ctx.lineWidth = 2.2; ctx.strokeStyle = art.INK; ctx.stroke();
    }

    // hand
    const slide = (1 - art.easeOutBack(ui.cardsT)) * 230;
    if (ui.cardsT > 0.01) {
      for (let i = 0; i < me.hand.length; i++) {
        const r = cardRect(i), type = me.hand[i];
        const sel = ui.picked === i, short = UNITS[type].cost > me.fuel;
        const dx = ui.deny === i && ui.denyT > 0 ? Math.sin(ui.denyT * 60) * 6 : 0;
        art.card(ctx, { x: r.x + dx, y: r.y + slide + i * slide * 0.25 - (sel ? 22 : 0), w: r.w, h: r.h }, type, {
          selected: sel, disabled: short, short, scale: sel ? 1.06 : 1, tilt: (i - 1) * 0.03, t,
        });
      }
      if (ui.picked >= 0) {
        // what the selected card does
        const def = UNITS[me.hand[ui.picked]];
        const info = def.name.toUpperCase() + '  ·  ' + def.tag.toUpperCase() + (def.baseDmg ? '  ·  ' + def.baseDmg + ' BASE DAMAGE' : '');
        ctx.font = '400 21px ' + art.FONT;
        const iw = ctx.measureText(info).width + 44;
        art.rrect(ctx, W / 2 - iw / 2, 480, iw, 38, 19);
        ctx.fillStyle = 'rgba(43,26,18,0.72)'; ctx.fill();
        art.text(ctx, info, W / 2, 500.5, 21, '#fff6dc', { stroke: false });
      } else if (ui.hintPick && G.turn <= 2 && G.phase === 'plan') {
        art.text(ctx, 'PICK A CARD', W / 2, 522 + Math.sin(t * 5) * 5, 30, '#fff');
      }
    }

    // continue
    const planning = G.phase === 'plan';
    art.button(ctx, BTN_GO, 'CONTINUE', {
      fill: planning ? '#ffd83a' : '#d9cfa6', pressed: ui.press > 0 || !planning,
      progress: planning ? null : clamp(G.simT / TURN_TIME, 0, 1), color: planning ? '#fff' : '#f3ecd6',
    });

    // mute
    const m = muteRect();
    ctx.beginPath(); ctx.arc(m.x + m.w / 2, m.y + m.h / 2, 21, 0, TAU);
    ctx.fillStyle = 'rgba(43,26,18,0.55)'; ctx.fill();
    ctx.save(); ctx.translate(m.x + m.w / 2 - 2, m.y + m.h / 2);
    ctx.beginPath(); ctx.moveTo(-10, -4); ctx.lineTo(-4, -4); ctx.lineTo(3, -10); ctx.lineTo(3, 10); ctx.lineTo(-4, 4); ctx.lineTo(-10, 4); ctx.closePath();
    ctx.fillStyle = '#fff'; ctx.fill();
    ctx.lineWidth = 2.6; ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
    if (audio.muted) { ctx.beginPath(); ctx.moveTo(7, -5); ctx.lineTo(15, 5); ctx.moveTo(15, -5); ctx.lineTo(7, 5); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(3, 0, 7, -0.8, 0.8); ctx.stroke(); ctx.beginPath(); ctx.arc(3, 0, 12, -0.8, 0.8); ctx.stroke(); }
    ctx.restore();
  }

  function logoWord(str, x, y, size, fill) {
    art.text(ctx, str, x + 5, y + 9, size, art.INK, { align: 'left', lw: size * 0.2 });
    art.text(ctx, str, x, y, size, fill, { align: 'left', lw: size * 0.17 });
  }

  function drawMenu() {
    const t = G.time;
    const fly = (type, team, speed, y, off, a) => {
      const span = W + 500, x = ((t * speed + off) % span) - 250;
      art.drawUnit(ctx, { def: UNITS[type], type, team, x: team === 1 ? x : W - x, y: y + Math.sin(t * 1.4 + off) * 14, a: a || 0, age: 9, id: off, flash: 0 }, t);
    };
    fly('heavy', 1, 55, 96, 900);
    fly('mustang', 1, 130, 286, 200, 0.05);
    fly('heli', -1, 60, 300, 1250);
    fly('heli', -1, 85, 520, 500);
    fly('mustang', -1, 120, 150, 1500, -0.04);

    ctx.save();
    ctx.translate(W / 2, 172); ctx.rotate(-0.03);
    const s = 1 + Math.sin(t * 2.4) * 0.018; ctx.scale(s, s);
    ctx.font = '400 140px ' + art.FONT;
    const w1 = ctx.measureText('TAKEOFF ').width, w2 = ctx.measureText('RUSH').width;
    logoWord('TAKEOFF', -(w1 + w2) / 2, 0, 140, '#ffd83a');
    logoWord('RUSH', -(w1 + w2) / 2 + w1, 0, 140, '#ff6a4d');
    ctx.restore();
    art.text(ctx, 'TURN-BASED SKY WAR', W / 2, 266, 30, '#fff');

    art.text(ctx, 'CHOOSE YOUR OPPONENT', W / 2, 314, 22, '#fff6a8', { lw: 5 });
    drawChips(MENU_CHIPS);
    art.text(ctx, LEVELS[ui.level].blurb.toUpperCase(), W / 2, 440, 21, '#fff', { lw: 5 });

    const pulse = 1 + Math.sin(t * 4) * 0.03;
    ctx.save(); ctx.translate(W / 2, BTN_PLAY.y + BTN_PLAY.h / 2); ctx.scale(pulse, pulse); ctx.translate(-W / 2, -(BTN_PLAY.y + BTN_PLAY.h / 2));
    art.button(ctx, BTN_PLAY, 'PLAY', { size: 54 });
    ctx.restore();

    art.text(ctx, '1  PICK A CARD      2  DRAG TO AIM      3  PRESS CONTINUE', W / 2, 652, 28, '#fff');
    art.text(ctx, 'LAND YOUR AIRCRAFT AT THE RED AIRPORT TO WIN', W / 2, 692, 20, '#fff6a8', { lw: 5 });
  }

  // The difficulty picker: the chosen level is lit in its own colour, and each
  // chip carries one star per rung of the ladder.
  function drawChips(rects) {
    rects.forEach((r, i) => {
      const L = LEVELS[i], on = i === ui.level;
      ctx.save();
      ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
      const s = on ? 1.08 + Math.sin(G.time * 5) * 0.012 : 1;
      ctx.scale(s, s);
      art.rrect(ctx, -r.w / 2 + 2, -r.h / 2 + 6, r.w, r.h, 16); ctx.fillStyle = 'rgba(43,26,18,0.3)'; ctx.fill();
      art.rrect(ctx, -r.w / 2, -r.h / 2, r.w, r.h, 16);
      ctx.fillStyle = on ? L.color : '#fff6dc'; ctx.fill();
      ctx.lineWidth = on ? 5 : 3.5; ctx.strokeStyle = art.INK; ctx.stroke();
      if (on) {
        ctx.save(); ctx.clip();
        ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(-r.w / 2, -r.h / 2, r.w, r.h * 0.42);
        ctx.restore();
      }
      art.text(ctx, L.name.toUpperCase(), 0, -r.h * 0.14, r.w * 0.165, on ? '#fff' : '#5a463a', { stroke: on ? art.INK : false, lw: 5 });
      const gap = r.w * 0.11;
      for (let k = 0; k < LEVELS.length; k++) {
        art.star(ctx, (k - (LEVELS.length - 1) / 2) * gap, r.h * 0.24, r.w * 0.046);
        ctx.fillStyle = k <= i ? (on ? '#fff' : L.color) : 'rgba(43,26,18,0.18)'; ctx.fill();
        if (k <= i) { ctx.lineWidth = 1.6; ctx.strokeStyle = art.INK; ctx.stroke(); }
      }
      ctx.restore();
    });
  }

  function drawOver() {
    const k = clamp(G.overT * 3, 0, 1);
    ctx.fillStyle = 'rgba(30,18,40,' + (0.5 * k).toFixed(3) + ')';
    ctx.fillRect(view.left, view.top, view.right - view.left, view.bottom - view.top);
    const s = art.easeOutBack(k);
    ctx.save(); ctx.translate(W / 2, 360); ctx.scale(s, s); ctx.translate(-W / 2, -360);
    art.rrect(ctx, W / 2 - 400, 96, 800, 520, 34);
    ctx.fillStyle = 'rgba(43,26,18,0.35)'; ctx.save(); ctx.translate(4, 12); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#fff6dc'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = art.INK; ctx.stroke();
    const win = G.winner === 1, title = win ? 'VICTORY!' : G.winner === 0 ? 'DRAW!' : 'DEFEAT!';
    ctx.save(); ctx.translate(W / 2, 172); ctx.rotate(-0.04);
    art.text(ctx, title, 5, 8, 88, art.INK, { lw: 18 });
    art.text(ctx, title, 0, 0, 88, win ? '#ffd83a' : '#ff6a4d', { lw: 16 });
    ctx.restore();
    const foe = G.level.name.toUpperCase();
    art.text(ctx, win ? 'YOU BEAT ' + foe : G.winner === 0 ? 'ALL SQUARE WITH ' + foe : foe + ' WINS THIS ONE', W / 2, 240, 26, G.level.color, { lw: 6 });
    const me = G.teams[1];
    const stats = [['TURNS', G.turn], ['SHOT DOWN', me.kills], ['LANDED', me.landed]];
    stats.forEach((st, i) => {
      const x = W / 2 + (i - 1) * 190;
      art.text(ctx, String(st[1]), x, 304, 50, '#4f9dff', { lw: 9 });
      art.text(ctx, st[0], x, 346, 18, '#6b5a4f', { stroke: false });
    });
    art.text(ctx, win && ui.level > G.levelIndex ? 'NEXT OPPONENT' : 'OPPONENT', W / 2, 388, 19, '#6b5a4f', { stroke: false });
    drawChips(OVER_CHIPS);
    art.button(ctx, BTN_AGAIN, 'PLAY AGAIN', { size: 40 });
    ctx.restore();
  }

  function render() {
    const s = view.scale * view.dpr;
    const shx = fx.shake ? rand(-1, 1) * fx.shake * s : 0, shy = fx.shake ? rand(-1, 1) * fx.shake * s : 0;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (fx.shake) {
      ctx.fillStyle = '#6cc6f5'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#5fc06a'; ctx.fillRect(0, (view.oy + GROUND * view.scale) * view.dpr, canvas.width, canvas.height);
    }
    ctx.drawImage(backdrop, shx, shy);

    ctx.setTransform(s, 0, 0, s, view.ox * view.dpr + shx, view.oy * view.dpr + shy);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    art.drawClouds(ctx, view, G.time, view.top);

    if (G.phase === 'menu') {
      ctx.setTransform(s, 0, 0, s, view.ox * view.dpr, view.oy * view.dpr);
      drawMenu();
      return;
    }
    drawWorld();
    ctx.setTransform(s, 0, 0, s, view.ox * view.dpr, view.oy * view.dpr);
    drawHud();
    if (G.phase === 'over') drawOver();
  }

  // ----------------------------------------------------------------- input

  function toWorld(e) {
    return { x: (e.clientX - view.ox) / view.scale, y: (e.clientY - view.oy) / view.scale };
  }

  function nearPath(pt, pts, reach) {
    for (const q of pts) if (Math.hypot(q.x - pt.x, q.y - pt.y) < reach) return true;
    return false;
  }

  function wantFullscreen() {
    if (!window.matchMedia || !window.matchMedia('(pointer: coarse)').matches) return;
    const el = document.documentElement;
    try {
      if (!document.fullscreenElement && el.requestFullscreen) {
        el.requestFullscreen({ navigationUI: 'hide' }).then(() => {
          if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
        }).catch(() => {});
      }
    } catch (err) { /* fullscreen is a nicety, not a requirement */ }
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    audio.unlock();
    const p = toWorld(e);
    if (G.phase !== 'menu' && hit(muteRect(), p, 8)) { audio.toggle(); return; }
    if (G.phase === 'menu' || G.phase === 'over') {
      const menu = G.phase === 'menu';
      if (!menu && G.overT < 0.4) return;
      const chip = chipAt(menu ? MENU_CHIPS : OVER_CHIPS, p);
      if (chip >= 0) { ui.level = chip; audio.play('pick'); return; }
      if (hit(menu ? BTN_PLAY : BTN_AGAIN, p, 14)) {
        if (menu) wantFullscreen();
        audio.play('go'); newGame();
      }
      return;
    }
    if (G.phase !== 'plan') return;
    if (hit(BTN_GO, p, 10)) { go(); return; }
    for (let i = 0; i < 3; i++) {
      const r = cardRect(i);
      if (hit({ x: r.x, y: r.y - 24, w: r.w, h: r.h + 24 }, p, 6)) { pickCard(i); return; }
    }
    const pend = G.teams[1].pending;
    if (pend && p.y < GROUND + 10 && nearPath(p, pend.pts, 170)) {
      ui.aiming = true; ui.hintAim = false;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
      aimAt(p);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (ui.aiming) { e.preventDefault(); aimAt(toWorld(e)); return; }
    if (e.pointerType !== 'mouse') return;
    const p = toWorld(e);
    let hot = (G.phase === 'menu' && (hit(BTN_PLAY, p, 14) || chipAt(MENU_CHIPS, p) >= 0))
      || (G.phase === 'over' && (hit(BTN_AGAIN, p, 14) || chipAt(OVER_CHIPS, p) >= 0));
    if (G.phase === 'plan') {
      hot = hit(BTN_GO, p, 10) || [0, 1, 2].some((i) => hit(cardRect(i), p, 6));
      const pend = G.teams[1].pending;
      if (!hot && pend && p.y < GROUND + 10 && nearPath(p, pend.pts, 170)) { canvas.style.cursor = 'grab'; return; }
    }
    canvas.style.cursor = hot ? 'pointer' : 'default';
  });

  const endAim = () => { ui.aiming = false; };
  canvas.addEventListener('pointerup', endAim);
  canvas.addEventListener('pointercancel', endAim);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  window.addEventListener('keydown', (e) => {
    if (e.repeat && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    audio.unlock();
    if (G.phase === 'menu' || (G.phase === 'over' && G.overT > 0.4)) {
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); newGame(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        ui.level = clamp(ui.level + (e.key === 'ArrowRight' ? 1 : -1), 0, LEVELS.length - 1);
      }
      return;
    }
    if (G.phase !== 'plan') return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); go(); }
    else if (e.key >= '1' && e.key <= '3') pickCard(+e.key - 1);
    else if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && G.teams[1].pending) {
      e.preventDefault();
      ui.hintAim = false;
      setAim(G.teams[1].pending.angle + (e.key === 'ArrowUp' ? 0.02 : -0.02));
    }
  });

  // ------------------------------------------------------------------ loop

  let last = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 250));
  if (document.fonts && document.fonts.load) document.fonts.load('40px "Luckiest Guy"').catch(() => {});
  resize();
  requestAnimationFrame(frame);
})();
