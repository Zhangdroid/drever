import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const sampleRate = 22_050;
const duration = 8;
const sampleCount = sampleRate * duration;
const bytesPerSample = 2;
const output = fileURLToPath(new URL("../assets/opening-loop.wav", import.meta.url));
const buffer = Buffer.alloc(44 + sampleCount * bytesPerSample);

const pulse = (time, beat, decay) => {
  const phase = ((time - beat) % 2 + 2) % 2;
  return phase < 0.3 ? Math.exp(-phase * decay) : 0;
};

const sampleAt = (time) => {
  const edgeFade = Math.min(1, time * 5, (duration - time) * 5);
  const low = Math.sin(2 * Math.PI * 55 * time) * pulse(time, 0, 13) * 0.32;
  const body = Math.sin(2 * Math.PI * 110 * time + Math.sin(time * 0.7) * 0.4) * 0.11;
  const note = [220, 277.18, 329.63, 246.94][Math.floor(time / 2) % 4] ?? 220;
  const glass =
    Math.sin(2 * Math.PI * note * time) *
    (0.04 + 0.035 * Math.sin(2 * Math.PI * 0.25 * time)) *
    pulse(time, 0.5, 3.5);
  const air = Math.sin(2 * Math.PI * 1_760 * time) * pulse(time, 1, 20) * 0.018;
  return Math.tanh((low + body + glass + air) * 1.5) * edgeFade;
};

buffer.write("RIFF", 0);
buffer.writeUInt32LE(buffer.length - 8, 4);
buffer.write("WAVE", 8);
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16);
buffer.writeUInt16LE(1, 20);
buffer.writeUInt16LE(1, 22);
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * bytesPerSample, 28);
buffer.writeUInt16LE(bytesPerSample, 32);
buffer.writeUInt16LE(16, 34);
buffer.write("data", 36);
buffer.writeUInt32LE(sampleCount * bytesPerSample, 40);

for (let index = 0; index < sampleCount; index += 1) {
  const sample = Math.round(sampleAt(index / sampleRate) * 32_767);
  buffer.writeInt16LE(sample, 44 + index * bytesPerSample);
}

mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, buffer);
