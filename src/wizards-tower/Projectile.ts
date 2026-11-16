export interface MovingBox {
  x: number;
  y: number;
  previousX: number;
  previousY: number;
  w: number;
  h: number;
}

/** Segment versus expanded AABB in relative motion; returns earliest contact [0, 1]. */
export function sweptContact(a: MovingBox, b: MovingBox): number | null {
  const origin = [a.previousX - b.previousX, a.previousY - b.previousY];
  const delta = [
    a.x - a.previousX - (b.x - b.previousX),
    a.y - a.previousY - (b.y - b.previousY),
  ];
  const low = [-a.w, -a.h];
  const high = [b.w, b.h];
  let enter = 0,
    leave = 1;
  for (let axis = 0; axis < 2; axis++) {
    if (Math.abs(delta[axis]) < 1e-12) {
      if (origin[axis] < low[axis] || origin[axis] > high[axis]) return null;
    } else {
      const first = (low[axis] - origin[axis]) / delta[axis];
      const second = (high[axis] - origin[axis]) / delta[axis];
      enter = Math.max(enter, Math.min(first, second));
      leave = Math.min(leave, Math.max(first, second));
      if (enter > leave) return null;
    }
  }
  return enter;
}

export class Projectile implements MovingBox {
  previousX: number;
  previousY: number;
  w = 8;
  h = 8;
  hitIds = new Set<number>();
  hitCount = 0;
  constructor(
    public x: number,
    public y: number,
    public vx: number,
    public vy: number,
    public mode: "normal" | "splash" | "pierce" = "normal",
  ) {
    this.previousX = x;
    this.previousY = y;
  }
  update(dt: number): void {
    this.previousX = this.x;
    this.previousY = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
}
