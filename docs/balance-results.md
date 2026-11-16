# Endless survival implementation and first tuning pass

Implemented on `codex/endless-survival-balance`. The three passes cover reliable
combat, a complete playable progression/score/restart loop, and seeded escalating
encounters with distinct enemy roles and bounded upgrade paths.

## Changes from the proposal

- XP costs are **6 / 8 / 10 / 12**, instead of 6 / 10 / 14 / 18. The original
  costs delayed support builds long enough for the three-minute brute introduction
  to overwhelm them. Reducing XP costs lets those builds acquire their important
  upgrades before the threat mix becomes too demanding. Fully capped builds use 30 XP.
- Skeleton post-cap rewards grant +1 attack damage for 20 seconds, with a refreshed
  duration rather than stacking power. Fireball rewards refill charges plus at most
  one bonus charge; tower rewards grant a single-use shield that expires after 20 seconds.
- The initial elite experiment is included to keep pressure increasing after the
  ordinary spawn budget reaches 26. Beginning at 9:02 and every 90 seconds thereafter,
  a crowned brute replaces six threat points. Health increases by 2 per elite tier;
  regular enemy stats remain stable. Elite kills give 4 XP and 120 points.
- No second active spell was added. The optional frost pulse remains a future
  experiment after human feedback on charges and targeting.

## Reproducible policy comparison

Run `npm run balance`. Policies react every 200 ms, predict moving targets, avoid
shooting ground enemies a healthy available skeleton can handle, and inject seeded
10% misses. Each policy favors its named upgrade path, then takes useful cross-path
choices. Runs stop at 10 active minutes; reaching that limit is a censored result,
not an estimated time of death.

| Seed | Fireball-first | Skeleton-first | Tower-first |
| --- | --- | --- | --- |
| 7 | ≥10:00 | ≥10:00 | ≥10:00 |
| 42 | ≥10:00 | ≥10:00 | ≥10:00 |
| 2026 | ≥10:00 | 4:43 | 5:28 |

On seed 42 with no injected misses, all three policies reached the ten-minute
limit. A policy that stopped casting after unlocking skeletons died at about
1:02, so early summons alone do not sustain survival. Across the nine 10%-miss
runs, peak enemy population was at most 11 and active summons at most 3.

The remaining spread on seed 2026 is useful follow-up evidence: support builds are
more sensitive to encounter composition and offered upgrades. Do not infer that
all choices are equally strong from the other runs. The targeting policy also
favors piercing against clustered enemies; splash needs human evaluation.

These results are not a substitute for human playtests. The original 5–8-minute
practiced-run target remains a hypothesis. Human aiming, decision speed, and
mistakes are not fully represented by a fixed miss rate.

## Validation

- Regression checks cover collision semantics, healing, simultaneous attacks,
  cooldown preservation, charge buffering, overflow XP, summon limits, upgrade
  eligibility/caps, scoring, storage, and audio behavior.
- Director output, projectile damage, score, and complete unattended runs are
  compared at 20, 30, 60, and 120 updates per second.
- Browser fixtures exercise the actual cards, keyboard choices, healing, summons,
  pause/resume, results, and restart. Narrow overlays use the available viewport
  height so all three choices are reachable without shrinking their text.
- `npm run build` type-checks and packages the production entry point; development
  fixtures are excluded.

Follow-up human checks should compare splash versus piercing, intentionally miss
an early shot, try defensive and summon-first paths, and assess whether elite
health escalation stays readable during longer runs. Change the balance version
when tuning scoring or combat so local best scores remain comparable.
