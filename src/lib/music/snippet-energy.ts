export type SnippetEnergy = { rate: number; level: Float32Array; bass: Float32Array };

/** Measure the actual preview samples once; playback time drives the visual, never a timer loop. */
export function measureSnippetEnergy(channels: readonly Float32Array[], sampleRate: number): SnippetEnergy {
  const rate = 30, length = channels[0]?.length ?? 0;
  const frames = Math.ceil(length / sampleRate * rate);
  const level = new Float32Array(frames), bass = new Float32Array(frames);
  const alpha = 1 - Math.exp(-2 * Math.PI * 180 / sampleRate);
  let low = 0;
  for (let frame = 0; frame < frames; frame++) {
    const start = Math.floor(frame * sampleRate / rate), end = Math.min(length, Math.floor((frame + 1) * sampleRate / rate));
    let total = 0, bottom = 0;
    for (let i = start; i < end; i++) {
      let mono = 0;
      for (const channel of channels) { const value = channel[i] ?? 0; total += value * value; mono += value; }
      low += alpha * (mono / channels.length - low);
      bottom += low * low;
    }
    level[frame] = Math.sqrt(total / Math.max(1, (end - start) * channels.length));
    bass[frame] = Math.sqrt(bottom / Math.max(1, end - start));
  }
  for (const values of [level, bass]) {
    const sorted = [...values].sort((a, b) => a - b);
    const reference = Math.max(.04, sorted[Math.floor(sorted.length * .95)] ?? 0);
    for (let i = 0; i < values.length; i++) values[i] = values[i] < .002 ? 0 : Math.min(1, values[i] / reference);
  }
  return { rate, level, bass };
}

export async function decodeSnippetEnergy(blob: Blob, signal: AbortSignal): Promise<SnippetEnergy | null> {
  try {
    if (signal.aborted || typeof OfflineAudioContext === "undefined") return null;
    const context = new OfflineAudioContext(2, 1, 22050);
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    if (signal.aborted) return null;
    return measureSnippetEnergy(Array.from({ length: decoded.numberOfChannels }, (_, i) => decoded.getChannelData(i)), decoded.sampleRate);
  } catch { return null; }
}
