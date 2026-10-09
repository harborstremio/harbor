import type { StoreTheme } from "@/lib/theme-store";

export type Mood = "dark" | "light" | "warm" | "cool" | "vibrant" | "muted";

type Hsl = { h: number; s: number; l: number };

export function hexToHsl(hex: string): Hsl | null {
  const m = hex.replace(/^#/, "");
  if (m.length !== 3 && m.length !== 6) return null;
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

function paletteOf(theme: StoreTheme): Hsl[] {
  return theme.swatch.map(hexToHsl).filter((x): x is Hsl => x != null);
}

function avg(nums: number[]): number {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

export const MOOD_MIN = 0.12;

export function moodScores(theme: StoreTheme): Record<Mood, number> {
  const base: Record<Mood, number> = { dark: 0, light: 0, warm: 0, cool: 0, vibrant: 0, muted: 0 };
  const hsl = paletteOf(theme);
  if (!hsl.length) return base;
  const l = avg(hsl.map((c) => c.l));
  const s = avg(hsl.map((c) => c.s));
  const sat = hsl.filter((c) => c.s > 0.18);
  const warmN = sat.filter((c) => c.h < 60 || c.h > 300).length;
  const coolN = sat.filter((c) => c.h >= 150 && c.h <= 280).length;
  const denom = Math.max(1, sat.length);
  const commit = clamp01(s / 0.4);
  base.dark = clamp01((0.4 - l) / 0.4);
  base.light = clamp01((l - 0.62) / 0.38);
  base.vibrant = clamp01((s - 0.4) / 0.5);
  base.muted = clamp01((0.28 - s) / 0.28);
  base.warm = clamp01((warmN - coolN) / denom) * commit;
  base.cool = clamp01((coolN - warmN) / denom) * commit;
  return base;
}

export function moodScore(theme: StoreTheme, mood: Mood): number {
  return moodScores(theme)[mood];
}

export function themeMoods(theme: StoreTheme): Set<Mood> {
  const s = moodScores(theme);
  const out = new Set<Mood>();
  (Object.keys(s) as Mood[]).forEach((m) => {
    if (s[m] >= MOOD_MIN) out.add(m);
  });
  return out;
}

export const MOOD_RAILS: Array<{ mood: Mood; title: string; blurb: string }> = [
  { mood: "dark", title: "Dark & moody", blurb: "Deep, cinematic, easy on the eyes" },
  { mood: "vibrant", title: "Bold & vibrant", blurb: "Saturated, loud, unmissable" },
  { mood: "warm", title: "Warm & cozy", blurb: "Ambers, reds, sunset tones" },
  { mood: "cool", title: "Cool & calm", blurb: "Blues, teals, quiet focus" },
  { mood: "muted", title: "Muted & minimal", blurb: "Restrained, understated palettes" },
  { mood: "light", title: "Bright & airy", blurb: "Clean, luminous, high-key" },
];

function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function paletteDistance(a: StoreTheme, target: Hsl): number {
  const hsl = paletteOf(a);
  if (!hsl.length) return 999;
  return Math.min(
    ...hsl.map((c) => hueDist(c.h, target.h) / 180 + Math.abs(c.l - target.l) + Math.abs(c.s - target.s)),
  );
}

export function accentHsl(hex: string): Hsl | null {
  return hexToHsl(hex);
}

export function rankByPalette(themes: StoreTheme[], target: Hsl): StoreTheme[] {
  return [...themes].sort((a, b) => paletteDistance(a, target) - paletteDistance(b, target));
}
