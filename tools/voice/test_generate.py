"""Run with: python3 -m unittest discover -s tools/voice -v"""

import json
import math
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
import wave

from generate import HERE, OUTPUT_RATE, Preset, delta_modulate, process, read_wav, write_wav


class VoiceTests(unittest.TestCase):
    def setUp(self):
        self.presets = {name: Preset(**settings) for name, settings in
                        json.loads((HERE / "presets.json").read_text()).items()}
        self.signal = [0.6 * math.sin(2 * math.pi * 220 * i / OUTPUT_RATE)
                       for i in range(OUTPUT_RATE)]

    def test_all_presets_produce_bounded_faded_audio(self):
        for name, preset in self.presets.items():
            with self.subTest(preset=name):
                result = process(self.signal, OUTPUT_RATE, preset)
                self.assertGreater(max(map(abs, result)), 0.5)
                self.assertLessEqual(max(map(abs, result)), 0.850001)
                self.assertEqual(result[0], 0)
                self.assertEqual(result[-1], 0)
                expected = 1 / preset.pitch + 2 * preset.echo_ms / 1000
                self.assertAlmostEqual(len(result) / OUTPUT_RATE, expected, delta=0.01)

    def test_delta_dac_saturates_without_wrapping(self):
        result = delta_modulate([1.0] * 100 + [-1.0] * 100)
        levels = [round(sample * 64 + 64) for sample in result]
        self.assertEqual(max(levels), 126)
        self.assertEqual(min(levels), 0)
        self.assertTrue(all(abs(b - a) <= 2 for a, b in zip(levels, levels[1:])))

    def test_pcm_roundtrip_and_stereo_downmix(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "input.wav"
            write_wav(path, self.signal)
            values, rate = read_wav(path)
            self.assertEqual(rate, OUTPUT_RATE)
            self.assertEqual(len(values), len(self.signal))
            self.assertAlmostEqual(values[100], self.signal[100], places=4)
            with wave.open(str(path), "wb") as output:
                output.setparams((2, 2, 8000, 0, "NONE", "not compressed"))
                output.writeframes(struct.pack("<hhhh", 16384, 0, -16384, 0))
            self.assertEqual(read_wav(path), ([0.25, -0.25], 8000))

    def test_empty_and_silent_audio_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "empty.wav"
            for samples in ([], [0] * 100):
                write_wav(path, samples)
                with self.assertRaises(ValueError):
                    read_wav(path)

    def test_portable_cli_exports_manifest_and_gallery(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / "input.wav"
            write_wav(source, self.signal)
            output = root / "output"
            command = [sys.executable, str(HERE / "generate.py"), "--input-wav", str(source),
                       "--name", "test-line", "--output", str(output)]
            result = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            manifest = json.loads((output / "manifest.json").read_text())
            self.assertEqual(len(manifest["clips"]), 3)
            for clip in manifest["clips"]:
                audio, rate = read_wav(output / clip["file"])
                self.assertEqual(rate, OUTPUT_RATE)
                self.assertAlmostEqual(len(audio) / rate, clip["duration"], places=3)
                self.assertEqual((output / clip["source"]).read_bytes(), source.read_bytes())
            self.assertIn("<audio controls", (output / "index.html").read_text())
            before = (output / "manifest.json").read_bytes()
            for extra in (["--pitch", "nan"], ["--name", "../escape"], ["--preset", "missing"]):
                failed = subprocess.run(command + extra, capture_output=True, text=True)
                self.assertNotEqual(failed.returncode, 0)
                self.assertNotIn("Traceback", failed.stderr)
                self.assertEqual((output / "manifest.json").read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
