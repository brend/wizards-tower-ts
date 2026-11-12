# Wizard's Tower

![Wizard's Tower gameplay](public/assets/screenshot.jpg)

Defend the Wizard's Tower by hurling fireballs at approaching orks. This small
pixel-art browser game uses TypeScript, Canvas 2D, and Web Audio, with Vite for
development and production builds.

## Run locally

Use Node.js 22.12+ and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite, normally
[http://localhost:5173/wizards-tower-ts/](http://localhost:5173/wizards-tower-ts/).
The base path is configured in [vite.config.ts](vite.config.ts). The source
entry point is TypeScript, so use Vite rather than opening `index.html` directly
or serving the source with Python's HTTP server.

## How to play

- Click **Start game** to begin and enable sound. Timers and enemy spawning wait
  until you start; the game still starts if audio cannot be enabled.
- Click or tap inside the game to aim and cast a fireball from the wizard toward
  that position.
- Fireballs have a three-second cooldown, including at the start of the game.
  The fireball icon fills with color as it recharges. Defeating an enemy makes
  the next fireball available immediately.
- Orks spawn every three seconds and attack once per second after reaching the
  tower. The tower starts with 10 health; each attack removes one health and
  lowers the tower and wizard.
- Use **Pause** and **Resume** to stop and restart the game loop, and **Mute
  sound** / **Enable sound** to control the wizard's voice.
- When the tower runs out of health, the game-over message appears. Reload the
  page to play again.

The current game is an endless survival prototype with no victory condition or
score. Gargoyle artwork is included, but only orks currently spawn.

## Build and checks

```sh
npm run typecheck  # Check TypeScript without emitting files
npm run build      # Type-check, then build into dist/
npm run preview    # Serve the production build locally
```

The production base path is `/wizards-tower-ts/`. Change `base` in
[vite.config.ts](vite.config.ts) if deploying under a different path. The
[GitHub Actions workflow](.github/workflows/pages.yml) builds pull requests to
`main` and builds and deploys pushes to `main` to GitHub Pages.

Current limitations:

- Type-checking and builds fail because `WizardsTowerScene.ts` imports
  `../core/timer`, while the file is named `src/core/Timer.ts`. The import and
  filename casing need to match.
- `npm test` is a placeholder that exits with an error.
- `node --test tests/voice.test.mjs` still imports the removed
  `js/core/voice.js` module and needs migration to the TypeScript implementation.

The standalone Python voice-generator tests can be run with:

```sh
python3 -m unittest discover -s tools/voice -v
```

## Project structure

| Path | Responsibility |
| --- | --- |
| `src/main.ts` | Creates the voice player, game scene, engine, and controls. |
| `src/engine/Engine.ts` | Canvas setup, animation loop, FPS measurement, pause/resume, and pointer coordinate conversion. |
| `src/engine/Scene.ts` | Scene interface: `update(dt)`, `render(ctx)`, and optional pointer handling. |
| `src/engine/VoicePlayer.ts` | Shared Web Audio context, cached audio loading, and single-clip playback. |
| `src/games/WizardsTowerScene.ts` | Game state, spawning, fireballs, collisions, cooldown HUD, and game over. |
| `src/games/WizardsTowerEntities.ts` | Tower health and enemy movement, health bars, and attacks. |
| `src/games/WizardsTowerEvents.ts` | Tower attack events. |
| `src/games/WizardsTowerControls.ts` | Start screen and pause, resume, and sound buttons. |
| `src/core/` | Sprite entities, projectiles, timers, animations, and image loading. |
| `src/utils/utils.canvas.ts` | High-density canvas scaling and grayscale HUD images. |
| `public/assets/` | Sprites, screenshot, voice samples, and the voice listening page. |
| `tools/voice/` | Python speech-generation and WAV-processing tools. |

The scene uses a logical resolution of 320 × 180 with a display zoom of 5,
configured in `src/main.ts`. It displays at up to 1600 × 900 CSS pixels and
shrinks to fit the browser while preserving its aspect ratio and pixelated art.

The engine runs with `requestAnimationFrame`, following the display refresh
rate. Updates receive elapsed time in seconds, capped at 0.05 seconds per frame
after stalls. The FPS counter measures actual rendered frame timing. In the
browser console, `game` refers to the engine; after starting a game,
`game.stop()` pauses it and `game.start()` resumes it. The game state is at
`game.scene.state`.

## Wizard voice samples

Pre-generated samples are included; Python and macOS speech synthesis are not
needed to play. With Vite running, open the
[voice listening page](http://localhost:5173/wizards-tower-ts/assets/audio/wizard/index.html)
to compare the `spellbox`, `cartridge`, and `arcane` presets. The game uses
`cartridge` clips, mapped in `src/main.ts`. Only one wizard line plays at a time.

To regenerate the samples using macOS speech synthesis, use Python 3.9+ with
no third-party Python dependencies:

```sh
python3 tools/voice/generate.py --output public/assets/audio/wizard
```

Pass `--output` explicitly: the generator's default still points to
`assets/audio/wizard`, outside Vite's public asset directory. Existing integer
PCM WAV files can also be processed on other operating systems using
`--input-wav`.

See the [voice workshop](tools/voice/README.md) for custom lines, presets, batch
generation, and WAV processing. Its game-integration and asset-path examples
still refer to the older JavaScript layout; use `src/engine/VoicePlayer.ts`,
`src/main.ts`, and `public/assets/audio/wizard/` for this version.
