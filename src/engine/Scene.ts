export interface Scene {
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D): void;
  onPointerDown?(x: number, y: number): void;
}
