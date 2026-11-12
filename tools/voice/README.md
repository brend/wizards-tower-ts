# Wizard voice workshop

Generate short, robotic wizard lines locally with Python 3.9+ and the classic
macOS `say` voices. No API keys, downloads, pip packages, or game build step.
An existing integer PCM WAV can also be processed on other operating systems.

From the repository root:

```sh
python3 tools/voice/generate.py
python3 -m http.server 8000 --bind 127.0.0.1
```

Open [the listening page](http://127.0.0.1:8000/assets/audio/wizard/).
It compares five lines across three presets, with playback, WAV downloads, and
links to the untreated source. Only one preview plays at a time. The generated
`index.html` also works directly from disk.

| Preset | Source | Treatment |
| --- | --- | --- |
| `spellbox` | Zarvox | Nasal robot, 8 kHz / 6-bit quantization |
| `cartridge` | Fred | 11.025 kHz, softened 7-bit delta DAC with output smoothing |
| `arcane` | Trinoids | Lower playback pitch, 8 kHz / 7-bit, short echo |

These are artistic approximations. `spellbox` does not implement the Speak &
Spell's LPC chip. `cartridge` approximates the +/-2 DAC steps described in the
[NESdev DMC reference](https://www.nesdev.org/wiki/APU_DMC), but exports decoded
WAV audio, not NES ROM data or a cycle-accurate chip emulation. Its sample rate
is a creative choice, not a hardware DMC clock setting.

## Create lines and variants

```sh
# Generate one line in every style, into a separate audition folder.
python3 tools/voice/generate.py --text "Begone, foul beast!" --name begone --output /tmp/wizard-begone

# Choose a style and adjust the source voice, speaking speed, and playback pitch.
python3 tools/voice/generate.py --text "By my beard!" --name beard --preset spellbox --voice Ralph --rate 150 --pitch 0.9 --output /tmp/wizard-beard

# List installed macOS voices.
say -v '?'

# Apply all treatments to a recording or a previously generated dry source.
python3 tools/voice/generate.py --input-wav assets/audio/wizard/sources/spellbox-hold.wav --name hold --output /tmp/wizard-comparison
```

Use the same `--input-wav` to compare processing alone: the defaults compare
both different source voices and different treatments. `--voice` and `--rate`
control speech synthesis only and have no effect with `--input-wav`. `--pitch`
changes pitch **and duration**, like playback speed; it is not time stretching.

Edit `tools/voice/lines.json` or pass `--lines path/to/lines.json` for a batch:

```json
[
  {"id": "fireball", "text": "Fireball!"},
  {"id": "low-mana", "text": "I need more mana."}
]
```

IDs must be unique lowercase letters/numbers separated by hyphens. Tweak
`presets.json` to change source voices, words per minute, pitch, bandwidth,
sample rate, bit depth, and echo. Use `--presets path/to/presets.json` for a
separate preset collection. The `bits` setting applies to PCM quantization;
when `dpcm` is true, the DAC always has 7-bit range.

For less buzzy cartridge speech, `dpcm_mix` blends the delta DAC with 7-bit PCM
(0 = PCM, 1 = full delta DAC; cartridge uses 0.65). `output_lowpass` smooths
the signal after the DAC and sample hold (cartridge uses 3200 Hz; 0 disables
it). The original cartridge treatment used `dpcm_mix: 1` and
`output_lowpass: 0`. Source voice, speaking rate, and pitch are unchanged.

## Outputs and reproducibility

The default destination is `assets/audio/wizard/`, resolved relative to the
repository even when invoked from another directory:

- `<preset>/<line-id>.wav`: mono 22,050 Hz, 16-bit PCM, ready for browser audio.
  The coarse retro quantization is baked into this standard WAV container.
- `sources/`: original dry WAVs for remixing without regenerating speech.
- `manifest.json`: text, IDs, paths, duration, all settings, source engine, and
  source SHA-256 for each clip.
- `index.html`: standalone listening page for this batch.

Generation stages the batch before publishing, so a synthesis failure leaves
existing assets untouched. A successful run replaces matching filenames and
the gallery/manifest; unrelated older WAVs remain on disk. Use a different
`--output` for auditions you want to keep separately. Given the same dry source
and settings, processing is deterministic; macOS voice output may differ by
OS/voice version. Input supports mono/stereo integer PCM WAV at 8, 16, 24 or
32 bits; floating-point/compressed WAV needs conversion first.

The processing trims outer silence, limits bandwidth, changes playback pitch,
reduces resolution, adds optional echo, removes DC, and fades the edges. Peak
level is capped at 0.85 (about -1.4 dBFS); this is peak normalization, not LUFS
loudness matching.

Some sandboxed runners let `say` exit successfully but write zero audio frames.
The generator detects this and fails with an actionable error; run it from a
normal macOS terminal or allow access to the local speech service. Missing
voices also fail explicitly; choose one listed by `say -v '?'`.

## Use in the game

The game uses `js/core/voice.js` to play samples through a shared Web Audio
context. Click **Enable sound** once; later game events can then call:

```js
this.playVoice("hurt");
```

Add clip names and paths to the `VoicePlayer` mapping in `js/game.js`. Events
before sound is enabled are skipped, and only one wizard line plays at a time.
The sound button also mutes playback. Creating a new `Audio` element for each
clip is unnecessary; the shared context is unlocked by the button's click.

## Verify

```sh
python3 -m unittest discover -s tools/voice -v
node --test tests/voice.test.mjs
```

Tests cover the portable CLI, output metadata, PCM decoding, stereo downmix,
DAC saturation, duration/pitch, fades, headroom, and invalid inputs. They run
without `say`; audition actual synthesized speech in the listening page.
