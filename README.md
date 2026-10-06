# Takeoff Rush

A hybrid-casual, turn-based sky-war game for landscape mobile. You command the **blue** airport, the computer commands the **red** one.

## Play

- **Locally:** open `index.html` in a browser. No build step, no server needed.
- **GitHub Pages:** push to `main`, then enable Pages for the repository root (Settings → Pages → Deploy from branch → `main` / root).

## How it plays

1. Each turn you are dealt three random cards. Tap one and the unit appears on your runway.
2. Drag the dotted arrow to set its launch direction. That decides the curve it climbs and how high it levels off.
3. Press **Continue**. The enemy commits its own launch and the battle runs for 2 seconds, then freezes for the next turn.

Every card costs fuel. You gain 2 fuel a turn (10 max), so pressing Continue without a card to bank fuel is part of the strategy. The opening hand only ever holds aircraft you can afford on your starting fuel (Mustang, Helicopter, Missile Heli), never a Bomber, Missile or Mortar.

Every aircraft shares one band of sky, from skimming the runway up to the top of the control towers. The launch direction sets the curve it climbs and the height it levels off at: aim low and it stays low. Each aircraft watches a 30-degree cone straight ahead, out to its weapon range (drawn as a faint wedge); the Mustang's is a narrower 16 degrees. It engages enemy aircraft inside that cone and ignores anything flying above or below it, so the height you pick decides who you fight and who you slip past. Planes shoot as they fly past; helicopters stop in mid-air and fight until the enemy is gone. Aircraft never collide. Each aircraft that reaches the far airport hits it (25–60 of its 100 health) and leaves the field. Missiles and mortar shells only hurt units. First airport to 0 loses.

A bullet does 20 damage, and every aircraft goes down in 5 to 7 bullets. Rockets, bombs and shells need fewer hits.

| Card | Fuel | Health | Role |
| --- | --- | --- | --- |
| P-51 Mustang | 3 | 6 hits | Long-range guns in a narrow cone, fast, never stops |
| Helicopter | 3 | 5 hits | Short-range gun, stops to fight |
| Missile Heli | 5 | 7 hits | Long-range homing rockets, slow to reload, stops to fight |
| Bomber | 7 | 6 hits | Short range, lobs heavy bombs slowly, hits the airport hardest |
| Missile | 7 | can't be shot down | One-shot, hunts the nearest enemy and kills it outright |
| Mortar | 4 | | Lobbed shell with a big, heavy splash |

Desktop keys: `1`–`3` pick a card, `↑`/`↓` aim, `Space` continues, `←`/`→` change difficulty on the menu.

## Difficulty

Pick the opponent before every match (title screen and result screen). It starts on Noob, and beating a level lines up the next one for the rematch; you can always choose any level.

| Level | Feel | What changes |
| --- | --- | --- |
| Noob | Very easy | Plays random cards, never aims, gains only 1 fuel a turn |
| Rookie | Winnable | Mostly random cards, rarely aims, 80-health airport |
| Veteran | Some difficulty | Often picks and aims well, with regular mistakes |
| Ace | Hard | Always picks and aims its best, opens with 7 fuel and a 130-health airport |
| Legend | Very hard | Sharper again, opens with 8 fuel and a 180-health airport |

The computer always draws from the same cards and launches at most one per turn, like you. Levels change how well it plays, plus its opening fuel and airport health (and, for Noob, how fast it refuels). Level settings live in `TR.LEVELS` in `js/config.js`.

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
