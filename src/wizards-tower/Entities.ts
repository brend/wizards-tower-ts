import { Entity } from "../core/Entity";

type UpgradeKind = "fireball" | "skeleton" | "tower";

export class Upgrade extends Entity {
  kind: UpgradeKind;

  constructor(kind: UpgradeKind, spritesheet: string, frameCount = 1) {
    super(spritesheet, frameCount);
    this.kind = kind;
  }
}

type Team = "player" | "enemy";

interface Damageable {
  hp: number;
  takeDamage(amount: number): void;
}

export class Tower extends Entity implements Damageable {
  hp = 10;
  xp = 0;
  onDamaged?: (amount: number) => void;

  takeDamage(amount: number): void {
    if (this.hp <= 0 || amount <= 0) return;
    const damage = Math.min(amount, this.hp);
    this.hp -= damage;
    this.onDamaged?.(damage);
  }
}

class Combatant extends Entity implements Damageable {
  team: Team;
  moveSpeed: number;
  direction: 1 | -1;
  target: Damageable | null = null;
  hp: number;
  attackStrength: number;
  attackInterval: number;
  attackCooldown = 0;

  protected constructor(
    spritesheet: string,
    frameCount = 1,
    team: Team,
    moveSpeed: number,
    direction: 1 | -1,
    hp: number,
    attackStrength: number,
    attackInterval: number,
  ) {
    super(spritesheet, frameCount);
    this.team = team;
    this.moveSpeed = moveSpeed;
    this.direction = direction;
    this.hp = hp;
    this.attackStrength = attackStrength;
    this.attackInterval = attackInterval;
  }

  takeDamage(amount: number): void {
    this.hp -= amount;
  }

  setTarget(target: Damageable | null): void {
    if (target === this.target) return;
    this.target = target;
    this.attackCooldown = this.attackInterval;
  }

  update(dt: number): void {
    if (this.target && this.target.hp <= 0) {
      this.setTarget(null);
    }

    this.vx = this.hp > 0 && !this.target ? this.moveSpeed * this.direction : 0;

    super.update(dt);
  }

  updateCombat(dt: number): void {
    if (!this.target) return;
    if (this.hp <= 0 || this.target.hp <= 0) return;

    this.attackCooldown -= dt;
    if (this.attackCooldown <= 0) {
      this.target.takeDamage(this.attackStrength);
      this.attackCooldown = this.attackInterval;
    }
  }
}

export class Enemy extends Combatant {
  maxHp: number;
  showHp = true;

  constructor(spritesheet: string, frameCount = 1) {
    super(spritesheet, frameCount, "enemy", 30, 1, 2, 1, 2);
    this.maxHp = this.hp;
  }

  render(ctx: CanvasRenderingContext2D): void {
    super.render(ctx);

    if (this.showHp) {
      this.renderHpBar(ctx);
    }
  }

  private renderHpBar(ctx: CanvasRenderingContext2D): void {
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "red";
    ctx.strokeRect(this.x, this.y + 16, 16, 4);
    if (this.hp > 0) {
      ctx.fillStyle = "red";
      ctx.fillRect(this.x, this.y + 16, 16 * (this.hp / this.maxHp), 4);
    }
  }
}

export class Minion extends Combatant {
  constructor(spritesheet: string, frameCount = 1) {
    super(spritesheet, frameCount, "player", 26, -1, 2, 1, 2);
  }
}
