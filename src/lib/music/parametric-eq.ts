export const PEQ_TYPES = ["peak", "lowShelf", "highShelf", "lowPass", "highPass", "notch"] as const;
export type PeqType = (typeof PEQ_TYPES)[number];
export type PeqFilter = {
  type: PeqType;
  frequency: number;
  gain: number;
  q: number;
  enabled: boolean;
};
export const MAX_PEQ_FILTERS = 24;
export const clampNumber = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;

export function normalizePeq(filters: unknown): PeqFilter[] {
  if (!Array.isArray(filters)) return [];
  return filters
    .slice(0, MAX_PEQ_FILTERS)
    .filter((item) => item && typeof item === "object")
    .map((item) => ({
      type: PEQ_TYPES.includes(item.type) ? item.type : "peak",
      frequency: clampNumber(item.frequency, 20, 20000, 1000),
      gain: clampNumber(item.gain, -18, 18, 0),
      q: clampNumber(item.q, 0.1, 12, 0.7071),
      enabled: item.enabled !== false,
    }));
}

/** RBJ biquads, matching lavfi's Q-width filters; the graph is a response calculation. */
export function peqCoefficients(filter: PeqFilter, sampleRate = 48000, strength = 1): number[] {
  const w = (2 * Math.PI * Math.min(filter.frequency, sampleRate * 0.499)) / sampleRate;
  const c = Math.cos(w),
    s = Math.sin(w),
    alpha = s / (2 * filter.q);
  const a = 10 ** ((filter.gain * strength) / 40),
    root = 2 * Math.sqrt(a) * alpha;
  switch (filter.type) {
    case "lowShelf":
      return [
        a * (a + 1 - (a - 1) * c + root),
        2 * a * (a - 1 - (a + 1) * c),
        a * (a + 1 - (a - 1) * c - root),
        a + 1 + (a - 1) * c + root,
        -2 * (a - 1 + (a + 1) * c),
        a + 1 + (a - 1) * c - root,
      ];
    case "highShelf":
      return [
        a * (a + 1 + (a - 1) * c + root),
        -2 * a * (a - 1 + (a + 1) * c),
        a * (a + 1 + (a - 1) * c - root),
        a + 1 - (a - 1) * c + root,
        2 * (a - 1 - (a + 1) * c),
        a + 1 - (a - 1) * c - root,
      ];
    case "lowPass":
      return [(1 - c) / 2, 1 - c, (1 - c) / 2, 1 + alpha, -2 * c, 1 - alpha];
    case "highPass":
      return [(1 + c) / 2, -(1 + c), (1 + c) / 2, 1 + alpha, -2 * c, 1 - alpha];
    case "notch":
      return [1, -2 * c, 1, 1 + alpha, -2 * c, 1 - alpha];
    default:
      return [1 + alpha * a, -2 * c, 1 - alpha * a, 1 + alpha / a, -2 * c, 1 - alpha / a];
  }
}

function response(coefficients: number[][], frequency: number, sampleRate: number): number {
  let db = 0;
  const w = (2 * Math.PI * frequency) / sampleRate,
    c1 = Math.cos(w),
    c2 = Math.cos(2 * w),
    s1 = Math.sin(w),
    s2 = Math.sin(2 * w);
  for (const [b0, b1, b2, a0, a1, a2] of coefficients) {
    const numerator = (b0 + b1 * c1 + b2 * c2) ** 2 + (b1 * s1 + b2 * s2) ** 2;
    const denominator = (a0 + a1 * c1 + a2 * c2) ** 2 + (a1 * s1 + a2 * s2) ** 2;
    db += 10 * Math.log10(Math.max(1e-20, numerator) / Math.max(1e-20, denominator));
  }
  return db;
}

export function peqResponse(
  filters: readonly PeqFilter[],
  frequency: number,
  sampleRate = 48000,
  strength = 1,
): number {
  return strength === 0
    ? 0
    : response(
        filters.filter((f) => f.enabled).map((f) => peqCoefficients(f, sampleRate, strength)),
        frequency,
        sampleRate,
      );
}

export function peqHeadroom(filters: readonly PeqFilter[], strength = 1): number {
  if (strength === 0 || !filters.some((f) => f.enabled)) return 0;
  let peak = 0;
  for (const sampleRate of [44100, 48000, 96000, 192000]) {
    const coefficients = filters
      .filter((f) => f.enabled)
      .map((f) => peqCoefficients(f, sampleRate, strength));
    for (let i = 0; i <= 1024; i++)
      peak = Math.max(peak, response(coefficients, 20 * 1000 ** (i / 1024), sampleRate));
    for (const filter of filters)
      peak = Math.max(peak, response(coefficients, filter.frequency, sampleRate));
  }
  return peak > 0.05 ? Math.ceil((peak + 0.5) * 10) / 10 : 0;
}

/** Strict subset of Equalizer APO/AutoEQ text; reject unsupported commands instead of ignoring them. */
export function importPeq(text: string): { filters: PeqFilter[]; preampDb: number } {
  if (text.length > 32768) throw new Error("invalid-correction");
  const filters: PeqFilter[] = [];
  let preampDb = 0;
  const types: Record<string, PeqType> = {
    PK: "peak",
    LS: "lowShelf",
    LSC: "lowShelf",
    HS: "highShelf",
    HSC: "highShelf",
    LP: "lowPass",
    HP: "highPass",
    NO: "notch",
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trim();
    if (!line) continue;
    const preamp = /^Preamp:\s*([+-]?[\d.]+)\s*dB$/i.exec(line);
    if (preamp) {
      preampDb = Number(preamp[1]);
      if (!Number.isFinite(preampDb) || preampDb < -60 || preampDb > 12)
        throw new Error("invalid-correction");
      continue;
    }
    const match =
      /^Filter\s+\d+:\s*(ON|OFF)\s+(PK|LSC?|HSC?|LP|HP|NO)\s+Fc\s+([\d.]+)\s+Hz(?:\s+Gain\s+([+-]?[\d.]+)\s+dB)?(?:\s+Q\s+([\d.]+))?$/i.exec(
        line,
      );
    if (!match) throw new Error("invalid-correction");
    const filter = {
      type: types[match[2].toUpperCase()],
      frequency: Number(match[3]),
      gain: Number(match[4] ?? 0),
      q: Number(match[5] ?? 0.7071),
      enabled: match[1].toUpperCase() === "ON",
    };
    if (
      filter.frequency < 20 ||
      filter.frequency > 20000 ||
      Math.abs(filter.gain) > 18 ||
      filter.q < 0.1 ||
      filter.q > 12 ||
      ![filter.frequency, filter.gain, filter.q].every(Number.isFinite)
    )
      throw new Error("invalid-correction");
    filters.push(filter);
  }
  if (!filters.length || filters.length > MAX_PEQ_FILTERS) throw new Error("invalid-correction");
  return { filters, preampDb };
}

export function exportPeq(filters: readonly PeqFilter[], preampDb: number): string {
  const names: Record<PeqType, string> = {
    peak: "PK",
    lowShelf: "LSC",
    highShelf: "HSC",
    lowPass: "LP",
    highPass: "HP",
    notch: "NO",
  };
  return [
    `Preamp: ${preampDb.toFixed(2)} dB`,
    ...filters.map(
      (f, i) =>
        `Filter ${i + 1}: ${f.enabled ? "ON" : "OFF"} ${names[f.type]} Fc ${f.frequency.toFixed(2)} Hz${["peak", "lowShelf", "highShelf"].includes(f.type) ? ` Gain ${f.gain.toFixed(2)} dB` : ""} Q ${f.q.toFixed(4)}`,
    ),
  ].join("\n");
}
