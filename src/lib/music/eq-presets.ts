import type { PeqType } from "./parametric-eq";

export type MusicEqPreset = { id: string; labelKey: string; bands: number[] };

export const MUSIC_EQ_PRESETS: MusicEqPreset[] = [
  { id: "flat", labelKey: "music.eq.preset.flat", bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { id: "acoustic", labelKey: "music.eq.preset.acoustic", bands: [5, 4, 3, 1, 2, 2, 3, 4, 3, 2] },
  { id: "bassBoost", labelKey: "music.eq.preset.bassBoost", bands: [7, 6, 5, 3, 1, 0, 0, 0, 0, 0] },
  {
    id: "bassReducer",
    labelKey: "music.eq.preset.bassReducer",
    bands: [-7, -6, -4, -2, 0, 0, 0, 0, 0, 0],
  },
  {
    id: "trebleBoost",
    labelKey: "music.eq.preset.trebleBoost",
    bands: [0, 0, 0, 0, 0, 1, 2, 4, 6, 7],
  },
  {
    id: "trebleReducer",
    labelKey: "music.eq.preset.trebleReducer",
    bands: [0, 0, 0, 0, 0, -1, -2, -4, -5, -6],
  },
  { id: "vocal", labelKey: "music.eq.preset.vocal", bands: [-2, -2, -1, 1, 3, 4, 4, 3, 1, 0] },
  { id: "loudness", labelKey: "music.eq.preset.loudness", bands: [6, 5, 1, 0, -2, -1, 0, 2, 5, 7] },
  { id: "rock", labelKey: "music.eq.preset.rock", bands: [5, 4, 3, 1, -1, -1, 1, 3, 4, 5] },
  { id: "pop", labelKey: "music.eq.preset.pop", bands: [-1, 0, 2, 4, 4, 3, 1, 0, -1, -2] },
  { id: "hiphop", labelKey: "music.eq.preset.hiphop", bands: [6, 5, 3, 2, -1, -1, 1, 2, 3, 3] },
  { id: "rnb", labelKey: "music.eq.preset.rnb", bands: [4, 5, 4, 2, -1, -1, 2, 2, 3, 3] },
  {
    id: "electronic",
    labelKey: "music.eq.preset.electronic",
    bands: [5, 4, 1, 0, -2, 2, 1, 2, 5, 6],
  },
  { id: "dance", labelKey: "music.eq.preset.dance", bands: [6, 6, 3, 0, -2, -1, 2, 3, 4, 4] },
  { id: "jazz", labelKey: "music.eq.preset.jazz", bands: [4, 3, 1, 2, -1, -1, 0, 1, 3, 4] },
  {
    id: "classical",
    labelKey: "music.eq.preset.classical",
    bands: [5, 4, 3, 2, -1, -2, 0, 2, 3, 4],
  },
  {
    id: "smallSpeakers",
    labelKey: "music.eq.preset.smallSpeakers",
    bands: [0, 1, 3, 4, 3, 2, 1, 0, -2, -4],
  },
  { id: "spoken", labelKey: "music.eq.preset.spoken", bands: [-5, -4, -1, 2, 4, 4, 3, 1, -2, -5] },
  {
    id: "lateNight",
    labelKey: "music.eq.preset.lateNight",
    bands: [-4, -3, -1, 1, 2, 2, 1, -1, -3, -4],
  },
];

export function matchEqPreset(bands: number[]): string {
  const near = (candidate: number[]) =>
    candidate.every((value, index) => Math.abs(value - (bands[index] ?? 0)) < 0.25);
  return MUSIC_EQ_PRESETS.find((preset) => near(preset.bands))?.id ?? "custom";
}

export type MusicPeqPresetFilter = {
  type: PeqType;
  frequency: number;
  gain: number;
  q: number;
  enabled: boolean;
};

const PEQ_PRESET_Q = 1.41;
const PEQ_PRESET_FLOOR = 0.25;

type PeqBand = readonly [PeqType, number, number, number];

/**
 * Parametric presets are voiced here rather than derived from the ten graphic bands, because a
 * peaking filter on an octave centre cannot extend a sub shelf, cannot taper into the top octave,
 * and cannot sit narrow enough to pull sibilance without taking presence with it. Each curve is a
 * lift, a mud cut, a presence band and an air shelf; presets with no entry still derive.
 */
const PEQ_CURVES: Record<string, readonly PeqBand[]> = {
  acoustic: [
    ["lowShelf", 90, 2, 0.7],
    ["peak", 320, -2, 1.1],
    ["peak", 1600, 1, 1.2],
    ["peak", 4500, 2.5, 1],
    ["highShelf", 10000, 2.5, 0.7],
  ],
  bassBoost: [
    ["lowShelf", 70, 6, 0.7],
    ["peak", 220, -2, 1],
  ],
  bassReducer: [
    ["lowShelf", 80, -6, 0.7],
    ["peak", 180, -2.5, 1],
  ],
  trebleBoost: [
    ["peak", 7000, -1, 3.5],
    ["highShelf", 6500, 5, 0.7],
  ],
  trebleReducer: [["highShelf", 6000, -5, 0.7]],
  vocal: [
    ["lowShelf", 100, -3, 0.7],
    ["peak", 300, -2, 1.1],
    ["peak", 1800, 1.5, 1],
    ["peak", 3500, 3, 1],
    ["peak", 7000, -2, 3],
    ["highShelf", 11000, 1.5, 0.7],
  ],
  loudness: [
    ["lowShelf", 90, 6, 0.7],
    ["peak", 700, -2.5, 0.9],
    ["highShelf", 9000, 5, 0.7],
  ],
  rock: [
    ["lowShelf", 80, 3.5, 0.7],
    ["peak", 350, -2.5, 1.1],
    ["peak", 2800, 2, 1],
    ["peak", 6500, -1.5, 2.5],
    ["highShelf", 10000, 3, 0.7],
  ],
  pop: [
    ["lowShelf", 60, 3, 0.7],
    ["peak", 250, -2, 1.1],
    ["peak", 3000, 2.5, 1],
    ["peak", 7000, -1, 3],
    ["highShelf", 11000, 3, 0.7],
  ],
  hiphop: [
    ["lowShelf", 55, 4, 0.7],
    ["peak", 80, 2, 0.9],
    ["peak", 250, -3, 1.1],
    ["peak", 3200, 2.5, 1],
    ["peak", 6500, -1.5, 2.5],
    ["highShelf", 11000, 3, 0.7],
  ],
  rnb: [
    ["lowShelf", 65, 3.5, 0.7],
    ["peak", 220, -2, 1.1],
    ["peak", 1200, 1, 1],
    ["peak", 3500, 2, 1.1],
    ["peak", 7000, -2, 3],
    ["highShelf", 12000, 2.5, 0.7],
  ],
  electronic: [
    ["lowShelf", 50, 5, 0.7],
    ["peak", 300, -3, 1],
    ["peak", 4000, 1.5, 1],
    ["highShelf", 10000, 4, 0.7],
  ],
  dance: [
    ["lowShelf", 60, 5, 0.7],
    ["peak", 200, -3, 1],
    ["peak", 800, -1.5, 1],
    ["peak", 3500, 1.5, 1],
    ["highShelf", 10000, 4, 0.7],
  ],
  jazz: [
    ["lowShelf", 100, 2, 0.7],
    ["peak", 300, -1.5, 1.1],
    ["peak", 2500, 1, 1],
    ["highShelf", 10000, 2, 0.7],
  ],
  classical: [
    ["lowShelf", 100, 1.5, 0.7],
    ["peak", 350, -1, 1],
    ["peak", 3500, -1, 1.2],
    ["highShelf", 11000, 2.5, 0.7],
  ],
  smallSpeakers: [
    ["highPass", 90, 0, 0.7],
    ["peak", 180, 3, 1],
    ["peak", 1200, 1.5, 1],
    ["peak", 3200, 3, 1],
    ["highShelf", 9000, -2, 0.7],
  ],
  spoken: [
    ["highPass", 80, 0, 0.7],
    ["peak", 250, -3, 1.1],
    ["peak", 1800, 2, 1],
    ["peak", 3500, 3, 1],
    ["peak", 7000, -2.5, 3],
    ["highShelf", 12000, -2, 0.7],
  ],
  lateNight: [
    ["lowShelf", 100, -5, 0.7],
    ["peak", 300, -1.5, 1],
    ["peak", 1500, 2, 0.9],
    ["peak", 3500, 2.5, 1],
    ["highShelf", 9000, -3, 0.7],
  ],
};

export function peqPresetFilters(
  preset: MusicEqPreset,
  frequencies: readonly number[],
): MusicPeqPresetFilter[] {
  const curve = PEQ_CURVES[preset.id];
  if (curve)
    return curve.map(([type, frequency, gain, q]) => ({ type, frequency, gain, q, enabled: true }));
  const out: MusicPeqPresetFilter[] = [];
  frequencies.forEach((frequency, index) => {
    const gain = preset.bands[index] ?? 0;
    if (Math.abs(gain) < PEQ_PRESET_FLOOR) return;
    out.push({ type: "peak", frequency, gain, q: PEQ_PRESET_Q, enabled: true });
  });
  return out;
}

export function matchPeqPreset(
  filters: readonly { type: string; frequency: number; gain: number; q: number }[],
  frequencies: readonly number[],
): string {
  for (const preset of MUSIC_EQ_PRESETS) {
    const wanted = peqPresetFilters(preset, frequencies);
    if (wanted.length !== filters.length) continue;
    const same = wanted.every((want) =>
      filters.some(
        (have) =>
          have.type === want.type &&
          Math.abs(have.frequency - want.frequency) < 0.5 &&
          Math.abs(have.gain - want.gain) < 0.25 &&
          Math.abs(have.q - want.q) < 0.05,
      ),
    );
    if (same) return preset.id;
  }
  return "custom";
}
