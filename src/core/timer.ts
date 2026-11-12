export class Timer {
  interval: number;
  remaining: number;

  constructor(interval: number) {
    this.interval = interval;
    this.remaining = interval;
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

  reset(): void {
    this.remaining = this.interval;
  }

  complete(): void {
    this.remaining = 0;
  }
}
