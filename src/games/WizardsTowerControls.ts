import { Engine } from "../engine/Engine";
import { VoicePlayer } from "../engine/VoicePlayer";
import { WizardsTowerScene } from "./WizardsTowerScene";

export function bindWizardsTowerControls(
  engine: Engine,
  scene: WizardsTowerScene,
  voices: VoicePlayer,
): () => void {
  const button = (id: string): HTMLButtonElement => {
    const element = document.getElementById(id);
    if (!(element instanceof HTMLButtonElement))
      throw new Error(`Missing button: ${id}`);
    return element;
  };

  const start = button("start-button");
  const pause = button("pause-button");
  const resume = button("resume-button");
  const sound = button("sound-button");

  const startScreen = document.getElementById("start-screen");
  if (!startScreen) throw new Error("Missing start screen");

  const updateSoundButton = () => {
    sound.textContent = voices.ready ? "Mute sound" : "Enable sound";
    sound.setAttribute("aria-pressed", String(voices.ready));
  };

  const onStart = async () => {
    if (start.disabled) return;

    start.disabled = true;
    start.textContent = "Starting…";

    try {
      // Must be invoked directly from the user gesture.
      await voices.enable();
    } catch (error) {
      console.warn("Could not enable sound:", error);
    } finally {
      scene.begin();
      engine.start();

      startScreen.hidden = true;
      pause.disabled = false;
      resume.disabled = false;
      sound.disabled = false;
      updateSoundButton();
      pause.focus();
    }
  };

  const onPause = () => engine.stop();
  const onResume = () => engine.start();

  const onSound = async () => {
    if (voices.ready) {
      voices.disable();
      return;
    }

    sound.disabled = true;
    try {
      if (await voices.enable()) scene.onAudioEnabled();
    } catch (error) {
      console.warn("Could not enable sound:", error);
    } finally {
      sound.disabled = false;
      updateSoundButton();
    }
  };

  const previousSoundHandler = voices.onStateChange;
  const onSoundStateChange = () => {
    previousSoundHandler();
    updateSoundButton();
  };

  voices.onStateChange = onSoundStateChange;

  start.addEventListener("click", onStart);
  pause.addEventListener("click", onPause);
  resume.addEventListener("click", onResume);
  sound.addEventListener("click", onSound);

  updateSoundButton();

  return () => {
    start.removeEventListener("click", onStart);
    pause.removeEventListener("click", onPause);
    resume.removeEventListener("click", onResume);
    sound.removeEventListener("click", onSound);

    if (voices.onStateChange === onSoundStateChange)
      voices.onStateChange = previousSoundHandler;
  };
}
