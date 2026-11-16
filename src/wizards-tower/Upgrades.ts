import { Timer } from "@waldrumpus/orb";
import { ChargePool } from "./ChargePool.js";
import { BALANCE, Random } from "./Balance.js";
import { Tower } from "./Entities.js";

export type UpgradeId =
  | "casting"
  | "reserve"
  | "splash"
  | "pierce"
  | "skeleton"
  | "ritual"
  | "bones"
  | "legion"
  | "fortify"
  | "ward"
  | "repair"
  | "surge"
  | "rally"
  | "barrier";
export type UpgradePath = "Fireball" | "Skeleton" | "Tower";
export interface UpgradeChoice {
  id: UpgradeId;
  path: UpgradePath;
  title: string;
  description: string;
  rank: string;
}

export class Build {
  readonly fireball = new ChargePool(
    BALANCE.fireball.charges,
    BALANCE.fireball.recharge,
  );
  readonly tower = new Tower();
  readonly ranks: Partial<Record<UpgradeId, number>> = {};
  summonTimer: Timer | null = null;
  skeletonHp: number = BALANCE.skeleton.hp;
  skeletonCap: number = BALANCE.skeleton.cap;
  specialization: "normal" | "splash" | "pierce" = "normal";
  rallyRemaining = 0;
  level = 1;
  xp = 0;
  private random: Random;
  constructor(seed: number) {
    this.random = new Random(seed ^ 0xa531);
  }
  rank(id: UpgradeId): number {
    return this.ranks[id] ?? 0;
  }
  get fullyUpgraded(): boolean {
    return (
      this.rank("casting") === 3 &&
      this.rank("reserve") === 1 &&
      this.specialization !== "normal" &&
      this.rank("skeleton") === 1 &&
      this.rank("ritual") === 2 &&
      this.rank("bones") === 2 &&
      this.rank("legion") === 1 &&
      this.rank("fortify") === 2 &&
      this.rank("ward") === 1
    );
  }
  get xpRequired(): number {
    return this.fullyUpgraded
      ? 30
      : BALANCE.xpCosts[Math.min(this.level - 1, 3)];
  }
  get canLevelUp(): boolean {
    return this.xp >= this.xpRequired;
  }
  offers(): UpgradeChoice[] {
    const choice = (
      id: UpgradeId,
      path: UpgradePath,
      title: string,
      description: string,
      max: number,
    ): UpgradeChoice => ({
      id,
      path,
      title,
      description,
      rank: max ? `Rank ${this.rank(id) + 1} / ${max}` : "One-run boon",
    });
    const fire: UpgradeChoice[] = [];
    const skeleton: UpgradeChoice[] = [];
    const tower: UpgradeChoice[] = [];
    if (this.rank("casting") < 3)
      fire.push(
        choice(
          "casting",
          "Fireball",
          "Quick Casting",
          `Recharge ${this.fireball.timer.interval.toFixed(2)}s → ${(this.fireball.timer.interval * 0.9).toFixed(2)}s. Keep current progress.`,
          3,
        ),
      );
    if (!this.rank("reserve"))
      fire.push(
        choice(
          "reserve",
          "Fireball",
          "Deep Reserve",
          "Store 2 → 3 charges. The new charge starts ready.",
          1,
        ),
      );
    if (this.specialization === "normal") {
      fire.push(
        choice(
          "splash",
          "Fireball",
          "Bursting Flame",
          "Impact splashes nearby foes for 1 damage (24px). Locks out piercing.",
          1,
        ),
      );
      fire.push(
        choice(
          "pierce",
          "Fireball",
          "Searing Lance",
          "Each fireball hits two foes for 2 damage each. Locks out splash.",
          1,
        ),
      );
    }
    if (!fire.length)
      fire.push(
        choice(
          "surge",
          "Fireball",
          "Arcane Surge",
          "Refill charges and gain one bonus shot. Bonus shots do not stack.",
          0,
        ),
      );
    if (!this.summonTimer)
      skeleton.push(
        choice(
          "skeleton",
          "Skeleton",
          "Raise Skeleton",
          "Summon now, then every 8s. 3 HP, 1 damage / 2s. Up to 2 active.",
          1,
        ),
      );
    else {
      if (this.rank("ritual") < 2)
        skeleton.push(
          choice(
            "ritual",
            "Skeleton",
            "Faster Ritual",
            `Summon every ${this.summonTimer.interval}s → ${this.summonTimer.interval - 1}s. Keep current progress.`,
            2,
          ),
        );
      if (this.rank("bones") < 2)
        skeleton.push(
          choice(
            "bones",
            "Skeleton",
            "Reinforced Bones",
            `Skeleton health ${this.skeletonHp} → ${this.skeletonHp + 1}. Living summons also gain 1 HP.`,
            2,
          ),
        );
      if (!this.rank("legion"))
        skeleton.push(
          choice(
            "legion",
            "Skeleton",
            "Legion",
            "Active skeleton limit 2 → 3. Summon a ready replacement immediately.",
            1,
          ),
        );
      if (!skeleton.length)
        skeleton.push(
          choice(
            "rally",
            "Skeleton",
            "Battle Rally",
            "Skeletons deal +1 damage for 20s. Duration refreshes; power does not stack.",
            0,
          ),
        );
    }
    if (this.rank("fortify") < 2)
      tower.push(
        choice(
          "fortify",
          "Tower",
          "Fortify",
          `Maximum HP ${this.tower.maxHp} → ${this.tower.maxHp + 2}, then repair up to 3 HP.`,
          2,
        ),
      );
    if (!this.rank("ward"))
      tower.push(
        choice(
          "ward",
          "Tower",
          "Protective Ward",
          "Block one tower hit now. Recharges 12s after absorbing a hit.",
          1,
        ),
      );
    if (this.tower.missingHp >= 3)
      tower.push(
        choice(
          "repair",
          "Tower",
          "Repair",
          `Restore 3 HP: ${this.tower.hp} → ${Math.min(this.tower.maxHp, this.tower.hp + 3)}.`,
          0,
        ),
      );
    if (!tower.length)
      tower.push(
        choice(
          "barrier",
          "Tower",
          "Borrowed Time",
          "Block one hit within the next 20s. Can coexist with Protective Ward.",
          0,
        ),
      );
    if (this.level === 1) return [fire[0], skeleton[0], tower[0]];
    return [
      this.random.pick(fire),
      this.random.pick(skeleton),
      this.random.pick(tower),
    ];
  }
  /** Only Game.chooseUpgrade may apply an offered card. Returns whether to summon now. */
  apply(id: UpgradeId): boolean {
    this.xp -= this.xpRequired;
    this.level++;
    this.ranks[id] = this.rank(id) + 1;
    switch (id) {
      case "casting":
        this.fireball.timer.setInterval(this.fireball.timer.interval * 0.9);
        break;
      case "reserve":
        this.fireball.addSlot();
        break;
      case "splash":
      case "pierce":
        this.specialization = id;
        break;
      case "skeleton":
        this.summonTimer = new Timer(BALANCE.skeleton.summonInterval);
        return true;
      case "ritual":
        this.summonTimer!.setInterval(this.summonTimer!.interval - 1);
        break;
      case "bones":
        this.skeletonHp++;
        break;
      case "legion":
        this.skeletonCap++;
        break;
      case "fortify":
        this.tower.maxHp += 2;
        this.tower.heal(3);
        break;
      case "ward":
        this.tower.wardUnlocked = true;
        this.tower.wardReady = true;
        break;
      case "repair":
        this.tower.heal(3);
        break;
      case "surge":
        this.fireball.charges = this.fireball.capacity;
        this.fireball.timer.reset();
        this.fireball.bonus = 1;
        break;
      case "rally":
        this.rallyRemaining = 20;
        break;
      case "barrier":
        this.tower.temporaryWard = 20;
        break;
    }
    return false;
  }
}
