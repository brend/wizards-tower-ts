# Wizard's Tower

An endless pixel-art survival game built with TypeScript, Canvas 2D, and Web Audio.
Aim fireballs, raise skeletons, and fortify the tower against increasingly varied assaults.

## Run locally

Use Node.js 22.12+ and npm:

```sh
npm ci
npm run dev
```

Open [the game](http://localhost:5173/wizards-tower-ts/). Vite is required;
opening `index.html` directly does not compile TypeScript. The production base
path is `/wizards-tower-ts/`, configured in `vite.config.ts`.

## How to play

- **Start game** enables audio and begins the run. Audio failure does not prevent play.
- Click or tap to aim. You begin with **two ready fireballs**. Each deals 2 damage
  to its first target. One charge returns every **2.4 seconds**, sequentially.
  Spending the second charge does not restart the first recharge.
- Aim ahead of moving enemies. An input up to 150 ms before recharge is buffered.
  Kills do not reset cooldowns.
- Earn XP from kills, including skeleton kills. At **6, 8, 10, then 12 XP** per
  level, combat freezes for a choice of three upgrades. Click a card or press
  **1**, **2**, or **3**. Surplus XP carries forward.
- Choose faster fireballs, more charges, **splash or piercing**; stronger and more
  frequent skeletons; or tower health, repairs, and a regenerating ward. Cards show
  exact effects and rank limits. All upgrades last for the current run.
- The tower begins at **10 HP**. Fortification raises the maximum to 14. Healing
  restores its height. Wards block an entire hit, then recharge over 12 active seconds.
- **Pause / Resume** or **Escape** freezes the run. Switching to another tab
  automatically pauses active combat. Upgrade selection and pause award no time or score.
- The HUD shows health, active time, score, charges, XP, summons, and ward status.
- On defeat, see your kills, build, score, and local best. Choose **New run** or
  **Retry same seed**. The same seed repeats the encounter schedule; upgrade offers
  also depend on which upgrades remain eligible.

## Encounters and progression

Orks arrive from the left in 30-second segments. Opening segments are gentle;
from minute one, each assault leaves about six seconds without new arrivals.
Enemies already on the battlefield remain active during these gaps.

| Enemy | Introduced | HP | Role |
| --- | --- | --- | --- |
| Ork | Start | 2 | Standard ground attacker |
| Runner | 1 minute | 2 | Faster ground threat, marked with a gold headband |
| Gargoyle | 2 minutes | 2 | Flying attacker that bypasses skeletons |
| Brute | 3 minutes | 6 | Slow armored threat requiring several shots |
| Elite brute | 9 minutes, then every 90 seconds | 8, 10, 12… | Crowned brute with increasing durability |

Ordinary encounter budgets rise from 7 to 26 threat points per segment. Elites
replace six points of the ordinary budget after density reaches its cap, adding
late-run pressure without unbounded spawn counts. Difficulty follows active time,
not the player's health or upgrade choices.

Skeletons unlock with an immediate summon and then one every 8 seconds, up to two
active. Upgrades can raise the cap to three, health from 3 to 5, and reduce the
summon interval to 6 seconds. A full army holds one ready replacement, never a
backlog. Gargoyles still require direct attention.

After permanent upgrades are exhausted, bounded temporary boons remain available.
Fully upgraded builds require 30 XP for each further choice.

Scoring awards **5 points per active second + 20 per threat point defeated**.
The latest 20 run summaries and best score are stored locally under the balance
version. Nothing is sent to a server. Saving failures do not stop play.

## Build and checks

```sh
npm test           # Compile and run combat, progression, persistence, and voice tests
npm run typecheck  # Check TypeScript
npm run build      # Type-check and create dist/
npm run preview    # Serve the production build
npm run balance    # Compare three build policies across fixed seeds
```

Tests compile to a temporary directory and clean it afterward. They cover swept
collisions, splash/piercing, simultaneous combat, healing, charges, buffered input,
XP overflow, summon caps, seed reproducibility, elite schedules, persistence, and
20/30/60/120 Hz consistency. No additional runtime test dependency is required.

The balance comparison uses predictable targeting, a 200 ms reaction interval,
and seeded misses. Its results establish a regression baseline, not a claim
about human difficulty or fun. See [implementation and tuning notes](docs/balance-results.md)
and the [original balance proposal](docs/balance-plan.md).

For repeatable browser checks, open
[the development playtest page](http://localhost:5173/wizards-tower-ts/tests/playtest.html).
Its visible fixture buttons create upgrade, defeat, and mixed-enemy scenarios
using the actual scene. This page is not included in the production build.

## Project structure

| Path | Responsibility |
| --- | --- |
| `src/wizards-tower/Balance.ts` | Starting stats, scoring, version, and seeded random generator |
| `src/wizards-tower/Game.ts` | Pure fixed-step simulation, input, collisions, progression, and run metrics |
| `src/wizards-tower/Entities.ts` | Tower health/wards, combatants, simultaneous melee resolution |
| `src/wizards-tower/Director.ts` | Seeded encounter budgets, schedules, introductions, and elite escalation |
| `src/wizards-tower/Upgrades.ts` | Build state, eligible upgrade cards, ranks, and effects |
| `src/wizards-tower/Scene.ts` | Sprite rendering, HUD, feedback, sound events, and restart |
| `src/wizards-tower/Controls.ts` | Start, pause, sound, upgrade cards, and results UI |
| `src/wizards-tower/RunHistory.ts` | Versioned local best score and recent run summaries |
| `src/core/` | Sprite loading, swept projectile collision, timers, and charge pools |
| `src/engine/` | Canvas/animation loop, pointer coordinates, and voice playback |
| `tests/` | Regression tests and development-only browser fixtures |

The canvas uses a logical resolution of 320 × 180 and scales to the viewport.
The engine renders with `requestAnimationFrame`, capping elapsed time after
stalls at 50 ms. Combat uses fixed 1/120-second steps independently of display Hz.
Upgrade cards use HTML for readable text, keyboard selection, and narrow layouts.

The browser console exposes `game` as the engine: `game.scene.game` is the current
simulation, and `game.scene.game.stats` contains local run metrics. Prefer the UI
for pause/resume so button state stays synchronized.

## Wizard voice samples

Pre-generated samples are included. With Vite running, open the
[voice listening page](http://localhost:5173/wizards-tower-ts/assets/audio/wizard/index.html)
to compare presets. The game uses `cartridge` clips; only one plays at a time.

Regenerate the samples on macOS with Python 3.9+:

```sh
python3 tools/voice/generate.py --output public/assets/audio/wizard
python3 -m unittest discover -s tools/voice -v
```

See the [voice workshop](tools/voice/README.md) for generation details. Its older
JavaScript integration examples predate the current TypeScript layout.

## Font attribution and license

The game uses **Dogica Pixel**, regular and bold, by **Roberto Mocci**,
copyright © 2020. [Author's font page](https://rmocci.itch.io/dogica).

The unmodified font files are bundled in `public/assets/fonts/dogica/` under the
[SIL Open Font License 1.1](public/assets/fonts/dogica/OFL.txt), including the
original copyright notice and Reserved Font Name. The license permits embedding
and redistribution with the game, including webfont use. These font files retain
the OFL; the repository's ISC software license does not replace it. Both the font
files and their license are included in production builds. The game footer also
links to the author and the bundled license.
