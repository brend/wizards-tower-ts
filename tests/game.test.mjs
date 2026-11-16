import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compiled } from './modules.mjs';
const { Game } = await compiled('wizards-tower/Game');
const { Tower, Combatant, resolveCombat } = await compiled('wizards-tower/Entities');
const { Timer, ChargePool } = await compiled('core/Timer');
const { Projectile, sweptContact } = await compiled('core/Projectile');
const { Director, segmentBudget } = await compiled('wizards-tower/Director');
const { Build } = await compiled('wizards-tower/Upgrades');
const { BALANCE, ENEMIES } = await compiled('wizards-tower/Balance');
const near = (a, b, epsilon = 1e-7) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
const sandbox = () => { const game = new Game(42); game.director.update = () => []; game.begin(); return game; };
const advance = (game, duration, hz = 60) => { for (let i = 0; i < Math.round(duration * hz); i++) game.update(1 / hz); };
const enemy = (game, id, kind, x, y = 106) => {
  const actor = new Combatant(id, kind); actor.x = actor.previousX = x; actor.y = actor.previousY = y; actor.speed = 0;
  game.enemies.push(actor); return actor;
};

test('tower healing clamps, rejects damage-as-healing, and preserves geometry', () => {
  const tower = new Tower(); tower.takeDamage(4); assert.equal(tower.hp, 6);
  tower.takeDamage(-1); assert.equal(tower.hp, 6);
  assert.equal(tower.heal(3), 3); assert.equal(tower.y, 24);
  tower.maxHp += 2; tower.heal(99); assert.equal(tower.hp, 12); assert.equal(tower.y, 16);
  tower.takeDamage(99); tower.heal(99); assert.equal(tower.hp, 0);
});
test('ward absorbs a hit, restores after active time, and temporary ward expires', () => {
  const tower = new Tower(); tower.wardUnlocked = tower.wardReady = true;
  assert.equal(tower.takeDamage(2), 0); assert.equal(tower.takeDamage(2), 2);
  tower.advance(11); assert.equal(tower.wardReady, false); tower.advance(1); assert.equal(tower.wardReady, true);
  tower.temporaryWard = 20; tower.takeDamage(1); assert.equal(tower.wardReady, true); assert.equal(tower.temporaryWard, 0);
  tower.temporaryWard = 20; tower.advance(21); assert.equal(tower.temporaryWard, 0);
});
test('interval upgrades preserve percentage and readiness', () => {
  const timer = new Timer(3); timer.advance(2.9); timer.setInterval(2.7); near(timer.remaining, 0.09);
  timer.complete(); timer.setInterval(2); assert.equal(timer.isOver, true);
});
test('charges refill sequentially without restarting on a second cast or extra slot', () => {
  const pool = new ChargePool(2, 2.4); pool.spend(); pool.advance(1); pool.spend(); near(pool.timer.remaining, 1.4);
  pool.advance(1.4); assert.equal(pool.charges, 1); pool.advance(1); pool.addSlot(); assert.equal(pool.charges, 2);
  near(pool.timer.remaining, 1.4); pool.advance(1.4); assert.equal(pool.charges, 3);
  pool.advance(99); pool.spend(); near(pool.timer.remaining, 2.4);
});
test('simultaneous lethal melee attacks trade, regardless of iteration order', () => {
  for (const reverse of [false, true]) {
    const a = new Combatant(1, 'ork'); const b = new Combatant(2, 'skeleton', 2);
    a.setTarget(b); b.setTarget(a);
    const actors = reverse ? [b, a] : [a, b];
    resolveCombat(actors, 2); resolveCombat(actors, 2);
    assert.equal(a.hp, 0); assert.equal(b.hp, 0);
  }
});
test('swept collision catches crossed and moving targets and rejects misses', () => {
  const shot = { previousX: 0, previousY: 0, x: 100, y: 0, w: 8, h: 8 };
  const target = { previousX: 50, previousY: 0, x: 20, y: 0, w: 16, h: 16 };
  near(sweptContact(shot, target), 42 / 130);
  assert.equal(sweptContact({ ...shot, y: 40, previousY: 40 }, target), null);
});
for (const hz of [20, 30, 60, 120]) {
  test(`projectiles apply one hit, consume on nearest target, at ${hz} Hz`, () => {
    const game = sandbox(); const far = enemy(game, 1, 'brute', 70); const close = enemy(game, 2, 'brute', 30);
    game.projectiles.push(new Projectile(0, 108, 200, 0)); advance(game, 0.6, hz);
    assert.equal(close.hp, 4); assert.equal(far.hp, 6); assert.equal(game.projectiles.length, 0);
  });
  test(`survival score and director are deterministic at ${hz} Hz`, () => {
    const director = new Director(123); const spawns = [];
    for (let i = 1; i <= 240 * hz; i++) spawns.push(...director.update(i / hz));
    const baseline = new Director(123).update(240);
    assert.deepEqual(spawns, baseline);
    const game = sandbox(); advance(game, 30, hz); near(game.time, 30); assert.equal(game.score, 150);
  });
}
test('piercing hits at most two targets once each', () => {
  const game = sandbox(); const actors = [30, 60, 90].map((x, i) => enemy(game, i + 1, 'brute', x));
  game.projectiles.push(new Projectile(0, 108, 200, 0, 'pierce')); advance(game, 1);
  assert.deepEqual(actors.map(a => a.hp), [4, 4, 6]);
});
test('splash excludes the primary target and applies exactly one nearby hit', () => {
  const game = sandbox(); const a = enemy(game, 1, 'brute', 30); const b = enemy(game, 2, 'brute', 30, 118);
  game.projectiles.push(new Projectile(0, 108, 200, 0, 'splash')); advance(game, 0.5);
  assert.equal(a.hp, 4); assert.equal(b.hp, 5);
});
test('level-up freezes the complete simulation and retains overflow across multiple levels', () => {
  const game = sandbox(); game.build.xp = 19; game.update(1 / 60);
  assert.equal(game.phase, 'levelup'); const time = game.time; const remaining = game.build.fireball.timer.remaining;
  game.update(100); assert.equal(game.time, time); assert.equal(game.build.fireball.timer.remaining, remaining);
  assert.deepEqual(game.offers.map(o => o.id), ['casting', 'skeleton', 'fortify']);
  assert.equal(game.chooseUpgrade('repair'), false);
  game.chooseUpgrade('casting'); assert.equal(game.build.xp, 13); assert.equal(game.phase, 'levelup');
  game.chooseUpgrade(game.offers[0].id); assert.equal(game.build.xp, 5); assert.equal(game.phase, 'playing');
});
test('cast buffer remembers aim and only accepts inputs within 150ms of recharge', () => {
  const game = sandbox(); game.cast(0, 0); game.cast(0, 0); game.projectiles.length = 0;
  advance(game, 2); game.cast(10, 100); advance(game, 0.4); assert.equal(game.stats.casts, 2);
  game.cast(0, 0); game.projectiles.length = 0; advance(game, 2.3);
  game.cast(10, 100); advance(game, 0.1); assert.equal(game.stats.casts, 4); assert.equal(game.projectiles.length, 1);
  assert.ok(game.projectiles[0].vx < 0); assert.ok(game.projectiles[0].vy > 0);
});
test('zero-distance and invalid casts do not consume charges', () => {
  const game = sandbox(); assert.equal(game.cast(164, game.wizardY + 4), false);
  assert.equal(game.cast(NaN, 3), false); assert.equal(game.build.fireball.available, 2);
});
test('summons have a hard cap, retain one ready replacement, and leave the world', () => {
  const game = sandbox(); game.build.xp = 6; game.update(1 / 60); game.chooseUpgrade('skeleton');
  for (const m of game.minions) m.speed = 0;
  advance(game, 8); for (const m of game.minions) m.speed = 0;
  advance(game, 20); assert.equal(game.minions.length, 2); assert.equal(game.build.summonTimer.remaining, 0);
  game.minions[0].hp = 0; advance(game, 0.05); assert.equal(game.minions.length, 2);
  assert.ok(game.build.summonTimer.remaining > 7.9);
  game.minions[0].x = -25; game.update(1 / 60); assert.equal(game.minions.length, 1);
});
test('gargoyles bypass ground summons and target the tower', () => {
  const game = sandbox(); const flyer = enemy(game, 1, 'gargoyle', 136, 64);
  const minion = new Combatant(2, 'skeleton'); minion.x = 136; game.minions.push(minion);
  game.update(1 / 60); assert.equal(flyer.target, game.build.tower); assert.equal(minion.target, null);
});
test('director has stable budgets, introductions, breathing windows, and reproducible variation', () => {
  assert.deepEqual([0, 1, 2, 4, 6, 8, 16, 100].map(segmentBudget), [7, 9, 12, 15, 18, 20, 26, 26]);
  const schedule = new Director(7).update(600);
  assert.deepEqual(schedule, new Director(7).update(600));
  assert.notDeepEqual(schedule, new Director(8).update(600));
  for (const spawn of schedule) {
    assert.ok(spawn.at < 60 || spawn.at % 30 < 24);
    if (spawn.kind === 'runner') assert.ok(spawn.at >= 60);
    if (spawn.kind === 'gargoyle') assert.ok(spawn.at >= 120);
    if (spawn.kind === 'brute') assert.ok(spawn.at >= 180);
  }
  for (let segment = 0; segment < 20; segment++) {
    const cost = schedule.filter(s => Math.floor(s.at / 30) === segment).reduce((sum, s) => sum + (s.eliteTier ? 6 : ENEMIES[s.kind].cost), 0);
    assert.ok(Math.abs(cost - segmentBudget(segment)) < 1);
  }
});
test('upgrade paths stay capped, respect specializations, and provide post-cap boons', () => {
  const build = new Build(1); const buy = id => { build.xp += build.xpRequired; build.apply(id); };
  buy('casting'); buy('casting'); buy('casting'); buy('reserve'); buy('pierce');
  buy('skeleton'); buy('ritual'); buy('ritual'); buy('bones'); buy('bones'); buy('legion'); buy('fortify'); buy('fortify'); buy('ward');
  near(build.fireball.timer.interval, 1.7496); assert.equal(build.fireball.capacity, 3);
  assert.equal(build.skeletonCap, 3); assert.equal(build.skeletonHp, 5); assert.equal(build.summonTimer.interval, 6);
  assert.equal(build.tower.maxHp, 14); assert.equal(build.fullyUpgraded, true); assert.equal(build.xpRequired, 30);
  assert.deepEqual(build.offers().map(o => o.id), ['surge', 'rally', 'barrier']);
  buy('surge'); buy('surge'); assert.equal(build.fireball.bonus, 1);
});
test('score includes all kill sources and freezes on game over', () => {
  const game = sandbox(); const a = enemy(game, 1, 'runner', 10); a.hp = 0; a.lastHit = 'skeleton';
  game.update(1 / 60); assert.equal(game.stats.killsBySource.skeleton, 1); assert.equal(game.score, 30);
  game.build.tower.hp = 0; game.update(1 / 60); const stats = structuredClone(game.stats);
  game.update(60); assert.deepEqual(game.stats, stats); assert.equal(game.phase, 'gameover');
  const fresh = new Game(game.seed); assert.equal(fresh.score, 0); assert.equal(fresh.build.fireball.available, 2);
  assert.equal(fresh.build.tower.hp, BALANCE.towerHp); assert.deepEqual(fresh.stats.upgrades, []);
});

test('late elites replace budget, scale in two-damage breakpoints, and receive warnings', () => {
  const director = new Director(42); const spawns = director.update(900);
  const elites = spawns.filter(spawn => spawn.eliteTier);
  assert.deepEqual(elites.map(e => [e.at, e.eliteTier]), [[542, 1], [632, 2], [722, 3], [812, 4]]);
  assert.match(director.warning(539), /Elite/);
  const actor = new Combatant(1, 'brute'); actor.makeElite(4);
  assert.equal(actor.hp, 14); assert.equal(actor.threatCost, 6); assert.equal(actor.xpValue, 4);
});

test('whole no-input runs end identically at different display rates', () => {
  const snapshots = [20, 30, 60, 120].map(hz => {
    const game = new Game(42); game.begin();
    while (game.phase === 'playing') game.update(1 / hz);
    assert.equal(game.phase, 'gameover');
    return game.stats;
  });
  for (const snapshot of snapshots) assert.deepEqual(snapshot, snapshots[0]);
});

test('run storage keeps a versioned best and bounds history even when storage fails', async () => {
  const { readHistory, saveRun } = await compiled('wizards-tower/RunHistory');
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  try {
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
      getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value),
    } });
    assert.deepEqual(readHistory(), { best: 0, runs: [] });
    for (let i = 0; i < 25; i++) saveRun({ ...new Game(i).stats, score: i });
    assert.equal(readHistory().best, 24); assert.equal(readHistory().runs.length, 20);
    assert.ok([...values.keys()][0].includes(BALANCE.version));
    values.set([...values.keys()][0], 'invalid'); assert.equal(readHistory().best, 0);
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } });
    assert.equal(saveRun({ ...new Game(1).stats, score: 50 }), 50);
  } finally {
    if (original) Object.defineProperty(globalThis, 'localStorage', original);
    else delete globalThis.localStorage;
  }
});
