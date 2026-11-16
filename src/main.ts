import { Engine } from "@waldrumpus/orb";
import { WizardsTowerScene } from "./Scene.js";
import { bindWizardsTowerControls } from "./Controls.js";
import { VoicePlayer } from "@waldrumpus/orb";

const voices = new VoicePlayer({
  welcome: "assets/audio/wizard/cartridge/welcome.wav",
  hurt: "assets/audio/wizard/cartridge/hurt.wav",
  spell: "assets/audio/wizard/cartridge/spell.wav",
  minion: "assets/audio/wizard/cartridge/minion.wav",
  victory: "assets/audio/wizard/cartridge/victory.wav",
  hold: "assets/audio/wizard/cartridge/hold.wav",
  itsover: "assets/audio/wizard/cartridge/itsover.wav",
});
const scene = new WizardsTowerScene(320, 180, voices);
const engine = new Engine(320, 180, scene, false, "Wizard's Tower", 5);

bindWizardsTowerControls(engine, scene, voices);

// Explicitly load the canvas font; CSS font-face declarations alone do not load it.
// The fallback keeps the game playable if a font request fails.
document.fonts.load('8px "Dogica Pixel"').catch((error: unknown) => {
  console.warn("Could not load the game font:", error);
});

(window as any).game = engine;
