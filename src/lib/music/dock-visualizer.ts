export const DOCK_VISUALIZER_BARS = 8;

/** Measured octave-band energy, low to high; no history or invented frequencies. */
export function musicDockSpectrum(bands: readonly number[] | undefined, active: boolean): number[] {
  if (!active || bands?.length !== DOCK_VISUALIZER_BARS) return Array(DOCK_VISUALIZER_BARS).fill(0);
  return bands.map((db) =>
    Number.isFinite(db) ? Math.max(0, Math.min(1, (db + 60) / 50)) ** 1.5 : 0,
  );
}
