import { BALANCE } from './Balance.js';
import type { RunStats } from './Game.js';

export interface RunHistory { best: number; runs: RunStats[]; }
const key = `wizards-tower:${BALANCE.version}:history`;
export function readHistory(): RunHistory {
  try {
    const data = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (data && Number.isFinite(data.best) && data.best >= 0 && Array.isArray(data.runs))
      return { best: data.best, runs: data.runs.slice(-20) };
  } catch { /* Storage can be unavailable in private or embedded contexts. */ }
  return { best: 0, runs: [] };
}
export function saveRun(stats: RunStats): number {
  const history = readHistory();
  const best = Math.max(history.best, stats.score);
  try { localStorage.setItem(key, JSON.stringify({ best, runs: [...history.runs, stats].slice(-20) })); }
  catch { /* A run remains playable even if saving is unavailable. */ }
  return best;
}
