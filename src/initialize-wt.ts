import { GameState } from "./game";
import { Entity } from "./core/entity";
import { LinearAnimation } from "./core/animation";
import { Timer } from "./core/timer";

export function initialize(width: number, height: number): GameState {
    const hudFireball = new Entity("assets/Fireball.png");
    hudFireball.x = 160 - 6 + 2;
    hudFireball.y = 120 + 2;
    const hudGameOver = new Entity("assets/Itisover.png");
    const tower = new Entity("assets/Tower.png");
    tower.x = (width - 32) / 2;
    tower.y = (height - 128) / 2;
    tower.hp = 10;
    const wizard = new Entity("assets/Wizard.png", 4);
    wizard.x = tower.x + 8;
    wizard.y = tower.y + 8;
    // Wizard's hp prevent him from being de-spawned :P
    wizard.hp = 1;

    const state = {
      phase : "ready",
      elapsed : 0,
      enemies : new Set<Entity>(),
      projectiles : new Set<Entity>(),
      background : new Set<Entity>(),
      events : [],
      animations : new Set<LinearAnimation>(),
      spawnTimer : 3.0,
      spawnCount : 0,
      fireballTimer : new Timer(5),
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
      grass.hp = 1;
      state.background.add(grass);
    }

    for (let y = state.groundY + 16; y < height; y += 16) {
      for (let i = 0; i < Math.ceil(width / 16); ++i) {
        const soil = new Entity("assets/Ground-2.png");
        soil.x = 16 * i;
        soil.y = y;
        soil.hp = 1;
        state.background.add(soil);
      }
    }
    
    return state;
  }