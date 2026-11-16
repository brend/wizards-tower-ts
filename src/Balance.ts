/** Change the version whenever scoring or combat balance changes. */
export const BALANCE = {
  version: 'endless-1',
  step: 1 / 120,
  width: 320,
  height: 180,
  groundY: 120,
  towerX: 144,
  towerHp: 10,
  fireball: { damage: 2, speed: 200, recharge: 2.4, charges: 2, buffer: 0.15, splashRadius: 24 },
  skeleton: { hp: 3, speed: 26, damage: 1, attackInterval: 2, summonInterval: 8, cap: 2 },
  wardInterval: 12,
  segmentDuration: 30,
  maxEnemies: 48,
  xpCosts: [6, 8, 10, 12],
  survivalScore: 5,
  threatScore: 20,
} as const;

export const ENEMIES = {
  ork: { hp: 2, speed: 30, damage: 1, attackInterval: 2, cost: 1, xp: 1, flying: false },
  runner: { hp: 2, speed: 45, damage: 1, attackInterval: 2, cost: 1.5, xp: 1, flying: false },
  gargoyle: { hp: 2, speed: 24, damage: 1, attackInterval: 3, cost: 2, xp: 2, flying: true },
  brute: { hp: 6, speed: 18, damage: 2, attackInterval: 3, cost: 3, xp: 2, flying: false },
} as const;
export type EnemyKind = keyof typeof ENEMIES;

export class Random {
  constructor(public state: number) { this.state >>>= 0; }
  next(): number {
    let t = this.state += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  pick<T>(items: readonly T[]): T { return items[Math.floor(this.next() * items.length)]; }
}
