export class Timer {

  interval: number;
  remaining: number;

  constructor(interval: number) {
    const n = Number(interval);
    if (isNaN(n)) throw new Error("Timer interval must be a number");
    this.interval = n;
    this.remaining = n;
  }

  advance(dt: number) {
    this.remaining -= dt;
  }

  get isOver(): boolean {
    return this.remaining <= 0;
  }

  get remainingFraction(): number {
    const f = this.remaining / this.interval;
    return f < 0 ? 0 : f;
  }

  reset() {
    this.remaining = this.interval;
  }
}
