import { Game } from "./game";
import { initialize } from "./initialize-wt";

(window as any).game = new Game(320, 180, initialize, true, "Wizard's Tower", 5);
