import {
  chroma,
  darken,
  isLight as rgbIsLight,
  isRedHue,
  lighten,
  mix,
  parseColor,
  relLum,
  toHex6,
  withAlpha,
  type Rgb,
} from "./color-math";

export type PaletteBucket = {
  name: string;
  blurb?: string;
  bg: string[];
  ink: string[];
  edge?: string;
  accent: string;
  accentAlt?: string;
  danger?: string;
  isLight?: boolean;
  background?: { image: string; dim?: number };
  cardStyle?: string;
};

export type ProjectedTheme = {
  swatch: [string, string, string];
  tokens: Record<string, string>;
};

const TONE = (r: Rgb) => relLum(r);

function distinctByHex(colors: Rgb[]): Rgb[] {
  const seen = new Set<string>();
  const out: Rgb[] = [];
  for (const c of colors) {
    const k = toHex6(c);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
  }
  return out;
}

function parseList(list: string[]): Rgb[] {
  const out: Rgb[] = [];
  for (const s of list) {
    const c = parseColor(s);
    if (c) out.push({ r: c.r, g: c.g, b: c.b });
  }
  return out;
}

function elevation(bg: Rgb[], light: boolean): [Rgb, Rgb, Rgb, Rgb] {
  const canvas = bg[0] ?? { r: 16, g: 18, b: 24 };
  const pool = distinctByHex(bg.slice(1).filter((c) => toHex6(c) !== toHex6(canvas)));
  pool.sort((a, b) => (light ? TONE(b) - TONE(a) : TONE(a) - TONE(b)));

  if (pool.length >= 3) return [canvas, pool[0], pool[1], pool[2]];
  if (pool.length === 2) {
    const raised = light ? darken(pool[1], 0.05) : lighten(pool[1], 0.05);
    return [canvas, pool[0], pool[1], raised];
  }
  if (pool.length === 1) {
    const raised = pool[0];
    return [canvas, mix(canvas, raised, 0.34), mix(canvas, raised, 0.67), raised];
  }
  const step = (d: number) => (light ? darken(canvas, d) : lighten(canvas, d));
  return [canvas, step(0.04), step(0.08), step(0.13)];
}

function textLadder(ink: Rgb[], canvas: Rgb, light: boolean): [Rgb, Rgb, Rgb] {
  const pool = distinctByHex(ink);
  const primary = pool[0] ?? (light ? { r: 20, g: 20, b: 24 } : { r: 240, g: 240, b: 245 });
  const muted = pool[1] ?? (light ? darken(primary, 0.18) : mix(primary, canvas, 0.25));
  const subtle = pool[2] ?? (light ? darken(primary, 0.34) : mix(primary, canvas, 0.45));
  return [primary, muted, subtle];
}

export function projectPalette(bucket: PaletteBucket): ProjectedTheme {
  const bg = parseList(bucket.bg);
  const ink = parseList(bucket.ink);
  const canvasSeed = bg[0] ?? ink[0] ?? { r: 16, g: 18, b: 24 };
  const light = bucket.isLight ?? rgbIsLight(canvasSeed);

  const [canvas, surface, elevated, raised] = elevation(bg, light);
  const [primaryInk, mutedInk, subtleInk] = textLadder(ink, canvas, light);

  const edgeBase = bucket.edge ? parseColor(bucket.edge) : light ? mix(canvas, primaryInk, 0.7) : raised;
  const edgeRgb = edgeBase
    ? { r: edgeBase.r, g: edgeBase.g, b: edgeBase.b }
    : light
      ? mix(canvas, primaryInk, 0.7)
      : raised;
  const edgeHex = toHex6(edgeRgb);
  const edgeStrong = light ? 0.16 : 0.55;
  const edgeFaint = light ? 0.08 : 0.25;

  let accentRgb = parseColor(bucket.accent) ?? primaryInk;
  const accentAlt = bucket.accentAlt ? parseColor(bucket.accentAlt) : null;
  if (chroma(accentRgb) < 0.03 && accentAlt && chroma(accentAlt) > chroma(accentRgb)) {
    accentRgb = accentAlt;
  }
  const accentHex = toHex6(accentRgb);

  const dangerParsed = bucket.danger ? parseColor(bucket.danger) : null;
  const dangerHex = dangerParsed && isRedHue(dangerParsed) ? toHex6(dangerParsed) : light ? "#dc2626" : "#ef5a5a";

  const tokens: Record<string, string> = {
    "--color-canvas": toHex6(canvas),
    "--color-surface": toHex6(surface),
    "--color-elevated": toHex6(elevated),
    "--color-raised": toHex6(raised),
    "--color-ink": toHex6(primaryInk),
    "--color-ink-muted": toHex6(mutedInk),
    "--color-ink-subtle": toHex6(subtleInk),
    "--color-edge": withAlpha(edgeHex, edgeStrong),
    "--color-edge-soft": withAlpha(edgeHex, edgeFaint),
    "--color-accent": accentHex,
    "--color-accent-soft": withAlpha(accentHex, 0.18),
    "--color-danger": dangerHex,
  };

  return {
    swatch: [toHex6(canvas), accentHex, toHex6(primaryInk)],
    tokens,
  };
}
