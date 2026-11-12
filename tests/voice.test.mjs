import assert from "node:assert/strict";
import { afterEach, beforeEach, test } from "node:test";
import { VoicePlayer } from "../js/core/voice.js";

const originalFetch = globalThis.fetch;
const originalAudioContext = globalThis.AudioContext;
let contexts;
let downloads;

beforeEach(() => {
  contexts = [];
  downloads = [];
  globalThis.AudioContext = class {
    constructor() {
      this.state = "suspended";
      this.sources = [];
      this.resumeCalls = 0;
      contexts.push(this);
    }
    createGain() {
      return { gain: {}, connect() {} };
    }
    resume() {
      this.resumeCalls += 1;
      this.state = "running";
      return Promise.resolve();
    }
    decodeAudioData(data) {
      return Promise.resolve(data);
    }
    createBufferSource() {
      const source = {
        started: false, stopped: false,
        connect() {}, disconnect() {},
        start() { this.started = true; },
        stop() { this.stopped = true; },
      };
      this.sources.push(source);
      return source;
    }
  };
  globalThis.fetch = async (url) => {
    downloads.push(url);
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) };
  };
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.AudioContext = originalAudioContext;
});

const player = () => new VoicePlayer({ welcome: "welcome.wav", hurt: "hurt.wav" });

test("events before a gesture stay silent; resume runs synchronously on enable", async () => {
  const voice = player();
  assert.equal(await voice.play("welcome"), false);
  assert.equal(contexts.length, 0);
  assert.deepEqual(downloads, []);
  const enabling = voice.enable();
  assert.equal(contexts[0].resumeCalls, 1);
  assert.equal(await enabling, true);
  assert.equal(await voice.play("welcome"), true);
  assert.equal(contexts[0].sources[0].started, true);
});

test("later clips share the unlocked context, replace speech, and reuse buffers", async () => {
  const voice = player();
  await voice.enable();
  await voice.play("welcome");
  const first = contexts[0].sources[0];
  await voice.play("hurt");
  assert.equal(first.stopped, true);
  await voice.play("welcome");
  assert.equal(contexts.length, 1);
  assert.deepEqual(downloads, ["welcome.wav", "hurt.wav"]);
  voice.disable();
  assert.equal(contexts[0].sources.at(-1).stopped, true);
  assert.equal(await voice.play("hurt"), false);
});

test("muting during download prevents delayed playback", async () => {
  let finish;
  globalThis.fetch = () => new Promise(resolve => { finish = resolve; });
  const voice = player();
  await voice.enable();
  const pending = voice.play("welcome");
  voice.disable();
  finish({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
  assert.equal(await pending, false);
  assert.equal(contexts[0].sources.length, 0);
});

test("a slow older clip cannot interrupt a newer event", async () => {
  let finish;
  const fetchNow = globalThis.fetch;
  globalThis.fetch = url => url === "welcome.wav"
    ? new Promise(resolve => { finish = resolve; }) : fetchNow(url);
  const voice = player();
  await voice.enable();
  const older = voice.play("welcome");
  assert.equal(await voice.play("hurt"), true);
  finish({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) });
  assert.equal(await older, false);
  assert.equal(contexts[0].sources.length, 1);
});

test("suspension and denied resume keep events silent; another gesture can retry", async () => {
  const voice = player();
  await voice.enable();
  contexts[0].state = "suspended";
  assert.equal(await voice.play("welcome"), false);
  const resume = contexts[0].resume;
  contexts[0].resume = () => Promise.reject(new Error("NotAllowedError"));
  await assert.rejects(voice.enable(), /NotAllowedError/);
  assert.equal(voice.ready, false);
  contexts[0].resume = resume;
  await voice.enable();
  assert.equal(await voice.play("welcome"), true);
});

test("bad asset responses can be retried; unknown names are ignored", async () => {
  const voice = player();
  await voice.enable();
  const fetchNow = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: false, status: 404 });
  await assert.rejects(voice.play("welcome"), /HTTP 404/);
  globalThis.fetch = fetchNow;
  assert.equal(await voice.play("welcome"), true);
  assert.equal(await voice.play("missing"), false);
  assert.equal(await voice.play("toString"), false);
});
