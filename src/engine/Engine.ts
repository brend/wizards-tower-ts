import { generateCanvas } from "../utils/utils.canvas";
import { Scene } from "./Scene";

export class Engine {
  constants: { width: number; height: number; showFps: boolean; zoom: number };
  frameId: number | null;
  previousTime: number | null;
  sampleTime: number;
  sampleFrames: number;
  fps: number;
  viewport: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  scene: Scene;
  isRunning = false;

  constructor(
    width: number,
    height: number,
    scene: Scene,
    showFps = true,
    title = "My Game",
    zoom = 1,
  ) {
    this.constants = { width, height, showFps, zoom };
    this.frameId = null;
    this.previousTime = null;
    this.sampleTime = 0;
    this.sampleFrames = 0;
    this.fps = 0;
    this.scene = scene;

    this.viewport = generateCanvas(width, height, zoom);
    this.viewport.id = "gameViewport";
    this.viewport.setAttribute("aria-label", title);
    const context = this.viewport.getContext("2d");
    if (!context) throw Error("Could not create rendering context");
    this.context = context;
    const container = document.getElementById("container");
    if (!container) throw Error("Could not find HTML element 'container'");
    container.style.setProperty("--scene-aspect", String(width / height));
    container.appendChild(this.viewport);

    this.viewport.addEventListener("click", this.handleClick);
  }

  private handleClick = (event: MouseEvent) => {
    if (!this.isRunning) return;

    const rect = this.viewport.getBoundingClientRect();

    if (rect.width === 0 || rect.height === 0) return;

    const x = ((event.clientX - rect.left) * this.constants.width) / rect.width;
    const y =
      ((event.clientY - rect.top) * this.constants.height) / rect.height;

    this.scene.onPointerDown?.(x, y);
  };

  private frame = (timestamp: number) => {
    this.frameId = requestAnimationFrame(this.frame);

    const seconds =
      this.previousTime === null
        ? 0
        : (timestamp - this.previousTime) / 1000;

    this.previousTime = timestamp;

    // Measure actual frame time, independently of the simulation's stall cap.
    if (seconds > 0) {
      this.sampleTime += seconds;
      this.sampleFrames += 1;
      if (this.sampleTime >= 0.5) {
        this.fps = Math.round(this.sampleFrames / this.sampleTime);
        this.sampleTime = 0;
        this.sampleFrames = 0;
      }
    }

    this.scene.update(Math.min(seconds, 0.05));
    this.render();
  };

  start(): void {
    if (this.frameId !== null) return;
    this.previousTime = null;
    this.sampleTime = 0;
    this.sampleFrames = 0;
    this.fps = 0;
    this.frameId = requestAnimationFrame(this.frame);
    this.isRunning = true;
  }

  stop() {
    if (this.frameId === null) return;
    cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.previousTime = null;
    this.isRunning = false;
  }

  private render(): void {
    const ctx = this.context;

    ctx.fillStyle = "#172036";
    ctx.fillRect(0, 0, this.constants.width, this.constants.height);

    this.scene.render(ctx);

    if (this.constants.showFps) {
      ctx.font = "6px monospace";
      ctx.fillStyle = "#facc15";
      ctx.fillText(`${this.fps} FPS`, this.constants.width - 32, 10);
    }
  }
}
