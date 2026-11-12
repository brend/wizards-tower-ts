#!/usr/bin/env python3
"""Offline retro speech asset generator. Python 3.9+, no pip dependencies."""

import argparse
from array import array
from dataclasses import asdict, dataclass
import hashlib
import html
import json
import math
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
import wave


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent.parent
OUTPUT_RATE = 22050


@dataclass(frozen=True)
class Preset:
    description: str
    voice: str
    rate: int
    pitch: float
    sample_rate: int
    bits: int
    highpass: float
    lowpass: float
    dpcm: bool
    echo_ms: float
    echo_gain: float
    dpcm_mix: float = 1.0
    output_lowpass: float = 0.0

    def validate(self):
        for name, lo, hi in (
            ("rate", 80, 300), ("pitch", 0.5, 2),
            ("sample_rate", 4000, 22050), ("bits", 2, 16),
            ("highpass", 0, 1000), ("lowpass", 500, self.sample_rate / 2),
            ("echo_ms", 0, 500), ("echo_gain", 0, 0.6),
            ("dpcm_mix", 0, 1), ("output_lowpass", 0, OUTPUT_RATE / 2),
        ):
            value = getattr(self, name)
            if not isinstance(value, (int, float)) or not lo <= value <= hi:
                raise ValueError(f"{name} must be between {lo} and {hi}")
        for name in ("rate", "sample_rate", "bits"):
            if type(getattr(self, name)) is not int:
                raise ValueError(f"{name} must be an integer")
        if type(self.dpcm) is not bool:
            raise ValueError("dpcm must be true or false")
        if not isinstance(self.voice, str) or not self.voice.strip():
            raise ValueError("voice must be a nonempty name")
        if not isinstance(self.description, str):
            raise ValueError("description must be text")
        if self.highpass >= self.lowpass:
            raise ValueError("highpass must be below lowpass")


def safe_id(value):
    if not isinstance(value, str) or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", value):
        raise ValueError(f"Invalid ID {value!r}: use lowercase letters, numbers and hyphens")
    return value


def read_wav(path):
    with wave.open(str(path), "rb") as source:
        channels, width, rate, count, compression, _ = source.getparams()
        if compression != "NONE" or width not in (1, 2, 3, 4) or channels not in (1, 2):
            raise ValueError("Input must be mono/stereo integer PCM WAV (8/16/24/32-bit)")
        raw = source.readframes(count)
    if not count or len(raw) != count * channels * width:
        raise ValueError(f"Empty or truncated audio: {path}. macOS speech may need to run outside a sandbox.")
    values = []
    for offset in range(0, len(raw), width * channels):
        total = 0.0
        for channel in range(channels):
            start = offset + channel * width
            value = int.from_bytes(raw[start:start + width], "little", signed=width != 1)
            total += (value - 128) / 128 if width == 1 else value / (2 ** (width * 8 - 1))
        values.append(total / channels)
    if max(map(abs, values)) < 0.0001:
        raise ValueError(f"Silent audio: {path}")
    return values, rate


def write_wav(path, samples, rate=OUTPUT_RATE):
    pcm = array("h", (round(max(-1, min(1, x)) * 32767) for x in samples))
    if sys.byteorder != "little":
        pcm.byteswap()
    with wave.open(str(path), "wb") as target:
        target.setnchannels(1)
        target.setsampwidth(2)
        target.setframerate(rate)
        target.writeframes(pcm.tobytes())


def lowpass(samples, rate, cutoff):
    alpha = 1 - math.exp(-2 * math.pi * cutoff / rate)
    state = 0.0
    output = []
    for sample in samples:
        state += alpha * (sample - state)
        output.append(state)
    return output


def resample(samples, step):
    """Linear resampling; caller filters before downsampling."""
    output = []
    for i in range(max(1, math.ceil(len(samples) / step))):
        position = min(i * step, len(samples) - 1)
        left = int(position)
        fraction = position - left
        output.append(samples[left] * (1 - fraction) + samples[min(left + 1, len(samples) - 1)] * fraction)
    return output


def normalize(samples, peak=0.85):
    maximum = max(map(abs, samples), default=0)
    return [s * peak / maximum for s in samples] if maximum else list(samples)


def delta_modulate(samples):
    """Approximate the NES DMC's +/-2 steps through its 7-bit DAC range.

    This returns decoded audio, not a ROM-ready DMC bitstream.
    """
    level = 64
    output = []
    for sample in samples:
        target = (max(-1, min(1, sample)) + 1) * 63.5
        if target >= level and level <= 125:
            level += 2
        elif target < level and level >= 2:
            level -= 2
        output.append((level - 64) / 64)
    return output


def process(samples, rate, preset):
    preset.validate()
    # Trim only leading/trailing silence, retaining a little articulation room.
    threshold = max(map(abs, samples)) * 0.012
    active = [i for i, s in enumerate(samples) if abs(s) > threshold]
    if not active:
        raise ValueError("Cannot process silent audio")
    padding = round(rate * 0.025)
    samples = samples[max(0, active[0] - padding):active[-1] + padding + 1]
    dc = lowpass(samples, rate, preset.highpass)
    samples = [s - d for s, d in zip(samples, dc)]
    # Pitch changes also change duration, like changing tape/playback speed.
    cutoff = min(preset.lowpass, preset.sample_rate / (2 * preset.pitch))
    samples = lowpass(lowpass(samples, rate, cutoff), rate, cutoff)
    samples = normalize(resample(samples, rate * preset.pitch / preset.sample_rate))
    if preset.dpcm:
        decoded = delta_modulate(samples)
        # Retain some PCM articulation instead of amplifying only DAC distortion.
        steps = 63
        samples = [wet * preset.dpcm_mix + (round(dry * steps) / steps) * (1 - preset.dpcm_mix)
                   for dry, wet in zip(samples, decoded)]
    else:
        steps = 2 ** (preset.bits - 1) - 1
        samples = [round(s * steps) / steps for s in samples]
    # Hold DAC values when returning to a browser-friendly output rate.
    samples = [samples[min(len(samples) - 1, int(i * preset.sample_rate / OUTPUT_RATE))]
               for i in range(math.ceil(len(samples) * OUTPUT_RATE / preset.sample_rate))]
    # Smooth buzz introduced by the DAC and sample hold, after those stages.
    if preset.output_lowpass:
        samples = lowpass(lowpass(samples, OUTPUT_RATE, preset.output_lowpass),
                          OUTPUT_RATE, preset.output_lowpass)
    if preset.echo_ms and preset.echo_gain:
        delay = round(OUTPUT_RATE * preset.echo_ms / 1000)
        dry = samples
        samples = dry + [0.0] * (delay * 2)
        for i, sample in enumerate(dry):
            samples[i + delay] += sample * preset.echo_gain
            samples[i + delay * 2] += sample * preset.echo_gain ** 2
    mean = sum(samples) / len(samples)
    samples = normalize([s - mean for s in samples])
    fade = min(round(OUTPUT_RATE * 0.008), len(samples) // 2)
    for i in range(fade):
        gain = i / fade
        samples[i] *= gain
        samples[-1 - i] *= gain
    return samples


def installed_voices():
    result = subprocess.run(["say", "-v", "?"], check=True, capture_output=True, text=True)
    return {re.split(r"\s{2,}", line.strip())[0] for line in result.stdout.splitlines() if line.strip()}


def synthesize(text, voice, rate, destination):
    # stdin avoids shell interpolation and makes even a leading '-' plain text.
    result = subprocess.run(
        ["say", "-v", voice, "-r", str(rate), "-o", str(destination),
         "--data-format=LEI16@22050", "-f", "-"],
        input=text, text=True, capture_output=True, timeout=60,
    )
    if result.returncode:
        raise ValueError(f"Speech synthesis failed: {result.stderr.strip()}")
    return read_wav(destination)


def write_gallery(output, manifest):
    escape = html.escape
    cards = []
    for clip in manifest["clips"]:
        cards.append(
            f'<article><h2>{escape(clip["preset"])} / {escape(clip["id"])}</h2>'
            f'<p class="line">{escape(clip["text"])}</p>'
            f'<p>{escape(clip["settings"]["description"])}</p>'
            f'<audio controls preload="none" src="{escape(clip["file"])}"></audio>'
            f'<p>{clip["duration"]:.2f}s · <a download href="{escape(clip["file"])}">Download WAV</a>'
            f' · <a href="{escape(clip["source"])}">Dry source</a></p></article>'
        )
    page = '''<!doctype html><html lang="en"><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Wizard voice samples</title><style>
body{background:#101525;color:#e9e4d5;font:16px/1.5 system-ui;margin:0;padding:32px}
main{max-width:1100px;margin:auto}h1{color:#e4be69}h2{font:18px monospace;color:#c4b5fd}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:18px}
article{background:#1c2338;border:1px solid #414763;border-radius:10px;padding:20px}
a{color:#e4be69}audio{width:100%}.line{font-size:19px}p{color:#d4d5df}
</style><main><h1>Wizard voice samples</h1>
<p>Compare the same line across three retro treatments. WAV · mono · 22,050 Hz.
These are stylistic approximations, not hardware emulations.</p><div class="grid">'''
    page += "\n".join(cards) + '''</div></main><script>
document.addEventListener('play', event => {
  document.querySelectorAll('audio').forEach(audio => {
    if (audio !== event.target) audio.pause();
  });
}, true);
</script></html>'''
    (output / "index.html").write_text(page, encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--text", help="Generate one custom line")
    source.add_argument("--lines", type=Path, help="JSON array of {id, text}; defaults to bundled lines")
    source.add_argument("--input-wav", type=Path, help="Process existing PCM WAV without macOS speech")
    parser.add_argument("--name", default="custom", help="ID for --text or --input-wav")
    parser.add_argument("--preset", default="all", help="Preset name or all")
    parser.add_argument("--presets", type=Path, default=HERE / "presets.json")
    parser.add_argument("--voice", help="Override the macOS source voice")
    parser.add_argument("--rate", type=int, help="Override words per minute (80–300)")
    parser.add_argument("--pitch", type=float, help="Override playback pitch/speed (0.5–2)")
    parser.add_argument("--output", type=Path, default=ROOT / "assets/audio/wizard")
    args = parser.parse_args()
    try:
        raw_presets = json.loads(args.presets.read_text(encoding="utf-8"))
        if not isinstance(raw_presets, dict) or not raw_presets:
            raise ValueError("Presets must be a nonempty JSON object")
        if args.preset != "all" and args.preset not in raw_presets:
            raise ValueError(f"Unknown preset {args.preset!r}; choose {', '.join(raw_presets)} or all")
        presets = {}
        for name, settings in raw_presets.items():
            if args.preset not in ("all", name):
                continue
            safe_id(name)
            settings = dict(settings)
            for key in ("voice", "rate", "pitch"):
                if getattr(args, key) is not None:
                    settings[key] = getattr(args, key)
            preset = Preset(**settings)
            preset.validate()
            presets[name] = preset
        if args.text is not None or args.input_wav:
            lines = [{"id": args.name, "text": args.text if args.text is not None else args.input_wav.stem}]
        else:
            lines = json.loads((args.lines or HERE / "lines.json").read_text(encoding="utf-8"))
        if not isinstance(lines, list) or not lines:
            raise ValueError("Lines must be a nonempty JSON array")
        seen = set()
        for line in lines:
            identifier = safe_id(line["id"])
            if identifier in seen:
                raise ValueError(f"Duplicate line ID: {identifier}")
            seen.add(identifier)
            if not isinstance(line["text"], str) or not line["text"].strip():
                raise ValueError(f"Empty text for {identifier}")
        if args.input_wav:
            read_wav(args.input_wav)
        else:
            if not shutil.which("say"):
                raise ValueError("Text generation requires macOS 'say'; use --input-wav on other platforms")
            available = installed_voices()
            missing = {p.voice for p in presets.values()} - available
            if missing:
                raise ValueError(f"Unavailable voice(s): {', '.join(sorted(missing))}. List voices with: say -v '?' ")
        output = args.output.resolve()
        # Stage the whole batch so failed synthesis cannot publish partial assets.
        with tempfile.TemporaryDirectory(prefix="wizard-voice-") as temporary:
            stage = Path(temporary)
            (stage / "sources").mkdir()
            manifest = {"version": 1, "sample_rate": OUTPUT_RATE, "format": "mono PCM16 WAV", "clips": []}
            for line in lines:
                for name, preset in presets.items():
                    relative = f'{name}/{line["id"]}.wav'
                    source_relative = f'sources/{name}-{line["id"]}.wav'
                    source_path = stage / source_relative
                    if args.input_wav:
                        shutil.copyfile(args.input_wav, source_path)
                        samples, rate = read_wav(source_path)
                    else:
                        samples, rate = synthesize(line["text"], preset.voice, preset.rate, source_path)
                    processed = process(samples, rate, preset)
                    (stage / name).mkdir(exist_ok=True)
                    write_wav(stage / relative, processed)
                    manifest["clips"].append({
                        **line, "preset": name, "file": relative, "source": source_relative,
                        "source_engine": "input-wav" if args.input_wav else "macOS say",
                        "source_sha256": hashlib.sha256(source_path.read_bytes()).hexdigest(),
                        "settings": asdict(preset), "duration": round(len(processed) / OUTPUT_RATE, 4),
                    })
                    print(f'{relative}: {len(processed) / OUTPUT_RATE:.2f}s', flush=True)
            (stage / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
            write_gallery(stage, manifest)
            shutil.copytree(stage, output, dirs_exist_ok=True)
        print(f"Preview: {output / 'index.html'}")
    except (OSError, ValueError, TypeError, KeyError, wave.Error, subprocess.SubprocessError) as error:
        parser.exit(1, f"error: {error}\n")


if __name__ == "__main__":
    main()
