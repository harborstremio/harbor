import type { StoreTheme } from "@/lib/theme-store";
import type { ThemePreset } from "@/lib/theme";
import { hexToHsl } from "../color-rank";

export type FitTokens = Record<string, string>;

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = ((((h % 360) + 360) % 360) / 60);
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = l - c / 2;
  const to = (v: number) =>
    Math.round(clamp01(v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace(/^#/, "");
  const full = m.length === 3 ? m.split("").map((ch) => ch + ch).join("") : m;
  if (full.length !== 6) return null;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return [r, g, b];
}

function lighten(hex: string, amount: number): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return hex;
  return hslToHex(hsl.h, hsl.s, clamp01(hsl.l + amount));
}

function readableInk(hex: string): string {
  const hsl = hexToHsl(hex);
  if (!hsl) return "#f4f4f5";
  return hsl.l < 0.52
    ? hslToHex(hsl.h, Math.min(hsl.s, 0.1), 0.96)
    : hslToHex(hsl.h, Math.min(hsl.s, 0.18), 0.13);
}

function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

export function tokensFromStoreTheme(t: StoreTheme): FitTokens {
  const sw = Array.isArray(t.swatch) ? t.swatch.filter((c): c is string => typeof c === "string") : [];
  const canvas = sw[0] ?? "#20222a";
  const surface = sw[1] ?? lighten(canvas, 0.05);
  const accent = sw[2] ?? sw[1] ?? "#8b8f98";
  const elevated = lighten(surface, 0.06);
  const raised = lighten(surface, 0.12);
  const ink = readableInk(canvas);
  return {
    "--color-canvas": canvas,
    "--color-surface": surface,
    "--color-elevated": elevated,
    "--color-raised": raised,
    "--color-ink": ink,
    "--color-ink-muted": withAlpha(ink, 0.68),
    "--color-ink-subtle": withAlpha(ink, 0.42),
    "--color-edge": withAlpha(ink, 0.16),
    "--color-edge-soft": withAlpha(ink, 0.08),
    "--color-accent": accent,
    "--color-accent-soft": withAlpha(accent, 0.2),
  };
}

export function tokensFromPreset(t: ThemePreset): FitTokens {
  return { ...t.tokens };
}
