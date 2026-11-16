import { BALANCE, ENEMIES, type EnemyKind } from './Balance.js';

export interface Damageable { hp: number; takeDamage(amount: number): number; }
export class Tower implements Damageable {
  hp: number = BALANCE.towerHp;
  maxHp: number = BALANCE.towerHp;
  wardUnlocked = false;
  wardReady = false;
  wardRemaining = 0;
  temporaryWard = 0;
  get missingHp(): number { return this.maxHp - this.hp; }
  get y(): number { return 16 + Math.min(10, this.missingHp) * 8; }
  takeDamage(amount: number): number {
    if (amount <= 0 || this.hp <= 0) return 0;
    if (this.wardReady || this.temporaryWard > 0) {
      if (this.temporaryWard > 0) this.temporaryWard = 0;
      else { this.wardReady = false; this.wardRemaining = BALANCE.wardInterval; }
      return 0;
    }
    const damage = Math.min(this.hp, amount);
    this.hp -= damage;
    return damage;
  }
  heal(amount: number): number {
    if (amount <= 0 || this.hp <= 0) return 0;
    const healed = Math.min(amount, this.missingHp);
    this.hp += healed;
    return healed;
  }
  advance(dt: number): void {
    this.temporaryWard = Math.max(0, this.temporaryWard - dt);
    if (this.wardUnlocked && !this.wardReady) {
      this.wardRemaining = Math.max(0, this.wardRemaining - dt);
      if (this.wardRemaining <= 1e-9) this.wardReady = true;
    }
  }
}

export class Combatant implements Damageable {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  w = 16;
  h = 16;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  attackInterval: number;
  cooldown = 0;
  target: Combatant | Tower | null = null;
  eliteTier = 0;
  lastHit: 'fireball' | 'skeleton' = 'fireball';
  constructor(public id: number, public kind: EnemyKind | 'skeleton', skeletonHp: number = BALANCE.skeleton.hp) {
    const stats = kind === 'skeleton' ? BALANCE.skeleton : ENEMIES[kind];
    this.hp = this.maxHp = kind === 'skeleton' ? skeletonHp : stats.hp;
    this.speed = stats.speed;
    this.damage = stats.damage;
    this.attackInterval = stats.attackInterval;
    this.x = kind === 'skeleton' ? BALANCE.towerX : -16;
    this.y = kind === 'gargoyle' ? 64 : BALANCE.groundY - 14;
    if (kind === 'brute') { this.w = 20; this.h = 20; this.y -= 4; }
    this.previousX = this.x;
    this.previousY = this.y;
  }
  makeElite(tier: number): void {
    this.eliteTier = tier;
    this.hp = this.maxHp = 6 + 2 * tier;
    this.w = this.h = 24;
    this.y = this.previousY = BALANCE.groundY - 22;
  }
  get threatCost(): number { return this.eliteTier ? 6 : this.kind === 'skeleton' ? 0 : ENEMIES[this.kind].cost; }
  get xpValue(): number { return this.eliteTier ? 4 : this.kind === 'skeleton' ? 0 : ENEMIES[this.kind].xp; }
  get flying(): boolean { return this.kind === 'gargoyle'; }
  takeDamage(amount: number): number {
    const damage = Math.min(this.hp, Math.max(0, amount));
    this.hp -= damage;
    return damage;
  }
  setTarget(target: Combatant | Tower | null): void {
    if (target === this.target) return;
    this.target = target;
    this.cooldown = this.attackInterval;
  }
  move(dt: number): void {
    this.previousX = this.x;
    this.previousY = this.y;
    if (this.target && this.target.hp <= 0) this.setTarget(null);
    if (this.hp > 0 && !this.target) {
      this.x += this.speed * (this.kind === 'skeleton' ? -1 : 1) * dt;
      if (this.kind !== 'skeleton') this.x = Math.min(this.x, BALANCE.towerX - this.w / 2);
    }
  }
  overlaps(other: Combatant): boolean {
    return this.x <= other.x + other.w && this.x + this.w >= other.x &&
      this.y <= other.y + other.h && this.y + this.h >= other.y;
  }
}

/** Snapshot all due attacks before applying any damage: simultaneous lethal hits trade. */
export function resolveCombat(actors: Combatant[], dt: number, onTowerHit?: (actor: Combatant, damage: number) => void): void {
  const attacks: { actor: Combatant; target: Damageable; amount: number }[] = [];
  for (const actor of actors) {
    if (actor.hp <= 0 || !actor.target || actor.target.hp <= 0) continue;
    actor.cooldown -= dt;
    while (actor.cooldown <= 1e-9) {
      attacks.push({ actor, target: actor.target, amount: actor.damage });
      actor.cooldown += actor.attackInterval;
    }
  }
  for (const { actor, target, amount } of attacks) {
    if (target instanceof Combatant && actor.kind === 'skeleton') target.lastHit = 'skeleton';
    const damage = target.takeDamage(amount);
    if (target instanceof Tower) onTowerHit?.(actor, damage);
  }
}
