import { Entity } from "./entity";

export class Enemy extends Entity {
  onAttack?: (strength: number) => void;
  maxHp = 10;
  hp = 10;
  attackInterval = 1;
  attackStrength = 1;
  targetX = 800;
  timeSinceLastAttack = 0;
  showHp = true;

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

  update(dt: number): void {
    super.update(dt);
    this.stopIfTargetReached();
    this.attackIfItsTimeToAttack(dt);
  }

  private stopIfTargetReached(): void {
    if (this.x >= this.targetX && this.vx !== 0) {
      this.vx = 0;
      this.timeSinceLastAttack = 0;
    }
  }

  private attackIfItsTimeToAttack(dt: number): void {
    if (this.x >= this.targetX) {
      this.timeSinceLastAttack += dt;
      while (this.timeSinceLastAttack >= this.attackInterval) {
        this.onAttack?.(this.attackStrength);
        this.timeSinceLastAttack -= this.attackInterval;
      }
    }
  }
}
