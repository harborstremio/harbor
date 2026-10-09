export type GifTiming = "auto" | "1" | "2" | "4" | "8";
export function normalizeGifTiming(value: unknown): GifTiming {
  return value === "1" || value === "2" || value === "4" || value === "8" ? value : "auto";
}
export function createGifClock(duration: number) {
  let position = 0, rate = 1 / Math.max(20, duration), beats = 0, mode: GifTiming = "auto";
  return {
    advance(ms: number, playing: boolean, pulse?: { locked: boolean; period: number | null; beat: number }, timing: GifTiming = "auto") {
      if (!playing) return position;
      const dt = Math.max(0, Math.min(250, ms));
      if (mode !== timing) { mode = timing; beats = 0; }
      if (pulse?.locked && pulse.period) {
        if (!beats) beats = timing === "auto"
          ? [1, 2, 4, 8, 16].reduce((a, b) => Math.abs(Math.log(duration / pulse.period! / a)) < Math.abs(Math.log(duration / pulse.period! / b)) ? a : b)
          : Number(timing);
        const target = 1 / (pulse.period * beats);
        rate += (target - rate) * (1 - Math.exp(-dt / 220));
        const phase = ((pulse.beat / beats) % 1 + 1) % 1;
        const error = phase - position, nearest = error - Math.round(error);
        // Phase-lock gradually; never skip to a different GIF pose on a kick.
        position += Math.max(-rate * dt * .3, Math.min(rate * dt * .3, nearest * dt / 450));
      } else if (!beats) rate = 1 / Math.max(20, duration);
      position = (position + rate * dt) % 1;
      return position;
    },
    retime() { beats = 0; },
    reset() { position = 0; rate = 1 / Math.max(20, duration); beats = 0; },
  };
}
