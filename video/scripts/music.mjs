// Original procedural score, composed for Resumer. No samples or external audio.
import { writeFileSync } from "node:fs";
const rate = 44100,
  seconds = 48,
  length = rate * seconds;
const left = new Float32Array(length),
  right = new Float32Array(length);
const freq = (n) => 440 * 2 ** ((n - 69) / 12);
function tone(start, duration, midi, gain, kind = "pad", pan = 0) {
  const n = Math.floor(duration * rate),
    f = freq(midi),
    offset = Math.floor(start * rate);
  for (let i = 0; i < n && offset + i < length; i++) {
    const t = i / rate;
    const env =
      kind === "pad"
        ? Math.min(t / 0.35, 1) * Math.min((duration - t) / 0.6, 1)
        : Math.min(t / 0.008, 1) * Math.exp(-t * (kind === "bass" ? 3 : 5));
    const a =
      (Math.sin(2 * Math.PI * f * t) +
        0.22 * Math.sin(2 * Math.PI * f * 2 * t) +
        0.08 * Math.sin(2 * Math.PI * f * 3 * t)) *
      env *
      gain;
    left[offset + i] += a * (1 - pan * 0.35);
    right[offset + i] += a * (1 + pan * 0.35);
  }
}
const chords = [
  [57, 60, 64, 71],
  [53, 57, 60, 67],
  [48, 55, 59, 64],
  [55, 59, 62, 69],
];
const melody = [76, 71, 72, 67, 69, 72, 76, 79, 76, 74, 71, 67, 69, 71, 74, 76];
let seed = 17;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
};
for (let bar = 0; bar < 24; bar++) {
  const start = bar * 2,
    chord = chords[bar % 4];
  chord.forEach((note, j) =>
    tone(start, 2.7, note, 0.024, "pad", (j - 1.5) / 2),
  );
  for (let beat = 0; beat < 4; beat++) {
    tone(start + beat * 0.5, 0.8, chord[0] - 12, 0.075, "bass");
    if (bar > 1 && bar < 22) {
      const off = Math.floor((start + beat * 0.5) * rate);
      for (let i = 0; i < rate * 0.18 && off + i < length; i++) {
        const t = i / rate,
          a =
            0.14 *
            Math.sin(2 * Math.PI * (48 * t + 5 * (1 - Math.exp(-t * 30)))) *
            Math.exp(-t * 24);
        left[off + i] += a;
        right[off + i] += a;
      }
    }
  }
  for (let j = 0; j < 4; j++)
    tone(
      start + j * 0.5 + 0.25,
      1,
      melody[(bar * 3 + j) % 16],
      0.045,
      "pluck",
      j % 2 ? 0.5 : -0.5,
    );
  if (bar > 1 && bar < 22)
    for (let j = 0; j < 8; j++) {
      const off = Math.floor((start + j * 0.25) * rate);
      let previous = 0;
      for (let i = 0; i < rate * 0.045 && off + i < length; i++) {
        const v = noise(),
          a = (v - previous) * 0.012 * Math.exp(-i / (rate * 0.012));
        previous = v;
        left[off + i] += a;
        right[off + i] += a;
      }
    }
}
// Stereo echo adds space without obscuring the transients.
for (let i = Math.floor(rate * 0.375); i < length; i++) {
  left[i] += right[i - Math.floor(rate * 0.375)] * 0.12;
  right[i] += left[i - Math.floor(rate * 0.375)] * 0.12;
}
const wav = Buffer.alloc(44 + length * 4);
wav.write("RIFF");
wav.writeUInt32LE(wav.length - 8, 4);
wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16);
wav.writeUInt16LE(1, 20);
wav.writeUInt16LE(2, 22);
wav.writeUInt32LE(rate, 24);
wav.writeUInt32LE(rate * 4, 28);
wav.writeUInt16LE(4, 32);
wav.writeUInt16LE(16, 34);
wav.write("data", 36);
wav.writeUInt32LE(length * 4, 40);
let peak = 0;
for (let i = 0; i < length; i++) {
  const fade = Math.min(i / (rate * 1.2), 1, (length - i) / (rate * 2));
  for (let ch = 0; ch < 2; ch++) {
    const v = (ch ? right[i] : left[i]) * fade;
    peak = Math.max(peak, Math.abs(v));
    wav.writeInt16LE(
      Math.round(Math.max(-1, Math.min(1, v)) * 32767),
      44 + i * 4 + ch * 2,
    );
  }
}
writeFileSync(new URL("../public/resumer-score.wav", import.meta.url), wav);
console.log({ duration: seconds, peak });
