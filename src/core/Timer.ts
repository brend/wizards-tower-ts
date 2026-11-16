export class Timer {
  remaining: number;
  constructor(public interval: number) {
    if (!(interval > 0) || !Number.isFinite(interval)) throw new Error('Timer interval must be positive');
    this.remaining = interval;
  }
  advance(dt: number): void { this.remaining -= dt; }
  get isOver(): boolean { return this.remaining <= 1e-9; }
  get remainingFraction(): number { return Math.min(1, Math.max(0, this.remaining / this.interval)); }
  reset(): void { this.remaining = this.interval; }
  complete(): void { this.remaining = 0; }
  setInterval(interval: number): void {
    if (!(interval > 0) || !Number.isFinite(interval)) throw new Error('Timer interval must be positive');
    const fraction = this.remainingFraction;
    this.interval = interval;
    this.remaining = fraction * interval;
  }
}

/** Sequential charges: spending another charge never restarts an active recharge. */
export class ChargePool {
  charges: number;
  timer: Timer;
  bonus = 0;
  constructor(public capacity: number, interval: number) {
    this.charges = capacity;
    this.timer = new Timer(interval);
  }
  get available(): number { return this.charges + this.bonus; }
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
    if (this.bonus > 0) { this.bonus--; return true; }
    if (this.charges === 0) return false;
    this.charges--;
    return true;
  }
  addSlot(): void { this.capacity++; this.charges++; }
}
