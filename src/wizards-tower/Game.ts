import { Projectile, sweptContact } from '../core/Projectile.js';
import { BALANCE, type EnemyKind } from './Balance.js';
import { Director } from './Director.js';
import { Combatant, resolveCombat } from './Entities.js';
import { Build, type UpgradeChoice, type UpgradeId } from './Upgrades.js';

export type GamePhase = 'ready' | 'playing' | 'levelup' | 'gameover';
export interface RunStats {
  version: string; seed: number; duration: number; score: number;
  casts: number; hits: number; chargeStarvedSeconds: number;
  kills: Record<EnemyKind, number>; killsBySource: Record<'fireball' | 'skeleton', number>;
  towerDamage: Record<EnemyKind, number>;
  upgrades: { id: UpgradeId; title: string; at: number }[];
  peakEnemies: number; peakMinions: number;
}
export type GameEvent = 'start' | 'cast' | 'summon' | 'damage' | 'blocked' | 'heal' | 'levelup' | 'upgrade' | 'gameover';
const enemyCounters = (): Record<EnemyKind, number> => ({ ork: 0, runner: 0, gargoyle: 0, brute: 0 });

/** Pure fixed-step simulation. Rendering, sound, storage, and UI live outside it. */
export class Game {
  phase: GamePhase = 'ready';
  readonly build: Build;
  readonly director: Director;
  readonly enemies: Combatant[] = [];
  readonly minions: Combatant[] = [];
  readonly projectiles: Projectile[] = [];
  readonly stats: RunStats;
  offers: UpgradeChoice[] = [];
  onEvent?: (event: GameEvent) => void;
  private accumulator = 0;
  private ticks = 0;
  private nextId = 1;
  private killScore = 0;
  private bufferedCast: { x: number; y: number; expires: number } | null = null;
  constructor(public readonly seed: number) {
    this.build = new Build(seed);
    this.director = new Director(seed);
    this.stats = { version: BALANCE.version, seed, duration: 0, score: 0, casts: 0, hits: 0,
      chargeStarvedSeconds: 0, kills: enemyCounters(), killsBySource: { fireball: 0, skeleton: 0 },
      towerDamage: enemyCounters(), upgrades: [], peakEnemies: 0, peakMinions: 0 };
  }
  get time(): number { return this.ticks * BALANCE.step; }
  get score(): number { return Math.floor(this.time * BALANCE.survivalScore + 1e-7) + this.killScore; }
  get wizardY(): number { return this.build.tower.y + 8; }
  begin(): void { if (this.phase === 'ready') { this.phase = 'playing'; this.onEvent?.('start'); } }
  update(dt: number): void {
    if (this.phase !== 'playing' || !Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += dt;
    while (this.accumulator + 1e-9 >= BALANCE.step && this.phase === 'playing') {
      this.accumulator = Math.max(0, this.accumulator - BALANCE.step);
      this.step();
    }
    if (this.phase !== 'playing') this.accumulator = 0;
  }
  cast(x: number, y: number): boolean {
    if (this.phase !== 'playing' || !Number.isFinite(x) || !Number.isFinite(y)) return false;
    const originX = BALANCE.towerX + 16;
    const originY = this.wizardY;
    const dx = x - originX - 4, dy = y - originY - 4;
    const length = Math.hypot(dx, dy);
    if (length < 1e-9) return false;
    if (!this.build.fireball.available) {
      if (this.build.fireball.timer.remaining <= BALANCE.fireball.buffer + 1e-9)
        this.bufferedCast = { x, y, expires: this.time + BALANCE.fireball.buffer };
      return false;
    }
    this.build.fireball.spend();
    this.bufferedCast = null;
    this.projectiles.push(new Projectile(originX, originY, BALANCE.fireball.speed * dx / length,
      BALANCE.fireball.speed * dy / length, this.build.specialization));
    this.stats.casts++;
    this.onEvent?.('cast');
    return true;
  }
  chooseUpgrade(id: UpgradeId): boolean {
    if (this.phase !== 'levelup') return false;
    const choice = this.offers.find(offer => offer.id === id);
    if (!choice) return false;
    const hpBefore = this.build.tower.hp;
    const summon = this.build.apply(id);
    if (id === 'bones') for (const minion of this.minions) { minion.hp++; minion.maxHp++; }
    if (summon) this.spawnMinion();
    this.stats.upgrades.push({ id, title: choice.title, at: this.time });
    if (this.build.tower.hp > hpBefore) this.onEvent?.('heal');
    this.offers = [];
    this.phase = 'playing';
    this.onEvent?.('upgrade');
    this.checkLevelUp();
    return true;
  }
  private checkLevelUp(): void {
    if (!this.build.canLevelUp) return;
    this.phase = 'levelup';
    this.bufferedCast = null;
    this.offers = this.build.offers();
    this.onEvent?.('levelup');
  }
  private spawnMinion(): void {
    if (this.minions.length >= this.build.skeletonCap) return;
    this.minions.push(new Combatant(this.nextId++, 'skeleton', this.build.skeletonHp));
    this.stats.peakMinions = Math.max(this.stats.peakMinions, this.minions.length);
    this.onEvent?.('summon');
  }
  private step(): void {
    const dt = BALANCE.step;
    this.ticks++;
    this.build.fireball.advance(dt);
    this.build.tower.advance(dt);
    this.build.rallyRemaining = Math.max(0, this.build.rallyRemaining - dt);
    if (this.bufferedCast) {
      if (this.time > this.bufferedCast.expires + 1e-9) this.bufferedCast = null;
      else if (this.build.fireball.available) this.cast(this.bufferedCast.x, this.bufferedCast.y);
    }
    if (!this.build.fireball.available) this.stats.chargeStarvedSeconds += dt;
    for (const spawn of this.director.update(this.time)) {
      if (this.enemies.length < BALANCE.maxEnemies) {
        const enemy = new Combatant(this.nextId++, spawn.kind);
        if (spawn.eliteTier) enemy.makeElite(spawn.eliteTier);
        this.enemies.push(enemy);
      }
    }
    const summon = this.build.summonTimer;
    if (summon) {
      summon.advance(dt);
      if (summon.isOver) {
        if (this.minions.length < this.build.skeletonCap) { this.spawnMinion(); summon.remaining += summon.interval; }
        else summon.remaining = 0;
      }
    }
    for (const actor of [...this.enemies, ...this.minions]) actor.move(dt);
    for (const projectile of this.projectiles) projectile.update(dt);
    this.projectileCollisions();
    this.selectTargets();
    for (const minion of this.minions) minion.damage = BALANCE.skeleton.damage + (this.build.rallyRemaining > 0 ? 1 : 0);
    resolveCombat([...this.enemies, ...this.minions], dt, (actor, damage) => {
      this.stats.towerDamage[actor.kind as EnemyKind] += damage;
      this.onEvent?.(damage ? 'damage' : 'blocked');
    });
    this.cleanup();
    this.stats.peakEnemies = Math.max(this.stats.peakEnemies, this.enemies.length);
    this.stats.duration = this.time;
    this.stats.score = this.score;
    if (this.build.tower.hp <= 0) { this.phase = 'gameover'; this.bufferedCast = null; this.onEvent?.('gameover'); }
    else this.checkLevelUp();
  }
  private projectileCollisions(): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const projectile = this.projectiles[i];
      const contacts = this.enemies.filter(enemy => enemy.hp > 0 && !projectile.hitIds.has(enemy.id))
        .map(enemy => ({ enemy, at: sweptContact(projectile, enemy) }))
        .filter((contact): contact is { enemy: Combatant; at: number } => contact.at !== null)
        .sort((a, b) => a.at - b.at || a.enemy.id - b.enemy.id);
      let consumed = false;
      for (const { enemy, at } of contacts) {
        if (enemy.hp <= 0) continue;
        projectile.hitIds.add(enemy.id);
        if (projectile.hitCount++ === 0) this.stats.hits++;
        enemy.lastHit = 'fireball';
        enemy.takeDamage(BALANCE.fireball.damage);
        if (projectile.mode === 'splash') {
          const x = projectile.previousX + (projectile.x - projectile.previousX) * at + 4;
          const y = projectile.previousY + (projectile.y - projectile.previousY) * at + 4;
          for (const other of this.enemies) {
            if (other.hp <= 0 || projectile.hitIds.has(other.id)) continue;
            const otherX = other.previousX + (other.x - other.previousX) * at + other.w / 2;
            const otherY = other.previousY + (other.y - other.previousY) * at + other.h / 2;
            if (Math.hypot(otherX - x, otherY - y) <= BALANCE.fireball.splashRadius) {
              projectile.hitIds.add(other.id); other.lastHit = 'fireball'; other.takeDamage(1);
            }
          }
        }
        if (projectile.mode !== 'pierce' || projectile.hitCount >= 2) { consumed = true; break; }
      }
      if (consumed || projectile.x < -16 || projectile.x > BALANCE.width || projectile.y < -16 || projectile.y > BALANCE.height)
        this.projectiles.splice(i, 1);
    }
  }
  private selectTargets(): void {
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0) continue;
      if (enemy.target && enemy.target.hp <= 0) enemy.setTarget(null);
      if (!enemy.flying) for (const minion of this.minions) {
        if (minion.hp <= 0 || !enemy.overlaps(minion)) continue;
        if (!enemy.target || enemy.target === this.build.tower) enemy.setTarget(minion);
        if (!minion.target || minion.target.hp <= 0) minion.setTarget(enemy);
      }
      if (!enemy.target && enemy.x >= BALANCE.towerX - enemy.w / 2) enemy.setTarget(this.build.tower);
    }
  }
  private cleanup(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.hp > 0) continue;
      const kind = enemy.kind as EnemyKind;
      this.build.xp += enemy.xpValue;
      this.killScore += enemy.threatCost * BALANCE.threatScore;
      this.stats.kills[kind]++;
      this.stats.killsBySource[enemy.lastHit]++;
      this.enemies.splice(i, 1);
    }
    for (let i = this.minions.length - 1; i >= 0; i--)
      if (this.minions[i].hp <= 0 || this.minions[i].x < -24) this.minions.splice(i, 1);
  }
}
