import type { DeckSample } from "./deck-store";

let context: AudioContext | null = null;
let voice: AudioBufferSourceNode | null = null;
const buffers = new Map<string, AudioBuffer>();
const shapes = new Map<string, number[]>();

function bench(): AudioContext {
  if (!context) context = new AudioContext();
  return context;
}

function sampleKey(sample: DeckSample): string {
  return `${sample.name}:${sample.blob.size}:${sample.blob.type}`;
}

async function decodeSample(sample: DeckSample): Promise<AudioBuffer> {
  const key = sampleKey(sample);
  const cached = buffers.get(key);
  if (cached) return cached;
  const bytes = await sample.blob.arrayBuffer();
  const buffer = await bench().decodeAudioData(bytes);
  buffers.set(key, buffer);
  return buffer;
}

export async function samplePeaks(sample: DeckSample, columns: number): Promise<number[]> {
  const key = `${sampleKey(sample)}@${columns}`;
  const cached = shapes.get(key);
  if (cached) return cached;
  const buffer = await decodeSample(sample);
  const data = buffer.getChannelData(0);
  const span = Math.max(1, Math.floor(data.length / columns));
  const raw: number[] = [];
  let tallest = 0.0001;
  for (let column = 0; column < columns; column += 1) {
    const start = column * span;
    const end = Math.min(data.length, start + span);
    let peak = 0;
    for (let index = start; index < end; index += 1) {
      const value = Math.abs(data[index]);
      if (value > peak) peak = value;
    }
    if (peak > tallest) tallest = peak;
    raw.push(peak);
  }
  const scaled = raw.map((value) => Math.min(1, value / tallest));
  shapes.set(key, scaled);
  return scaled;
}

export async function playSample(sample: DeckSample, gain: number): Promise<void> {
  const buffer = await decodeSample(sample);
  const ctx = bench();
  void ctx.resume().catch(() => {});
  stopSample();
  const source = ctx.createBufferSource();
  const level = ctx.createGain();
  level.gain.value = Math.max(0, gain);
  source.buffer = buffer;
  source.connect(level).connect(ctx.destination);
  source.start();
  voice = source;
  source.onended = () => {
    if (voice === source) voice = null;
  };
}

export function stopSample(): void {
  const playing = voice;
  voice = null;
  if (!playing) return;
  try {
    playing.stop();
  } catch {
    return;
  }
}
