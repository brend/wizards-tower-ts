import { LinearAnimation } from "../core/animation";
import { Entity } from "../core/entity";
import { attackTower, TowerEvent } from "./WizardsTowerEvents";
import { Scene } from "../engine/Scene";
import { Timer } from "../core/timer";
import { createGrayscaleImage } from "../utils/utils.canvas";
import { VoicePlayer } from "../engine/VoicePlayer";
import { Enemy } from "../core/Enemy";
import { Projectile } from "../core/Projectile";
import { Tower } from "./WizardsTowerEntities";

interface GameState {
  phase: "ready" | "playing" | "gameover";
  elapsed: number;
  enemies: Set<Enemy>;
  projectiles: Set<Projectile>;
  background: Set<Entity>;
  wizard: Entity;
  tower: Tower;
  events: TowerEvent[];
  animations: Set<LinearAnimation>;
  spawnTimer: number;
  spawnCount: number;
  fireballTimer: Timer;
  hudFireball: Entity;
  hudFireballGray: HTMLCanvasElement | undefined;
  hudGameOver: Entity;
  groundY: number;
}

export class WizardsTowerScene implements Scene {
  state: GameState;
  width: number;
  height: number;
  voices: VoicePlayer;

  constructor(width: number, height: number, voices: VoicePlayer) {
    this.state = initialize(width, height);
    this.width = width;
    this.height = height;
    this.voices = voices;
  }

  update(dt: number): void {
    const phaseEnteringUpdate = this.state.phase;

    this.updateTimers(dt);
    this.spawnEnemies(dt);
    this.updateEntities(dt);
    this.handleCollisions();
    this.processEvents();
    this.updateAnimations(dt);
    this.checkGameOver();

    if (phaseEnteringUpdate !== "gameover" && this.state.phase === "gameover") {
      this.playVoice("itsover");
    }
  }

  private updateTimers(dt: number): void {
    if (this.state.phase !== "playing") return;

    this.state.spawnTimer -= dt;
    this.state.fireballTimer.advance(dt);
  }

  private updateEntities(dt: number): void {
    const state = this.state;

    for (const p of state.projectiles) {
      p.update(dt);
      if (p.y > state.groundY) {
        state.projectiles.delete(p);
      }
    }

    for (const b of state.background) {
      b.update(dt);
    }

    if (state.phase !== "playing") return;

    for (const e of state.enemies) {
      e.update(dt);
    }
  }

  private updateAnimations(dt: number): void {
    const done = [];

    for (const a of this.state.animations) {
      a.update(dt);

      if (a.done) {
        done.push(a);
      }
    }

    for (const a of done) {
      a.onComplete?.();
      this.state.animations.delete(a);
    }
  }

  private checkGameOver(): void {
    if (this.state.phase !== "playing") return;

    const fallenY = this.state.groundY - 14;

    if (this.state.tower.y >= fallenY) {
      this.state.phase = "gameover";
    }
  }

  private spawnEnemies(_dt: number): void {
    if (this.state.phase !== "playing") return;

    while (this.state.spawnTimer <= 0) {
      this.spawnOrk();
      this.state.spawnTimer += 3.0;
    }
  }

  private spawnOrk(): void {
    const state = this.state;
    const ork = new Enemy("assets/Ork.png", 2);
    ork.x = 0;
    ork.y = state.groundY - 14;
    ork.vx = 30;
    ork.targetX = state.tower.x - 8 + 8 * Math.random() - 4;
    ork.onAttack = (strength) => {
      state.events.push(attackTower(strength));
    };

    state.enemies.add(ork);

    if (state.spawnCount === 0) {
      this.playVoice("hold");
    }

    state.spawnCount += 1;
  }

  private handleCollisions() {
    const state = this.state;

    if (state.phase !== "playing") return;

    for (const a of state.projectiles) {
      for (const b of state.enemies) {
        if (b.hp === undefined || a.strength === undefined) continue;
        if (!a.intersectsWith(b)) continue;
        b.hp -= a.strength;
      }
    }

    for (const enemy of state.enemies) {
      if (enemy.hp !== undefined && enemy.hp <= 0) {
        state.enemies.delete(enemy);
      }
    }
  }

  private processEvents() {
    if (this.state.phase !== "playing") return;

    while (this.state.events.length > 0) {
      const e = this.state.events.shift();
      if (e) {
        this.processEvent(e);
      }
    }
  }

  private processEvent(e: TowerEvent) {
    switch (e.type) {
      case "attackTower":
        this.state.tower.hp -= e.strength;
        this.state.tower.y += e.strength * 8;
        this.state.wizard.y += e.strength * 8;

        const effect = new Entity("assets/Ouch.png");
        effect.x = this.state.tower.x - 4;
        effect.y = this.state.groundY - 30;
        effect.vx = Math.random() * 24 - 12;
        this.state.background.add(effect);
        const animation = new LinearAnimation(effect, -8, -64, 2.0);
        animation.onComplete = () => this.state.background.delete(effect);
        this.state.animations.add(animation);
    }
  }

  private spawnFireball(destX: number, destY: number): boolean {
    const fireball = new Projectile("assets/Fireball.png");
    fireball.x = this.state.wizard.x + 8;
    fireball.y = this.state.wizard.y;
    fireball.w = 8;
    fireball.h = 8;
    const dx = destX - fireball.x - fireball.w / 2;
    const dy = destY - fireball.y - fireball.h / 2;
    const len = Math.hypot(dx, dy);
    if (len === 0 || !Number.isFinite(len)) return false;

    fireball.vx = 200 * (dx / len);
    fireball.vy = 200 * (dy / len);
    this.state.projectiles.add(fireball);
    this.playVoice("spell");
    return true;
  }

  playVoice(name: string): void {
    this.voices.play(name).catch((error: unknown) => {
      console.warn(`Could not play wizard voice "${name}":`, error);
    });
  }

  render(ctx: CanvasRenderingContext2D): void {
    this.renderBackground(ctx);
    this.renderEntities(ctx);
    this.renderHud(ctx);
  }

  private renderBackground(ctx: CanvasRenderingContext2D): void {
    for (const b of this.state.background) {
      b.render(ctx);
    }
  }

  private renderEntities(ctx: CanvasRenderingContext2D): void {
    for (const e of this.state.enemies) {
      e.render(ctx);
    }

    for (const p of this.state.projectiles) {
      p.render(ctx);
    }
  }

  private renderHud(ctx: CanvasRenderingContext2D): void {
    const { hudFireball, fireballTimer } = this.state;
    if (!hudFireball.ready) return;

    const remaining = Math.min(1, Math.max(0, fireballTimer.remainingFraction));
    if (remaining === 0) {
      hudFireball.render(ctx);
    } else {
      this.state.hudFireballGray ??= createGrayscaleImage(hudFireball.image!);
      const width = hudFireball.width / hudFireball.frameCount;
      const height = hudFireball.height;
      const centerX = hudFireball.x + width / 2;
      const centerY = hudFireball.y + height / 2;
      // Extend the sector past the corners of the rectangular sprite.
      const radius = Math.hypot(width, height) / 2 + 1;
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + Math.PI * 2;
      const sweepAngle = startAngle + Math.PI * 2 * (1 - remaining);

      const drawSector = (
        image: CanvasImageSource,
        from: number,
        to: number,
      ) => {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, from, to);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(
          image,
          hudFireball.frame * width,
          0,
          width,
          height,
          hudFireball.x,
          hudFireball.y,
          width,
          height,
        );
        ctx.restore();
      };

      // Reveal color clockwise from twelve o'clock as the cooldown expires.
      if (remaining < 1) {
        drawSector(hudFireball.image!, startAngle, sweepAngle);
      }
      drawSector(this.state.hudFireballGray!, sweepAngle, endAngle);
    }

    // Render game over message
    if (this.state.phase === "gameover" && this.state.hudGameOver.ready) {
      this.state.hudGameOver.render(ctx);
    }
  }

  onPointerDown?(x: number, y: number): void {
    if (this.state.phase !== "playing") return;

    const timer = this.state.fireballTimer;

    if (!timer.isOver) return;

    if (this.spawnFireball(x, y)) timer.reset();
  }

  begin(): void {
    if (this.state.phase !== "ready") return;

    this.state.phase = "playing";
    this.playVoice("welcome");
  }

  onAudioEnabled(): void {
    if (this.state.spawnCount > 0) this.playVoice("hold");
  }
}

function initialize(width: number, height: number): GameState {
  const hudFireball = new Entity("assets/Fireball.png");
  hudFireball.x = 160 - 6 + 2;
  hudFireball.y = 120 + 2;
  const hudGameOver = new Entity("assets/Itisover.png");
  const tower = new Tower("assets/Tower.png");
  tower.x = (width - 32) / 2;
  tower.y = (height - 128) / 2;
  const wizard = new Entity("assets/Wizard.png", 4);
  wizard.x = tower.x + 8;
  wizard.y = tower.y + 8;

  const state = {
    phase: "ready" as "ready" | "playing" | "gameover",
    elapsed: 0,
    enemies: new Set<Enemy>(),
    projectiles: new Set<Projectile>(),
    background: new Set<Entity>(),
    events: [],
    animations: new Set<LinearAnimation>(),
    spawnTimer: 3.0,
    spawnCount: 0,
    fireballTimer: new Timer(5),
    hudFireball,
    hudFireballGray: undefined,
    hudGameOver,
    wizard,
    tower,
    groundY: tower.y + 78,
  };

  state.background.add(wizard);
  state.background.add(tower);

  for (let i = 0; i < Math.ceil(width / 16); ++i) {
    const grass = new Entity("assets/Ground-1.png");
    grass.x = 16 * i;
    grass.y = state.groundY;
    state.background.add(grass);
  }

  for (let y = state.groundY + 16; y < height; y += 16) {
    for (let i = 0; i < Math.ceil(width / 16); ++i) {
      const soil = new Entity("assets/Ground-2.png");
      soil.x = 16 * i;
      soil.y = y;
      state.background.add(soil);
    }
  }

  return state;
}
