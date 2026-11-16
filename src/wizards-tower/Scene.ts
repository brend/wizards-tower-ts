import { Entity } from "../core/Entity";
import { Scene } from "../engine/Scene";
import { createGrayscaleImage } from "../utils/utils.canvas";
import { VoicePlayer } from "../engine/VoicePlayer";
import { Projectile } from "../core/Projectile";
import { Enemy, Minion, Tower, Upgrade } from "./Entities";
import { Timer } from "../core/Timer";

type GamePhase = "ready" | "playing" | "levelup" | "gameover";

export class WizardsTowerScene implements Scene {
  private phase: GamePhase = "ready";
  private readonly enemies = new Set<Enemy>();
  private readonly minions = new Set<Minion>();
  private readonly projectiles = new Set<Projectile>();
  private readonly background = new Set<Entity>();
  private readonly effects = new Set<Entity>();
  private spawnTimer = 3.0;
  private spawnCount = 0;
  private readonly fireballTimer = new Timer(3);
  private minionTimer: Timer | undefined;
  private readonly hudFireball = new Entity("assets/Fireball.png", 2);
  private hudFireballGray: HTMLCanvasElement | undefined;
  private readonly hudGameOver = new Entity("assets/Itisover.png");
  private readonly tower = new Tower("assets/Tower.png");
  private readonly wizard = new Entity("assets/Wizard.png", 4);
  private readonly groundY = 120;
  private upgrades: Upgrade[];
  private xp = 0;
  width: number;
  height: number;
  voices: VoicePlayer;

  constructor(width: number, height: number, voices: VoicePlayer) {
    this.width = width;
    this.height = height;
    this.voices = voices;

    this.hudFireball.x = 300 - 6 + 2;
    this.hudFireball.y = 40 + 2;
    this.tower.x = (width - 32) / 2;
    this.tower.y = 16;
    this.tower.onDamaged = (amount) => this.showTowerDamage(amount);
    this.wizard.x = this.tower.x + 8;
    this.wizard.y = this.tower.y + 8;

    this.upgrades = [];

    this.background.add(this.wizard);
    this.background.add(this.tower);

    for (let i = 0; i < Math.ceil(width / 16); ++i) {
      const grass = new Entity("assets/Ground-1.png");
      grass.x = 16 * i;
      grass.y = this.groundY;
      this.background.add(grass);
    }

    for (let y = this.groundY + 16; y < height; y += 16) {
      for (let i = 0; i < Math.ceil(width / 16); ++i) {
        const soil = new Entity("assets/Ground-2.png");
        soil.x = 16 * i;
        soil.y = y;
        this.background.add(soil);
      }
    }
  }

  update(dt: number): void {
    if (this.phase === "levelup") return;

    this.updateVisuals(dt);

    if (this.phase !== "playing") return;

    this.updateTimers(dt);
    this.spawnEnemies();
    this.spawnMinions();
    this.updateCombatants(dt);
    this.handleCollisions();
    this.updateCombat(dt);
    this.cleanupCorpses();

    if (this.tower.hp <= 0) {
      this.phase = "gameover";
      this.playVoice("itsover");
    } else if (this.xp >= 3) {
      this.phase = "levelup";
      this.generateUpgrades();
    }
  }

  private generateUpgrades(): void {
    const u1 = new Upgrade("fireball", "assets/Upgrade-Fireball.png");
    u1.x = 102;
    u1.y = 60;
    const u2 = new Upgrade("skeleton", "assets/Upgrade-Skeleton.png");
    u2.x = 152;
    u2.y = 60;
    const u3 = new Upgrade("tower", "assets/Upgrade-Tower.png");
    u3.x = 202;
    u3.y = 60;
    this.upgrades = [u1, u2, u3];
  }

  private chooseUpgrade(upgrade: Upgrade): void {
    switch (upgrade.kind) {
      case "fireball":
        this.fireballTimer = new Timer(this.fireballTimer.interval * 0.9);
        break;
      case "skeleton":
        if (!this.minionTimer) {
          this.minionTimer = new Timer(6);
        } else {
          this.minionTimer = new Timer(this.minionTimer.interval * 0.9);
        }
        break;
      case "tower":
        this.tower.takeDamage(-1);
        break;
    }
    this.xp = 0;
    this.phase = "playing";
  }

  private updateTimers(dt: number): void {
    this.spawnTimer -= dt;
    this.fireballTimer.advance(dt);
    if (this.minionTimer) {
      this.minionTimer.advance(dt);
    }
  }

  private updateVisuals(dt: number): void {
    for (const p of this.projectiles) {
      p.update(dt);
      if (p.x < -8 || p.x > this.width || p.y < -8 || p.y > this.height) {
        this.projectiles.delete(p);
      }
    }

    for (const b of this.background) {
      b.update(dt);
    }

    for (const e of this.effects) {
      e.update(dt);

      if (
        e.x < -8 ||
        e.x > this.width + 8 ||
        e.y < -8 ||
        e.y > this.height + 8
      ) {
        console.log("gotta remove this thing");
        this.effects.delete(e);
      }
    }
  }

  private updateCombatants(dt: number): void {
    for (const m of this.minions) {
      m.update(dt);
    }

    for (const e of this.enemies) {
      e.update(dt);
    }
  }

  private spawnEnemies(): void {
    while (this.spawnTimer <= 0) {
      this.spawnOrk();
      this.spawnTimer += 3.0;
    }
  }

  private spawnMinions(): void {
    if (!(this.minionTimer && this.minionTimer.isOver)) return;
    this.spawnMinion();
    this.minionTimer.reset();
  }

  private spawnOrk(): void {
    const ork = new Enemy("assets/Ork.png", 2);
    ork.x = 0;
    ork.y = this.groundY - 14;

    this.enemies.add(ork);

    if (this.spawnCount === 0) {
      this.playVoice("hold");
    }

    this.spawnCount += 1;
  }

  private spawnMinion(): void {
    const minion = new Minion("assets/Skeleton.png", 2);
    minion.x = this.tower.x;
    minion.y = this.groundY - 14;
    this.minions.add(minion);
    this.playVoice("minion");
  }

  private handleCollisions() {
    this.handleProjectileCollisions();
    this.handleCombatTargetSelection();
  }

  private handleCombatTargetSelection(): void {
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;

      for (const m of this.minions) {
        if (m.hp <= 0 || !e.intersectsWith(m)) continue;

        if (!e.target || e.target === this.tower) {
          e.setTarget(m);
        }

        if (!m.target) {
          m.setTarget(e);
        }
      }
    }

    for (const e of this.enemies) {
      if (e.hp <= 0 || e.target) continue;
      if (e.x >= this.tower.x - 8) {
        e.setTarget(this.tower);
      }
    }
  }

  private handleProjectileCollisions(): void {
    for (const a of this.projectiles) {
      for (const b of this.enemies) {
        if (!a.intersectsWith(b)) continue;
        b.takeDamage(a.strength);
      }
    }
  }

  private updateCombat(dt: number): void {
    for (const e of this.enemies) {
      e.updateCombat(dt);
    }
    for (const m of this.minions) {
      m.updateCombat(dt);
    }
  }

  private cleanupCorpses(): void {
    for (const e of this.enemies) {
      if (e.hp <= 0) {
        this.enemies.delete(e);
        this.xp += 1;
      } else if (e.target && e.target.hp <= 0) {
        e.setTarget(null);
      }
    }
    for (const m of this.minions) {
      if (m.hp <= 0) {
        this.minions.delete(m);
      } else if (m.target && m.target.hp <= 0) {
        m.setTarget(null);
      }
    }
  }

  private showTowerDamage(amount: number): void {
    const effect = new Entity("assets/Ouch.png");
    effect.x = this.wizard.x + 4;
    effect.y = this.wizard.y - 16;
    effect.vx = Math.random() * 24 - 12;
    effect.vy = -50;
    this.effects.add(effect);
    this.tower.y += amount * 8;
    this.wizard.y += amount * 8;
  }

  private spawnFireball(destX: number, destY: number): boolean {
    const fireball = new Projectile("assets/Fireball.png", 2);
    fireball.x = this.wizard.x + 8;
    fireball.y = this.wizard.y;
    fireball.w = 8;
    fireball.h = 8;
    const dx = destX - fireball.x - fireball.w / 2;
    const dy = destY - fireball.y - fireball.h / 2;
    const len = Math.hypot(dx, dy);
    if (len === 0 || !Number.isFinite(len)) return false;

    fireball.vx = 200 * (dx / len);
    fireball.vy = 200 * (dy / len);
    this.projectiles.add(fireball);
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
    for (const b of this.background) {
      b.render(ctx);
    }
  }

  private renderEntities(ctx: CanvasRenderingContext2D): void {
    for (const e of this.enemies) {
      e.render(ctx);
    }

    for (const m of this.minions) {
      m.render(ctx);
    }

    for (const p of this.projectiles) {
      p.render(ctx);
    }

    for (const e of this.effects) {
      e.render(ctx);
    }
  }

  private renderHud(ctx: CanvasRenderingContext2D): void {
    switch (this.phase) {
      case "playing":
        this.renderInGameHud(ctx);
        break;
      case "levelup":
        this.renderLevelUpHud(ctx);
        break;
      case "gameover":
        this.renderGameOverHud(ctx);
        break;
    }
  }

  private renderLevelUpHud(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, this.width, this.height);

    for (const upgrade of this.upgrades) {
      upgrade.render(ctx);
    }
  }

  private renderGameOverHud(ctx: CanvasRenderingContext2D): void {
    // Render game over message
    if (this.phase === "gameover" && this.hudGameOver.ready) {
      this.hudGameOver.render(ctx);
    }
  }

  private renderInGameHud(ctx: CanvasRenderingContext2D): void {
    const { hudFireball, fireballTimer } = this;
    if (!hudFireball.ready) return;

    const hudX = hudFireball.x;
    const hudY = hudFireball.y;

    const remaining = Math.min(1, Math.max(0, fireballTimer.remainingFraction));
    if (remaining === 0) {
      hudFireball.render(ctx);
    } else {
      this.hudFireballGray ??= createGrayscaleImage(hudFireball.image!);
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
      drawSector(this.hudFireballGray!, sweepAngle, endAngle);
    }

    // Render mana gauge
    this.drawText(ctx, String(this.xp), hudX, hudY + 20);
  }

  drawText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
  ): void {
    ctx.font = "8px sans-serif";
    ctx.fillStyle = "rgb(177, 177, 41)";
    ctx.fillText(text, x, y);
  }

  onPointerDown?(x: number, y: number): void {
    switch (this.phase) {
      case "playing":
        const timer = this.fireballTimer;
        if (!timer.isOver) return;
        if (this.spawnFireball(x, y)) timer.reset();
        break;
      case "levelup":
        for (const u of this.upgrades) {
          if (u.contains(x, y)) {
            this.chooseUpgrade(u);
            break;
          }
        }
        break;
    }
  }

  begin(): void {
    if (this.phase !== "ready") return;

    this.phase = "playing";
    this.playVoice("welcome");
  }

  onAudioEnabled(): void {
    if (this.spawnCount > 0) this.playVoice("hold");
  }
}
