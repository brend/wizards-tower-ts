# Checks

Run `npm test` from the repository root. `tools/test.mjs` uses the installed
TypeScript compiler to emit the app into a temporary directory, runs Node's test
runner against those modules, and removes the temporary output. Node 22.12+ works;
no native TypeScript stripping or custom runtime loader is required.

- `game.test.mjs`: combat, swept projectile hits, healing/wards, sequential charges,
  input buffering, XP, upgrades, summons, director schedules, frame-rate consistency,
  score freezing, and local storage failure handling.
- `voice.test.mjs`: audio unlock, shared context, clip caching, muting, interruption,
  failed downloads, and suspended context recovery.
- `modules.mjs`: resolves the emitted modules supplied by the test runner.

`npm run balance` runs repeatable targeting policies for seeds 7, 42, and 2026.
To include full upgrade histories: `node tools/test.mjs tools/balance.mjs --json`.
This is a tuning aid, not an automated human playtest.

With Vite running, visit `/wizards-tower-ts/tests/playtest.html` for browser fixtures.
The page reuses the app markup and real renderer and exposes visible buttons for
upgrades, defeat/restart, mixed enemy roles, and constrained container width.
It is not a production entry point. Use browser viewport controls to test actual
mobile breakpoints; the width fixture only constrains the canvas container.
