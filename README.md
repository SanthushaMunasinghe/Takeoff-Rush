# Takeoff Rush

A hybrid-casual, turn-based sky-war game for landscape mobile. You command the **blue** airport, the computer commands the **red** one.

## Play

- **Locally:** open `index.html` in a browser. No build step, no server needed.
- **GitHub Pages:** push to `main`, then enable Pages for the repository root (Settings → Pages → Deploy from branch → `main` / root).

## How it plays

1. Each turn you are dealt three random cards. Tap one and the unit appears on your runway.
2. Drag the dotted arrow to set its launch direction. That decides how steeply it climbs and where in its altitude band it levels off.
3. Press **Continue**. The enemy commits its own launch and the battle runs for 2 seconds, then freezes for the next turn.

Every card costs fuel. You gain 3 fuel a turn (10 max), so pressing Continue without a card to bank fuel is part of the strategy. Aircraft never collide; they open fire whenever an enemy is in range of their weapons. Each aircraft that reaches the far airport damages it and leaves the field. Missiles and mortar shells only hurt units. First airport to 0 loses.

| Card | Fuel | Role |
| --- | --- | --- |
| P-51 Mustang | 4 | Fast fighter, guns fire forward |
| Helicopter | 3 | Flies low, swivelling front gun |
| Bomber | 7 | Flies high, bombs whatever passes below, hits the airport hardest |
| Missile Heli | 6 | Slow, fires homing rockets |
| Missile | 3 | One-shot, hunts the nearest enemy and explodes |
| Mortar | 2 | Lobbed shell with a big splash |

Desktop keys: `1`–`3` pick a card, `↑`/`↓` aim, `Space` continues.

## Structure

```
index.html      entry point
css/style.css   page + canvas layout
js/config.js    unit stats, fuel, deck odds (all the tuning lives here)
js/art.js       procedural cartoon art: sprites, backdrop, HUD pieces
js/fx.js        explosions, smoke, comic "POW!" words, wrecks
js/audio.js     synthesised sound effects
js/sim.js       flight paths, weapons, projectiles, damage
js/ai.js        computer opponent
js/main.js      turn flow, input, HUD, render loop
```

Everything is plain scripts and canvas drawing: no modules, no build, no image or audio files.
