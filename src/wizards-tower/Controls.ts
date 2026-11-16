import type { Engine } from "@waldrumpus/orb";
import { formatTime, type WizardsTowerScene } from "./Scene.js";
import type { VoicePlayer } from "@waldrumpus/orb";

export function bindWizardsTowerControls(
  engine: Engine,
  scene: WizardsTowerScene,
  voices: VoicePlayer,
): () => void {
  const element = <T extends HTMLElement>(id: string): T => {
    const found = document.getElementById(id);
    if (!found) throw new Error(`Missing control: ${id}`);
    return found as T;
  };
  const start = element<HTMLButtonElement>("start-button");
  const pause = element<HTMLButtonElement>("pause-button");
  const resume = element<HTMLButtonElement>("resume-button");
  const sound = element<HTMLButtonElement>("sound-button");
  const restart = element<HTMLButtonElement>("restart-button");
  const retry = element<HTMLButtonElement>("retry-button");
  const startScreen = element("start-screen");
  const upgradeScreen = element("upgrade-screen");
  const resultScreen = element("result-screen");
  const pauseScreen = element("pause-screen");
  const upgradeCards = element("upgrade-cards");
  const abort = new AbortController();
  const listen = (target: EventTarget, type: string, fn: EventListener) =>
    target.addEventListener(type, fn, { signal: abort.signal });
  let shownOffer: unknown;
  const updateSoundButton = () => {
    sound.textContent = voices.ready ? "Mute sound" : "Enable sound";
    sound.setAttribute("aria-pressed", String(Boolean(voices.ready)));
  };
  const sync = () => {
    const game = scene.game;
    const playing = game.phase === "playing";
    startScreen.hidden = game.phase !== "ready";
    upgradeScreen.hidden = game.phase !== "levelup";
    resultScreen.hidden = game.phase !== "gameover";
    pauseScreen.hidden = engine.isRunning || !playing;
    pause.disabled = !engine.isRunning || !playing;
    resume.disabled = engine.isRunning || !playing;
    sound.disabled = game.phase === "ready";
    if (game.phase === "levelup" && shownOffer !== game.offers) {
      shownOffer = game.offers;
      element("upgrade-heading").textContent =
        `Choose your level ${game.build.level + 1} upgrade`;
      upgradeCards.replaceChildren(
        ...game.offers.map((offer, i) => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = `upgrade-card path-${offer.path.toLowerCase()}`;
          const path = document.createElement("span");
          path.className = "card-path";
          path.textContent = `${i + 1} · ${offer.path}`;
          // The original cards identify the upgrade family; the text identifies its specific effect.
          const art = document.createElement("img");
          art.className = "upgrade-card-art";
          art.src = `assets/Upgrade-${offer.path}.png`;
          art.alt = ""; // The adjacent path label already names the family.
          art.width = art.height = 24;
          art.draggable = false;
          const title = document.createElement("strong");
          title.textContent = offer.title;
          const description = document.createElement("span");
          description.className = "card-description";
          description.textContent = offer.description;
          const rank = document.createElement("small");
          rank.textContent = offer.rank;
          button.append(path, art, title, description, rank);
          button.addEventListener("click", () => {
            if (!engine.isRunning) return;
            game.chooseUpgrade(offer.id);
            if (scene.game.phase === "playing") engine.viewport.focus();
          });
          return button;
        }),
      );
      upgradeScreen.scrollTop = 0;
      upgradeCards.querySelector("button")?.focus({ preventScroll: true });
    }
    if (game.phase === "gameover") {
      element("result-score").textContent = String(game.score);
      element("result-details").textContent =
        `Survived ${formatTime(game.time)} · Best ${scene.bestScore} · Level ${game.build.level}`;
      element("result-kills").textContent = Object.entries(game.stats.kills)
        .map(([kind, count]) => `${kind}: ${count}`)
        .join(" · ");
      element("result-build").textContent = game.stats.upgrades.length
        ? game.stats.upgrades.map((upgrade) => upgrade.title).join(" → ")
        : "No upgrades earned this run.";
      element("result-seed").textContent = `Run seed ${game.seed} · Endless v1`;
      restart.focus({ preventScroll: true });
    }
  };
  const previousSceneHandler = scene.onStateChange;
  scene.onStateChange = sync;
  listen(start, "click", async () => {
    if (start.disabled) return;
    start.disabled = true;
    start.textContent = "Starting…";
    try {
      await voices.enable();
    } catch (error) {
      console.warn("Could not enable sound:", error);
    } finally {
      engine.start();
      scene.begin();
      sync();
      updateSoundButton();
      engine.viewport.focus();
    }
  });
  listen(pause, "click", () => {
    engine.stop();
    voices.stop();
    sync();
    resume.focus();
  });
  listen(resume, "click", () => {
    engine.start();
    sync();
    engine.viewport.focus();
  });
  listen(sound, "click", async () => {
    if (voices.ready) {
      voices.disable();
      updateSoundButton();
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
  });
  const newRun = (sameSeed: boolean) => {
    engine.start();
    scene.restart(sameSeed);
    sync();
    engine.viewport.focus();
  };
  listen(restart, "click", () => newRun(false));
  listen(retry, "click", () => newRun(true));
  listen(document, "keydown", (event) => {
    const key = event as KeyboardEvent;
    if (key.repeat || key.altKey || key.ctrlKey || key.metaKey) return;
    const modal = !upgradeScreen.hidden
      ? upgradeScreen
      : !resultScreen.hidden
        ? resultScreen
        : null;
    if (key.key === "Tab" && modal) {
      const targets = [
        ...modal.querySelectorAll<HTMLElement>("button, summary"),
      ];
      const first = targets[0],
        last = targets.at(-1);
      if (
        key.shiftKey &&
        (document.activeElement === first ||
          !modal.contains(document.activeElement))
      ) {
        key.preventDefault();
        last?.focus();
      } else if (
        !key.shiftKey &&
        (document.activeElement === last ||
          !modal.contains(document.activeElement))
      ) {
        key.preventDefault();
        first?.focus();
      }
      return;
    }
    if (
      scene.game.phase === "levelup" &&
      engine.isRunning &&
      /^[123]$/.test(key.key)
    ) {
      const offer = scene.game.offers[Number(key.key) - 1];
      if (offer) {
        key.preventDefault();
        scene.game.chooseUpgrade(offer.id);
        if (!upgradeScreen.hidden) return;
        engine.viewport.focus();
      }
    } else if (key.key === "Escape" && scene.game.phase === "playing") {
      if (engine.isRunning) {
        engine.stop();
        voices.stop();
      } else engine.start();
      sync();
    }
  });
  listen(document, "visibilitychange", () => {
    if (document.hidden && scene.game.phase === "playing") {
      engine.stop();
      voices.stop();
      sync();
    }
  });
  const previousSoundHandler = voices.onStateChange;
  voices.onStateChange = () => {
    previousSoundHandler();
    updateSoundButton();
  };
  engine.viewport.tabIndex = 0;
  updateSoundButton();
  sync();
  return () => {
    abort.abort();
    voices.onStateChange = previousSoundHandler;
    scene.onStateChange = previousSceneHandler;
  };
}
