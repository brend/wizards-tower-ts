import { loadImage } from "./assets";

export class Entity {

  frameCount: number;
  x: number;
  y: number;
  w: number;
  h: number;
  // Velocity in logical pixels per second.
  vx: number;
  vy: number;
  ready: boolean;
  frame: number;
  frameTime: number;
  frameDuration: number;
  image: HTMLImageElement | null;
  afterUpdateBehaviors: Array<(dt: number, e: Entity) => void>;

  hp: number | undefined;
  maxHp: number | undefined;
  strength: number | undefined;

  constructor(spritesheet: string, frameCount: number = 1) {
    if (frameCount < 1) throw new Error("frame count must be positive");

    this.frameCount = frameCount;
    this.x = 0;
    this.y = 0;
    this.w = 16;
    this.h = 16;
    this.vx = 0;
    this.vy = 0;
    this.ready = false;
    this.frame = 0;
    this.frameTime = 0;
    const animationFps = 7;
    this.frameDuration = 1.0 / animationFps;

    this.image = null;
    this.ready = false;

    this.afterUpdateBehaviors = [];

    loadImage(spritesheet)
      .then((image) => {
        this.image = image;
        this.ready = true;
      })
      .catch((error) => console.error(error));
  }

  get width(): number {
    if (!this.ready) return NaN;
    return this.image!.width;
  }

  get height(): number {
    if (!this.ready) return NaN;
    return this.image!.height;
  }

  render(context: CanvasRenderingContext2D) {
    if (!context) throw new Error("argument 'context' is required");
    if (!this.ready) return;
    const frameWidth = this.image!.width / this.frameCount;
    const frameHeight = this.image!.height;
    const frameX = this.frame * frameWidth;
    const frameY = 0;
    context.drawImage(
      this.image!,
      // source rectangle
      frameX,
      frameY,
      frameWidth,
      frameHeight,
      // destination rectangle
      this.x,
      this.y,
      frameWidth,
      frameHeight,
    );

    if (this.hp !== undefined && this.maxHp !== undefined) {
      context.lineWidth = 0.5;
      context.strokeStyle = "red";
      context.strokeRect(this.x, this.y + 16, 16, 4);
      if (this.hp > 0) {
        context.fillStyle = "red";
        context.fillRect(this.x, this.y + 16, 16 * (this.hp / this.maxHp), 4);
      }
    }
  }

  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.frameTime += dt;

    while (this.frameTime >= this.frameDuration) {
      this.frameTime -= this.frameDuration;
      this.frame = (this.frame + 1) % this.frameCount;
    }

    for (const action of this.afterUpdateBehaviors) {
      action(dt, this);
    }
  }

  intersectsWith(other: Entity) {
    return !(
      other.x > this.x + this.w ||
      other.x + other.w < this.x ||
      other.y > this.y + this.h ||
      other.y + other.h < this.y
    );
  }
}
