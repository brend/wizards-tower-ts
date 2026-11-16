# Endless survival balance plan

Status: original proposal. The three implementation passes are complete; see
[implementation and tuning results](balance-results.md) for shipped values and
changes from these initial hypotheses.
Direction: endless survival with escalating pressure and high scores.

## Intended experience

Make aiming, target priority, and upgrade choices matter throughout a run. Give players enough stored firepower to recover from a mistake, then introduce threats that demand different responses. Alternate pressure and short breathing windows without resetting the battlefield.

Initial pacing targets (hypotheses to test):

- First upgrade after roughly 20–30 seconds of competent play.
- Introduce a new enemy role during each of the first three minutes.
- Typical practiced runs last 5–8 minutes; strong players can push past 10.
- Most deaths have a readable cause: missed runner, neglected flyer, or an elite allowed to pin the defense.
- Fireball, skeleton, and defensive builds can all reach minute five. Skeletons support active casting throughout a run.

## Current implementation and its consequences

| System | Current behavior | Consequence |
| --- | --- | --- |
| Spawning | One ork every 3 seconds, always from the left | Constant demand of 20 enemies/minute; no changing priorities or escalation |
| Orks | 2 HP, 30 px/s, 1 damage every 2 seconds | Reach the tower roughly 4.5 seconds after spawning, then accumulate damage |
| Fireball | 3-second cooldown, 200 px/s, nominal damage 1 | Fire rate exactly matches spawn rate, leaving little recovery room without incidental multi-hits |
| Projectile collision | Applies damage every overlapping frame; projectile persists | Damage depends on overlap duration and update frequency; piercing is accidental and unlimited |
| Level-ups | Every 3 kills, same 3 icon-only choices; XP resets to zero | Frequent interruptions, little explanation, overflow XP lost |
| Fireball upgrade | Multiplies cooldown by 0.9 and replaces timer | No floor; upgrading restarts recharge, sometimes delaying the next shot |
| Skeleton upgrade | Unlocks a 6-second spawn timer, then multiplies it by 0.9 | No cooldown floor, active limit, or offscreen cleanup; long-run scaling is unbounded |
| Skeleton combat | Same HP/damage/attack interval as ork; enemy attacks resolve first | Equal-stat duels consistently favor the ork |
| Tower upgrade | Calls `takeDamage(-1)`, but damage rejects nonpositive amounts | Upgrade has no effect |
| Run result | Game over, no score or restart button | Little feedback or incentive to improve |

Additional source facts: kills currently do not reset fireball cooldown. The README describes an older version, including a different enemy attack interval.

Read-only headless checks against the current source confirmed repair leaves a damaged tower unchanged, a cooldown upgrade changes 0.1 seconds remaining to 2.7 seconds, and an isolated equal-stat duel leaves the ork at 1 HP and the skeleton dead. A stationary-target projectile pass produced 2/3/7/14 overlap damage applications at 20/30/60/120 updates per second when collision cleanup was deliberately excluded. An unattended 60 Hz run ended at about 17.6 seconds. These are diagnostic checks, not human playtest results. Type-checking passes.

## 1. Establish reliable combat rules

Do these before judging balance numbers.

- A base fireball deals exactly 2 damage to its first target and is consumed. Use swept collision so a fast projectile cannot skip a target during a slow frame. Explicit upgrades can add splash or one extra pierced target, with each target hit at most once per projectile.
- Resolve attacks due in the same simulation step from a common snapshot, then apply damage and deaths. Document that simultaneous lethal attacks trade. Preserve elapsed-time overshoot for recurring attacks/spawns.
- Add `Tower.heal(amount)` and `maxHp`, clamp healing, and synchronize tower/wizard position with health. Healing should have its own feedback. It should not move the tower above its original intact position.
- Preserve recharge percentage when changing a timer interval; a ready spell stays ready. For example, 0.1 seconds left out of 3 becomes 0.09 out of 2.7.
- Subtract the XP threshold on level-up instead of discarding surplus. Process subsequent earned levels without losing XP.
- Remove offscreen minions and bound active summons. If the cap is full, retain a ready summon rather than accumulating a backlog.
- Make descriptions display actual effects, ranks, caps, and before/after values. Hide capped upgrades and ineffective repair choices.

## 2. Give the player recoverable firepower

Start with **two fireball charges, 2.4 seconds to restore one charge, sequential recharge, and both charges ready at the start**. Spending a second charge must not restart the recharge already underway. Keep manual aiming and projectile speed at 200 px/s initially.

This yields a sustained 25 shots/minute plus a small stored burst. Against an opening rate of 15–18 basic enemies/minute, it provides room for misses and reactive targeting. The burst helps against clustered arrivals, but cannot sustain a stronger stream indefinitely. These capacity estimates assume hits and one-shot basic enemies; they are not forecasts of player performance.

Show both charges and recharge progress. Buffer a cast pressed up to 150 ms before a charge becomes ready, using the aim position from that input. Do not restore charges on kills: that would make successful casting self-fueling and undermine cooldown upgrades.

Keep the first pass to one aimed spell. A second active control spell is a later experiment, after this loop works.

## 3. Replace constant spawning with escalating encounters

Use a director driven by active survival time, with reproducible seeds. Each 30-second segment has a threat budget, a spawn schedule, and a composition rule. Upgrade menus and pause stop this clock. Do not scale pressure according to player upgrades or current health: players should feel stronger when their build improves.

Starting budget sketch:

| Active time | Threat points per 30-second segment | Composition |
| --- | ---: | --- |
| 0:00–0:30 | 7 | Basic orks only; spaced introductions |
| 0:30–1:00 | 9 | Basic orks; first small pair |
| 1:00–2:00 | 12 | Introduce runners individually, then mix them in |
| 2:00–3:00 | 15 | Introduce gargoyles and ground/air combinations |
| 3:00–4:00 | 18 | Add brutes and more deliberate grouped arrivals |
| After 4:00 | +2 each minute, provisional density ceiling of 26 | Increase pressure, then test scheduled elite encounters |

Spread the opening segments evenly. From minute one, concentrate arrivals into roughly 24 seconds and allow about 6 seconds without new spawns. Existing enemies stay active, so this is breathing room only if the player earns it. Show a short visual warning before a burst and a distinct warning for the first flyer or elite.

Provisional threat costs are ork 1, runner 1.5, gargoyle 2, brute 3. Unspent budget carries into the next segment. Limit early segments to one specialist at a time and avoid overlapping multiple brutes initially. Threat cost needs tuning against actual target handling time and damage dealt, not just HP.

After the density ceiling, prototype an elite encounter every 90 seconds that replaces part of the regular budget. Increase elite durability in visible two-damage breakpoints. Keep regular enemy speeds and HP stable so the player can learn them. The long-run elite curve needs separate testing; avoid unlimited on-screen population as a difficulty mechanism.

## 4. Add enemy roles that change targeting decisions

| Enemy | Initial stats | Decision it creates |
| --- | --- | --- |
| Ork | 2 HP, 30 px/s, 1 damage / 2 s | Baseline one-fireball target; skeletons can handle some |
| Runner | 2 HP, 45 px/s, 1 damage / 2 s | Immediate aim priority; mix sparingly with slower targets |
| Gargoyle | 2 HP, 24 px/s, 1 damage / 3 s | Flies above ground units and bypasses skeletons; requires direct attention |
| Brute | 6 HP, 18 px/s, 2 damage / 3 s | Consumes several charges or ties up a skeleton while other threats advance |

Keep the left-side approach for this iteration; elevation and speed already create new priorities. Two-sided attacks would require directional summons and a larger targeting/UI change. Reuse the existing gargoyle art. Give runners and brutes visibly different silhouettes or markings rather than relying on HP bars alone.

Do not make later enemies universally faster, tougher, and stronger. Stable archetypes keep the effects of upgrades understandable.

## 5. Turn upgrades into recognizable builds

Use XP costs of **6, 10, 14, then 18 per level**, retaining overflow. Start with 1 XP per ork/runner and 2 per gargoyle/brute. Tune for roughly 25–45 seconds between later choices, accounting for changing kill rates.

Offer three labeled choices, one eligible option from each path. Make the first offer predictable: Quick Casting, Raise Skeleton, Fortify. Later offers vary within each path using the run seed. No rarity system is needed yet.

| Path | Proposed upgrades | Bounds and purpose |
| --- | --- | --- |
| Fireball | Quick Casting: −10% recharge, 3 ranks; Deep Reserve: +1 charge, 1 rank | Recharge 2.40 → 2.16 → 1.94 → 1.75 seconds; at most 3 charges |
| Fireball | At the first specialization offer, choose splash or piercing | Splash: 1 damage within 24 px of impact, excluding the primary target. Piercing: hit one additional target for 2 damage. Make these mutually exclusive initially |
| Skeleton | Unlock: summon immediately, then every 8 seconds, max 2 active | 3 HP, 1 damage / 2 s, 26 px/s. Can beat one isolated ork, but cannot cover the whole stream |
| Skeleton | Faster Ritual: 8 → 7 → 6 seconds; Reinforced Bones: +1 HP, up to 2 ranks; Legion: +1 active slot | Explicit maximum of 3 active; health and supply give distinct ways to improve coverage |
| Tower | Fortify: +2 max HP and heal 3, 2 ranks | Starting 10 HP; maximum 14 HP. Healing also creates immediate value while permanent capacity helps later |
| Tower | Ward: absorb one tower hit, recover after 12 seconds of active time, 1 rank | A visible buffer against leaks; damage absorbed should be shown |

New charge slots start filled; new max-HP capacity is included in the same capped heal operation. Keep tower geometry tied to missing HP. Do not reset unrelated spell/summon timers on upgrade.

At max health, Fortify is still useful while ranks remain. Offer a repeatable Repair (+3 HP) only after at least 3 HP is missing. If a path has no eligible permanent option, substitute a clearly labeled temporary boon, such as one extra filled charge that disappears when spent or a 20-second ward. At full permanent progression, continue choices at a slower cadence using these bounded boons; never reintroduce unlimited cooldown reduction or summon capacity.

Avoid baseline fireball damage upgrades in the first pass. With 2-HP standard enemies, many damage increases do nothing until a breakpoint, then abruptly change the game. Splash, pierce, charges, and cooldown offer clearer initial choices.

## 6. Make survival and improvement visible

Add a compact HUD for tower HP/max HP, active time, score, level/XP, fireball charges, and active skeletons/cap. Keep upgrade text large enough to read alongside the pixel-art canvas; HTML cards are an option if 320×180 is too cramped.

Initial scoring: **5 points per active second + 20 points per threat point defeated**. Summon kills count equally. Give the game-over screen survival time, kills by type, selected upgrades, best score, and a restart button. Store local best scores with a balance-version identifier so changed rules do not silently compete with older scores.

Pause and upgrade selection neither award survival score nor advance combat. Keep score multipliers out of the initial pass. A later fixed-seed challenge can support fair comparisons once the baseline is stable.

## Implementation and validation order

1. **Correctness:** collision semantics, healing, simultaneous attacks, timer preservation, XP overflow, minion cleanup. Update the outdated README. Add focused regression tests for these rules.
2. **Playable baseline:** central balance configuration, two-charge fireball, bounded skeletons, clear upgrade cards, score and restart. Playtest against basic orks before adding specialists.
3. **Pressure and choices:** time-based director, seeded encounters, runners, gargoyles, brutes, and the full bounded upgrade paths. Change one subsystem's numbers at a time.
4. **Long-run tuning:** elite encounters, post-cap rewards, and optional second spell. Candidate: a non-damaging frost pulse with a 12-second cooldown that slows nearby enemies by 50% for 2 seconds; test only if charge management still leaves too little tactical control.

Record local run summaries: seed and balance version, active duration, casts/hits, time spent charge-starved, kills by source/type, tower damage by source, level-up times, chosen upgrades, peak enemies/minions, and ending score. Keep this local; no service is needed.

Use deterministic checks at 20, 30, 60, and 120 updates per second for collision damage, attack ordering, spawn counts, and score within defined timing tolerances. Compare cast-heavy, summon-heavy, and defensive builds using the same seeds, including missed shots and delayed reactions. Check that an early mistake remains recoverable, that passive summons alone do not survive indefinitely, and that crowded late runs stay readable and performant. Use human playtests to judge aiming, pressure, and fun; scripted outcomes only establish a reproducible baseline.

The first review should answer three questions: Are misses recoverable? Do specialist enemies change target priority? Does each upgrade path produce a different useful way to survive? If those work, tune run length and late-game difficulty around them.
