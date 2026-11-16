// Repeatable targeting policy, not a substitute for human playtesting.
import { compiled } from '../tests/modules.mjs';
const { Game } = await compiled('Game');
const { Random } = await compiled('Balance');
const priorities = {
  fireball: ['casting', 'pierce', 'reserve', 'skeleton', 'fortify', 'ward', 'bones', 'ritual', 'legion', 'repair', 'surge', 'rally', 'barrier'],
  skeleton: ['skeleton', 'bones', 'ritual', 'legion', 'casting', 'pierce', 'fortify', 'ward', 'reserve', 'repair', 'rally', 'surge', 'barrier'],
  tower: ['fortify', 'ward', 'casting', 'skeleton', 'repair', 'pierce', 'reserve', 'bones', 'ritual', 'legion', 'barrier', 'surge', 'rally'],
};
function run(seed, path, missRate = 0.1, hz = 60, passive = false) {
  const game = new Game(seed); const random = new Random(seed ^ 0xFA57);
  let nextAction = 0;
  game.begin();
  while (game.phase !== 'gameover' && game.time < 600) {
    if (game.phase === 'levelup') {
      const ordered = priorities[path];
      const choice = [...game.offers].sort((a, b) => {
        const rank = id => { const n = ordered.indexOf(id); return n < 0 ? 999 : n; };
        return rank(a.id) - rank(b.id);
      })[0];
      game.chooseUpgrade(choice.id);
    }
    if (game.phase === 'playing' && game.time >= nextAction) {
      nextAction = game.time + 0.2;
      if ((!passive || !game.build.summonTimer) && game.build.fireball.available && !game.projectiles.length && game.enemies.length) {
        const urgency = actor => actor.x + (actor.flying ? 35 : 0) + (actor.target === game.build.tower ? 100 : 0) -
          (actor.target && actor.target !== game.build.tower && actor.hp <= actor.target.hp ? 45 : 0);
        // Reserve at most one manageable ground foe per summon; avoid stealing its kill.
        const reserved = new Set();
        for (const minion of game.minions) {
          const foe = game.enemies.filter(e => !e.flying && !reserved.has(e.id) &&
            e.hp <= minion.hp && (!minion.target || minion.target === e) &&
            e.x <= minion.x + minion.w).sort((a, b) => b.x - a.x)[0];
          if (foe) reserved.add(foe.id);
        }
        const target = game.enemies.filter(e => !reserved.has(e.id)).sort((a, b) => urgency(b) - urgency(a))[0];
        if (!target) { game.update(1 / hz); continue; }
        const vx = target.target ? 0 : target.speed;
        let aimX = target.x + target.w / 2;
        const aimY = target.y + target.h / 2;
        for (let i = 0; i < 3; i++) {
          const flight = Math.hypot(aimX - 164, aimY - game.wizardY - 4) / 200;
          aimX = Math.min(target.x + vx * flight, 144 - target.w / 2) + target.w / 2;
        }
        const miss = random.next() < missRate;
        game.cast(aimX, miss ? 20 : aimY);
      }
    }
    game.update(1 / hz);
  }
  return { seed, path: passive ? 'passive summons' : path, hz, missRate, seconds: +game.time.toFixed(2), score: game.score,
    level: game.build.level, hp: game.build.tower.hp, casts: game.stats.casts, hits: game.stats.hits,
    kills: Object.values(game.stats.kills).reduce((a, b) => a + b, 0),
    summonKills: game.stats.killsBySource.skeleton, peakEnemies: game.stats.peakEnemies,
    peakMinions: game.stats.peakMinions, upgrades: game.stats.upgrades.map(u => u.id).join(',') };
}
const results = [];
for (const seed of [7, 42, 2026]) for (const path of Object.keys(priorities)) results.push(run(seed, path));
for (const path of Object.keys(priorities)) results.push(run(42, path, 0));
results.push(run(42, 'skeleton', 0, 60, true));
console.table(results.map(({ upgrades, ...result }) => result));
if (process.argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
