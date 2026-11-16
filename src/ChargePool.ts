import { Timer } from "@waldrumpus/orb";

/** Sequential charges: spending another charge never restarts an active recharge. */
export class ChargePool {
  charges: number;
  timer: Timer;
  bonus = 0;
  constructor(
    public capacity: number,
    interval: number,
  ) {
    this.charges = capacity;
    this.timer = new Timer(interval);
  }
  get available(): number {
    return this.charges + this.bonus;
  }
  advance(dt: number): void {
    if (this.charges >= this.capacity) return;
    this.timer.advance(dt);
    while (this.timer.isOver && this.charges < this.capacity) {
      this.charges++;
      this.timer.remaining += this.timer.interval;
    }
    if (this.charges === this.capacity) this.timer.reset();
  }
  spend(): boolean {
    if (this.bonus > 0) {
      this.bonus--;
      return true;
    }
    if (this.charges === 0) return false;
    this.charges--;
    return true;
  }
  addSlot(): void {
    this.capacity++;
    this.charges++;
  }
}
