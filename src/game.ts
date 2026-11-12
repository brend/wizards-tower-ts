import { createGrayscaleImage, generateCanvas } from "./utils/utils.canvas";
import { Entity } from "./core/entity";
import { LinearAnimation } from "./core/animation";
import { VoicePlayer } from "./core/voice";
import { attackTower, TowerEvent } from "./core/events";
import { Timer } from "./core/timer";

export interface GameState {
  phase: string;
  elapsed: number;
  enemies: Set<Entity>;
  projectiles: Set<Entity>;
  background: Set<Entity>;
  wizard: Entity;
  tower: Entity;
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

export class Game {
  constants: { width: number; height: number; showFps: boolean; zoom: number };
  frameId: number | null;
  previousTime: number | null;
  sampleTime: number;
  sampleFrames: number;
  fps: number;
  viewport: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
  voices: VoicePlayer;
  state: GameState;

  constructor(
    width: number,
    height: number,
    initialize: (width: number, height: number) => GameState,
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
    // Keep the Game instance as `this` when the browser invokes the callback.
    this.frame = this.frame.bind(this);

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

    this.voices = this.loadVoices();
    this.state = initialize(width, height);
    this.hookupControls();
  }

  loadVoices(): VoicePlayer {
    return new VoicePlayer({
      welcome: "assets/audio/wizard/cartridge/welcome.wav",
      hurt: "assets/audio/wizard/cartridge/hurt.wav",
      spell: "assets/audio/wizard/cartridge/spell.wav",
      victory: "assets/audio/wizard/cartridge/victory.wav",
      hold: "assets/audio/wizard/cartridge/hold.wav",
      itsover: "assets/audio/wizard/cartridge/itsover.wav",
    });
  }

  hookupControls() {
    function ge(id: string): any {
      const element = document.getElementById(id);
      if (!element) throw new Error(`Could not find HTML element '${id}'`);
      return element;
    }

    const startButton = ge("start-button");
    if (!startButton)
      throw new Error("Could not find HTML element 'start-button'");
    startButton.addEventListener("click", async () => {
      if (this.state.phase !== "ready" || startButton.disabled) return;
      startButton.disabled = true;
      startButton.textContent = "Starting…";
      try {
        // Unlock audio directly in the user gesture, before any other await.
        if (await this.voices?.enable()) this.playVoice("welcome");
      } catch (error) {
        console.warn("Could not enable game sound:", error);
      } finally {
        // Audio failure should still allow play; the sound button can retry.
        ge("start-screen").hidden = true;
        this.state.phase = "paused";
        this.start();
        ge("pause-button").disabled = false;
        ge("resume-button").disabled = false;
        soundButton.disabled = false;
        this.voices.onStateChange();
        ge("pause-button").focus();
      }
    });

    ge("pause-button").addEventListener("click", () => {
      this.stop();
    });

    ge("resume-button").addEventListener("click", () => {
      this.start();
    });

    const soundButton = ge("sound-button");
    this.voices.onStateChange = () => {
      soundButton.textContent = this.voices.ready
        ? "Mute sound"
        : "Enable sound";
      soundButton.setAttribute("aria-pressed", String(this.voices.ready));
    };
    soundButton.addEventListener("click", async () => {
      if (this.voices.ready) {
        this.voices.disable();
        return;
      }
      soundButton.disabled = true;
      try {
        // resume() runs immediately in this click, not in a timer or game frame.
        if (await this.voices.enable()) {
          // If the first ork already arrived silently, greet the player now.
          if (this.state.spawnCount > 0) this.playVoice("hold");
        }
      } catch (error) {
        console.warn("Could not enable game sound:", error);
      } finally {
        soundButton.disabled = false;
        this.voices.onStateChange();
      }
    });

    this.viewport.addEventListener("click", (event) => {
      if (this.frameId === null) return; // Ignore clicks while paused.

      if (!this.state.fireballTimer.isOver) {
        return;
      }

      const rect = this.viewport.getBoundingClientRect();
      const x =
        ((event.clientX - rect.left) * this.constants.width) / rect.width;
      const y =
        ((event.clientY - rect.top) * this.constants.height) / rect.height;

      this.spawnFireball(this.state, x, y);
      this.state.fireballTimer.reset();
    });
  }

  start() {
    if (this.state.phase === "ready" || this.frameId !== null) return;
    this.previousTime = null;
    this.sampleTime = 0;
    this.sampleFrames = 0;
    this.fps = 0;
    this.frameId = window.requestAnimationFrame(this.frame);
    this.state.phase = "playing";
  }

  stop() {
    if (this.state.phase === "ready") return;
    window.cancelAnimationFrame(this.frameId!);
    this.frameId = null;
    this.previousTime = null;
    this.state.phase = "paused";
  }

  // Render at the display's refresh rate; update receives elapsed seconds.
  frame(timestamp: number) {
    // Queue first so stop() can cancel the next frame even during an update.
    this.frameId = window.requestAnimationFrame(this.frame);
    const seconds =
      this.previousTime === null ? 0 : (timestamp - this.previousTime) / 1000;
    this.previousTime = timestamp;

    if (seconds > 0) {
      this.sampleTime += seconds;
      this.sampleFrames += 1;
      if (this.sampleTime >= 0.5) {
        this.fps = Math.round(this.sampleFrames / this.sampleTime);
        this.sampleTime = 0;
        this.sampleFrames = 0;
      }
    }

    // Discard excess time after a stall or a background-tab pause.
    this.update(Math.min(seconds, 0.05));
    this.render();
  }

  update(dt: number) {
    const state = this.state;

    // dt is seconds, so animation speed does not depend on refresh rate.
    state.elapsed += dt;

    const originalTowerY = state.tower.y;

    // update timers
    state.fireballTimer.advance(dt);

    // spawn orcs
    state.spawnTimer -= dt;
    while (state.spawnTimer <= 0) {
      this.spawnOrk(state);
      state.spawnTimer += 3.0;
    }

    // update entities
    for (const enemy of state.enemies) {
      enemy.update(dt);
    }

    for (const projectile of state.projectiles) {
      projectile.update(dt);
    }

    for (const object of state.background) {
      object.update(dt);
    }

    // check for collisions
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

    // process events, e.g. attacks
    while (state.events.length > 0) {
      const e = state.events.shift();
      if (e) {
        this.processEvent(e);
      }
    }

    // update animations
    const completed = [];
    for (const animation of this.state.animations) {
      animation.update(dt);
      if (animation.done) {
        completed.push(animation);
      }
    }
    for (const animation of this.state.animations) {
      if (animation.done) {
        this.state.animations.delete(animation);
      }
    }
    for (const animation of completed) {
      animation.onComplete?.();
    }

    // play a sound when the tower falls
    const fallenY = state.groundY - 14;
    if (originalTowerY < fallenY && state.tower.y >= fallenY) {
      this.playVoice("itsover");
      this.state.phase = "gameover";
    }
  }

  render() {
    const { width, height, showFps } = this.constants;
    const context = this.context;

    context.fillStyle = "#172036";
    context.fillRect(0, 0, width, height);

    if (showFps) {
      context.font = "6px monospace";
      context.fillStyle = "#facc15";
      context.fillText(`${this.fps} FPS`, width - 32, 10);
    }

    context.save();

    for (const background of this.state.background) {
      context.save();
      background.render(context);
      context.restore();
    }

    for (const entity of this.state.enemies) {
      context.save();
      entity.render(context);
      context.restore();
    }

    for (const projectile of this.state.projectiles) {
      context.save();
      projectile.render(context);
      context.restore();
    }

    this.renderHud(context);

    context.restore();
  }

  renderHud(context: CanvasRenderingContext2D) {
    const { hudFireball, fireballTimer } = this.state;
    if (!hudFireball.ready) return;

    const remaining = Math.min(1, Math.max(0, fireballTimer.remainingFraction));
    if (remaining === 0) {
      hudFireball.render(context);
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
        context.save();
        context.beginPath();
        context.moveTo(centerX, centerY);
        context.arc(centerX, centerY, radius, from, to);
        context.closePath();
        context.clip();
        context.drawImage(
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
        context.restore();
      };

      // Reveal color clockwise from twelve o'clock as the cooldown expires.
      if (remaining < 1) {
        drawSector(hudFireball.image!, startAngle, sweepAngle);
      }
      drawSector(this.state.hudFireballGray!, sweepAngle, endAngle);
    }

    // Render game over message
    if (this.state.phase === "gameover" && this.state.hudGameOver.ready) {
      this.state.hudGameOver.render(context);
    }
  }

  addAnimation(animation: LinearAnimation) {
    this.state.animations.add(animation);
  }

  processEvent(e: TowerEvent) {
    switch (e.type) {
      case "attackTower":
        (this.state.tower as { hp: number }).hp -= e.strength;
        this.state.tower.y += e.strength * 8;
        this.state.wizard.y += e.strength * 8;

        const effect = new Entity("assets/Ouch.png");
        effect.x = this.state.tower.x - 4;
        effect.y = this.state.groundY - 30;
        effect.vx = Math.random() * 0.4 - 0.2;
        this.state.background.add(effect);
        const animation = new LinearAnimation(effect, -8, -64, 2.0);
        animation.onComplete = () => this.state.background.delete(effect);
        this.addAnimation(animation);
    }
  }

  spawnOrk(state: GameState) {
    const ork: any = new Entity("assets/Ork.png", 2);
    ork.x = 0;
    ork.y = state.groundY - 14;
    ork.vx = 0.5;
    ork.targetX = state.tower.x - 8 + 8 * Math.random() - 4;
    ork.attackInterval = 1;
    ork.attackStrength = 1;
    ork.timeSinceLastAttack = 0;
    ork.hp = 10;
    ork.maxHp = 10;

    ork.afterUpdateBehaviors.push((_dt: number, entity: any) => {
      if (entity.x >= entity.targetX && entity.vx !== 0) {
        entity.vx = 0;
        entity.timeSinceLastAttack = 0;
      }
    });
    ork.afterUpdateBehaviors.push((dt: number, entity: any) => {
      if (entity.x >= entity.targetX) {
        entity.timeSinceLastAttack += dt;
        while (entity.timeSinceLastAttack >= entity.attackInterval) {
          state.events.push(attackTower(entity.attackStrength));
          entity.timeSinceLastAttack -= entity.attackInterval;
        }
      }
    });
    state.enemies.add(ork);

    if (state.spawnCount === 0) {
      this.playVoice("hold");
    }

    state.spawnCount += 1;
  }

  spawnFireball(state: GameState, destX: number, destY: number) {
    const fireball = new Entity("assets/Fireball.png");
    fireball.x = state.wizard.x + 8;
    fireball.y = state.wizard.y;
    fireball.w = 8;
    fireball.h = 8;
    const dx = destX - fireball.x - fireball.w / 2;
    const dy = destY - fireball.y - fireball.h / 2;
    const len = dx * dx + dy * dy;
    fireball.vx = 200 * (dx / len);
    fireball.vy = 200 * (dy / len);
    fireball.strength = 1;
    state.projectiles.add(fireball);
    this.playVoice("spell");
  }

  playVoice(name: string) {
    this.voices.play(name).catch((error) => {
      console.warn(`Could not play wizard voice "${name}":`, error);
    });
  }
}
