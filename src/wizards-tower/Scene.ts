import { Entity } from '../core/Entity.js';
import type { Scene } from '../engine/Scene.js';
import type { VoicePlayer } from '../engine/VoicePlayer.js';
import { BALANCE } from './Balance.js';
import { Game, type GameEvent } from './Game.js';
import type { Combatant } from './Entities.js';
import { readHistory, saveRun } from './RunHistory.js';

export function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

export class WizardsTowerScene implements Scene {
  game: Game;
  bestScore = readHistory().best;
  onStateChange?: () => void;
  private notice = '';
  private noticeUntil = 0;
  private feedback = '';
  private feedbackUntil = 0;
  private readonly sprites = {
    tower: new Entity('assets/Tower.png'), wizard: new Entity('assets/Wizard.png', 4),
    ork: new Entity('assets/Ork.png', 2), runner: new Entity('assets/Ork.png', 2),
    brute: new Entity('assets/Ork.png', 2), gargoyle: new Entity('assets/Gargoyle.png', 2),
    skeleton: new Entity('assets/Skeleton.png', 2), fireball: new Entity('assets/Fireball.png', 2),
    grass: new Entity('assets/Ground-1.png'), soil: new Entity('assets/Ground-2.png'),
  };
  constructor(public width: number, public height: number, public voices: VoicePlayer) {
    this.game = this.createGame();
  }
  private createGame(seed = crypto.getRandomValues(new Uint32Array(1))[0]): Game {
    const game = new Game(seed);
    game.onEvent = event => this.handleEvent(event);
    return game;
  }
  restart(sameSeed = false): void {
    const seed = sameSeed ? this.game.seed : undefined;
    this.voices.stop();
    this.notice = this.feedback = '';
    this.noticeUntil = this.feedbackUntil = 0;
    this.game = this.createGame(seed);
    this.game.begin();
    this.onStateChange?.();
  }
  begin(): void { this.game.begin(); }
  onPointerDown(x: number, y: number): void { this.game.cast(x, y); }
  update(dt: number): void {
    this.game.update(dt);
    if (this.game.phase === 'playing') for (const sprite of Object.values(this.sprites)) sprite.update(dt);
  }
  private handleEvent(event: GameEvent): void {
    const voices: Partial<Record<GameEvent, string>> = { start: 'welcome', cast: 'spell', summon: 'minion', gameover: 'itsover' };
    if (voices[event]) this.playVoice(voices[event]!);
    if (event === 'damage' || event === 'heal' || event === 'blocked') {
      this.feedback = event === 'damage' ? 'Tower hit!' : event === 'heal' ? 'Repaired' : 'Ward blocked a hit';
      this.feedbackUntil = this.game.time + 1;
    }
    if (event === 'upgrade') { this.notice = 'Upgrade gained'; this.noticeUntil = this.game.time + 1.5; }
    if (event === 'gameover') this.bestScore = Math.max(this.bestScore, saveRun(this.game.stats));
    if (['start', 'levelup', 'upgrade', 'gameover'].includes(event)) this.onStateChange?.();
  }
  playVoice(name: string): void {
    this.voices.play(name).catch((error: unknown) => console.warn(`Could not play wizard voice "${name}":`, error));
  }
  onAudioEnabled(): void { if (this.game.phase === 'playing') this.playVoice('hold'); }
  private sprite(ctx: CanvasRenderingContext2D, name: keyof WizardsTowerScene['sprites'], x: number, y: number, w?: number, h?: number): void {
    const sprite = this.sprites[name];
    if (!sprite.ready) return;
    const fw = sprite.width / sprite.frameCount;
    ctx.drawImage(sprite.image!, sprite.frame * fw, 0, fw, sprite.height, x, y, w ?? fw, h ?? sprite.height);
  }
  private actor(ctx: CanvasRenderingContext2D, actor: Combatant): void {
    this.sprite(ctx, actor.kind, actor.x, actor.y, actor.w, actor.h);
    if (actor.kind === 'runner') {
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(actor.x + 3, actor.y + 1, 9, 2);
      ctx.fillRect(actor.x - 4, actor.y + 8, 4, 1);
    }
    if (actor.kind === 'brute') {
      ctx.fillStyle = '#c6cfdd';
      ctx.fillRect(actor.x + 1, actor.y + 5, 5, 5);
      ctx.fillRect(actor.x + 14, actor.y + 5, 5, 5);
    }
    if (actor.eliteTier) {
      ctx.fillStyle = '#ffe08a';
      ctx.fillRect(actor.x + 5, actor.y - 3, 14, 3);
      this.text(ctx, `E${actor.eliteTier}`, actor.x + 5, actor.y - 5, '#ffe08a');
    }
    ctx.fillStyle = '#1a1826';
    ctx.fillRect(actor.x, actor.y + actor.h + 1, actor.w, 2);
    ctx.fillStyle = actor.kind === 'skeleton' ? '#7ee8ba' : '#f08670';
    ctx.fillRect(actor.x, actor.y + actor.h + 1, actor.w * actor.hp / actor.maxHp, 2);
  }
  render(ctx: CanvasRenderingContext2D): void {
    for (let x = 0; x < this.width; x += 16) {
      this.sprite(ctx, 'grass', x, BALANCE.groundY);
      for (let y = BALANCE.groundY + 16; y < this.height; y += 16) this.sprite(ctx, 'soil', x, y);
    }
    this.sprite(ctx, 'tower', BALANCE.towerX, this.game.build.tower.y);
    this.sprite(ctx, 'wizard', BALANCE.towerX + 8, this.game.wizardY);
    if (this.game.build.tower.wardReady || this.game.build.tower.temporaryWard > 0) {
      ctx.strokeStyle = '#80dff3'; ctx.lineWidth = 1;
      ctx.strokeRect(BALANCE.towerX - 2, this.game.build.tower.y - 1, 36, BALANCE.groundY - this.game.build.tower.y + 1);
    }
    for (const actor of [...this.game.enemies, ...this.game.minions]) this.actor(ctx, actor);
    for (const p of this.game.projectiles) this.sprite(ctx, 'fireball', p.x, p.y, p.w, p.h);
    this.renderHud(ctx);
  }
  private text(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = '#f1e6cc'): void {
    ctx.font = '7px monospace'; ctx.fillStyle = color; ctx.fillText(text, x, y);
  }
  private renderHud(ctx: CanvasRenderingContext2D): void {
    const { build } = this.game;
    ctx.fillStyle = '#0d1426'; ctx.fillRect(0, 0, 320, 17); ctx.fillRect(0, 138, 320, 42);
    this.text(ctx, `TOWER ${build.tower.hp}/${build.tower.maxHp}`, 5, 11);
    this.text(ctx, formatTime(this.game.time), 139, 11);
    this.text(ctx, `SCORE ${this.game.score}`, 219, 11);
    const warning = this.game.director.warning(this.game.time);
    const message = warning || (this.game.time < this.noticeUntil ? this.notice : '');
    if (message) {
      ctx.textAlign = 'right'; this.text(ctx, message, 315, 29, '#ffe08a'); ctx.textAlign = 'left';
    }
    if (this.game.time < this.feedbackUntil) {
      ctx.textAlign = 'center'; this.text(ctx, this.feedback, 160, 133, '#9de4df'); ctx.textAlign = 'left';
    }
    this.text(ctx, 'FIREBALL', 5, 150);
    for (let i = 0; i < build.fireball.capacity; i++) {
      ctx.fillStyle = i < build.fireball.charges ? '#ffb45d' : '#36415b';
      ctx.fillRect(49 + i * 9, 144, 6, 7);
    }
    if (build.fireball.bonus) this.text(ctx, '+1', 81, 150, '#ffb45d');
    ctx.fillStyle = '#36415b'; ctx.fillRect(5, 155, 72, 3);
    ctx.fillStyle = '#ffb45d'; ctx.fillRect(5, 155, 72 * (build.fireball.charges === build.fireball.capacity ? 1 : 1 - build.fireball.timer.remainingFraction), 3);
    this.text(ctx, build.fireball.charges === build.fireball.capacity ? 'Ready' : `${build.fireball.timer.remaining.toFixed(1)}s`, 5, 170);
    this.text(ctx, `LV ${build.level}  XP ${build.xp}/${build.xpRequired}`, 103, 150);
    ctx.fillStyle = '#36415b'; ctx.fillRect(103, 155, 94, 3);
    ctx.fillStyle = '#aa99ed'; ctx.fillRect(103, 155, 94 * Math.min(1, build.xp / build.xpRequired), 3);
    this.text(ctx, `BEST ${this.bestScore}`, 103, 170, '#b5bfd5');
    this.text(ctx, `SUMMONS ${this.game.minions.length}/${build.summonTimer ? build.skeletonCap : 0}`, 219, 150);
    const ward = build.tower.temporaryWard > 0 ? 'Bonus ward ready' : build.tower.wardReady ? 'Ward ready' : build.tower.wardUnlocked ? `Ward ${Math.ceil(build.tower.wardRemaining)}s` : 'Ward locked';
    this.text(ctx, ward, 219, 161, '#9de4df');
    this.text(ctx, build.summonTimer ? `Summon ${Math.max(0, build.summonTimer.remaining).toFixed(1)}s` : 'Choose Raise Skeleton', 219, 172, '#b5bfd5');
  }
}
