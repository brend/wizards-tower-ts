export interface Animatable {
  x: number;
  y: number;
}

export class LinearAnimation {

  object: Animatable;
  dx: number;
  dy: number;
  duration: number;
  elapsed: number;
  onComplete: (() => void) | undefined;

  constructor(object: Animatable, dx: number, dy: number, duration: number) {
    this.object = object;
    this.dx = dx / duration;
    this.dy = dy / duration;
    this.duration = duration;
    this.elapsed = 0.0;
  }

  update(dt: number) {
    this.object.x += dt * this.dx;
    this.object.y += dt * this.dy;
    this.elapsed += dt;
  }

  get done() {
    return this.elapsed >= this.duration;
  }
}
