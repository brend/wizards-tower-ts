// Resume one shared context from a click, then play game events through it.
export class VoicePlayer {

  clips: Record<string, string>;
  volume: number;
  context: AudioContext | null;
  current: AudioBufferSourceNode | null;
  enabled: boolean;
  requestId: number;
  onStateChange: () => void;
  output: GainNode | null;
  buffers: Map<string, Promise<AudioBuffer>>;

  constructor(clips: Record<string, string>, volume: number = 0.6) {
    this.clips = clips;
    this.volume = volume;
    this.context = null;
    this.buffers = new Map();
    this.enabled = false;
    this.current = null;
    this.requestId = 0;
    this.output = null;
    this.onStateChange = () => {};
  }

  get ready() {
    return this.enabled && this.context?.state === "running";
  }

  // Call directly inside the click handler, before awaiting any other work.
  async enable() {
    if (!this.context) {
      this.context = new AudioContext();
      this.output = this.context.createGain();
      this.output.gain.value = this.volume;
      this.output.connect(this.context.destination);
      this.context.onstatechange = () => this.onStateChange();
    }
    await this.context.resume();
    this.enabled = this.context.state === "running";
    this.onStateChange();
    return this.ready;
  }

  stop() {
    // Also cancel a clip that is still downloading or decoding.
    this.requestId += 1;
    if (this.current) {
      this.current.stop();
      this.current = null;
    }
  }

  disable() {
    this.enabled = false;
    this.stop();
    this.onStateChange();
  }

  load(name: string): Promise<AudioBuffer> | undefined {
    if (!this.context) return;

    if (!this.buffers.has(name)) {
      const pending = (async () => {
        const response = await fetch(this.clips[name]);
        if (!response.ok) {
          throw new Error(`Failed to load voice ${name}: HTTP ${response.status}`);
        }
        return this.context!.decodeAudioData(await response.arrayBuffer());
      })().catch((error) => {
        this.buffers.delete(name); // A later event can retry a failed download.
        throw error;
      });
      this.buffers.set(name, pending);
    }
    return this.buffers.get(name);
  }

  async play(name: string): Promise<boolean> {
    // Do not queue old game events while sound is locked, muted, or suspended.
    if (!this.ready || !Object.hasOwn(this.clips, name)) return false;
    this.stop();
    const requestId = this.requestId;
    const buffer = await this.load(name);
    if (!this.ready || !this.context || !this.output || requestId !== this.requestId) return false;    
    const source = this.context.createBufferSource();
    source.buffer = buffer ?? null;
    source.connect(this.output);
    source.onended = () => {
      source.disconnect();
      if (this.current === source) this.current = null;
    };
    source.start();
    this.current = source;
    return true;
  }
}
