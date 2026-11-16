import { Engine } from "./engine/Engine.js";
import { WizardsTowerScene } from "./wizards-tower/Scene.js";
import { bindWizardsTowerControls } from "./wizards-tower/Controls.js";
import { VoicePlayer } from "./engine/VoicePlayer.js";

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

(window as any).game = engine;
