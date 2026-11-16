import { BALANCE, ENEMIES, Random, type EnemyKind } from './Balance.js';

export interface Spawn { at: number; kind: EnemyKind; eliteTier?: number; }
export function segmentBudget(segment: number): number {
  if (segment === 0) return 7;
  if (segment === 1) return 9;
  if (segment < 4) return 12;
  if (segment < 6) return 15;
  return Math.min(26, 18 + Math.max(0, Math.floor(segment / 2) - 3) * 2);
}

export class Director {
  private random: Random;
  private nextSegment = 0;
  private pending: Spawn[] = [];
  private carry = 0;
  constructor(seed: number) { this.random = new Random(seed); }
  update(time: number): Spawn[] {
    while (time + 1e-9 >= this.nextSegment * BALANCE.segmentDuration) {
      this.pending.push(...this.schedule(this.nextSegment++));
    }
    const ready: Spawn[] = [];
    while (this.pending.length && this.pending[0].at <= time + 1e-9) ready.push(this.pending.shift()!);
    return ready;
  }
  private schedule(segment: number): Spawn[] {
    let budget = segmentBudget(segment) + this.carry;
    const kinds: EnemyKind[] = [];
    // Once ordinary density is capped, replace six points with a growing elite.
    const eliteTier = segment >= 18 && segment % 3 === 0 ? (segment - 18) / 3 + 1 : 0;
    if (eliteTier) { kinds.push('brute'); budget -= 6; }
    // Each role gets a guaranteed solo introduction before random mixed encounters.
    const introduction: EnemyKind | undefined = segment === 2 ? 'runner' : segment === 4 ? 'gargoyle' : segment === 6 ? 'brute' : undefined;
    if (introduction) { kinds.push(introduction); budget -= ENEMIES[introduction].cost; }
    const pool: EnemyKind[] = ['ork', 'ork', 'ork'];
    if (segment >= 2) pool.push('runner');
    if (segment >= 4) pool.push('gargoyle');
    if (segment >= 6) pool.push('brute');
    while (budget >= 1) {
      const previous = kinds.at(-1);
      const eligible = pool.filter(kind => ENEMIES[kind].cost <= budget &&
        (kind === 'ork' || previous === undefined || previous === 'ork') &&
        !(kind === 'brute' && segment < 10 && kinds.includes('brute')));
      const kind = this.random.pick(eligible);
      kinds.push(kind);
      budget -= ENEMIES[kind].cost;
    }
    this.carry = budget;
    return kinds.map((kind, i) => ({ kind, ...(eliteTier && i === 0 ? { eliteTier } : {}), at: segment * 30 + (segment < 2
      ? 3 + i * 24 / Math.max(1, kinds.length - 1)
      : 2 + i * 21 / Math.max(1, kinds.length - 1)) }));
  }
  warning(time: number): string {
    const nextElite = Math.max(540, Math.ceil((time - 2) / 90) * 90);
    if (time >= nextElite - 3 && time < nextElite + 2) return 'Elite brute incoming';
    if (time < 3) return 'Orks approaching';
    if (time >= 57 && time < 62) return 'Runners: aim ahead';
    if (time >= 117 && time < 122) return 'Gargoyles: defend the sky';
    if (time >= 177 && time < 182) return 'Brutes: save your charges';
    if (time >= 60 && time % 30 >= 27) return 'Next assault approaching';
    if (time >= 60 && time % 30 >= 24) return 'Breathing room';
    return '';
  }
}
