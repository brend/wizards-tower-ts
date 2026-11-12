import { Engine } from "./engine/Engine";
import { WizardsTowerScene } from "./games/WizardsTowerScene";
import { bindWizardsTowerControls } from "./games/WizardsTowerControls";
import { VoicePlayer } from "./engine/VoicePlayer";

const voices = new VoicePlayer({
  welcome: "assets/audio/wizard/cartridge/welcome.wav",
  hurt: "assets/audio/wizard/cartridge/hurt.wav",
  spell: "assets/audio/wizard/cartridge/spell.wav",
  victory: "assets/audio/wizard/cartridge/victory.wav",
  hold: "assets/audio/wizard/cartridge/hold.wav",
  itsover: "assets/audio/wizard/cartridge/itsover.wav",
});
const scene = new WizardsTowerScene(320, 180, voices);
const engine = new Engine(320, 180, scene, true, "Wizard's Tower", 5);

bindWizardsTowerControls(engine, scene, voices);

(window as any).game = engine;
