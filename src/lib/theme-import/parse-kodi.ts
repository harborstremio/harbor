import { chroma, flattenAlpha, parseColor, toHex6, type Rgb } from "./color-math";
import type { PaletteBucket } from "./project-palette";

const COLOR_RE = /<color\s+name\s*=\s*"([^"]+)"\s*>\s*([^<]+?)\s*<\/color>/gi;

type KodiColor = { rgb: Rgb; alpha: number };

export function looksLikeKodi(text: string, filename?: string): boolean {
  if (filename && /\.xml$/i.test(filename) && /<color\s+name=/i.test(text)) return true;
  return /<colors>/i.test(text) && /<color\s+name=/i.test(text);
}

function parseArgb(raw: string): KodiColor | null {
  const v = raw.trim();
  if (/^\$VAR\[/i.test(v) || /^\$INFO\[/i.test(v)) return null;
  const hex = v.replace(/^#/, "");
  if (/^[0-9a-fA-F]{8}$/.test(hex)) {
    const a = parseInt(hex.slice(0, 2), 16) / 255;
    const rgb = parseColor(`#${hex.slice(2)}`);
    return rgb ? { rgb: { r: rgb.r, g: rgb.g, b: rgb.b }, alpha: a } : null;
  }
  const c = parseColor(v);
  return c ? { rgb: { r: c.r, g: c.g, b: c.b }, alpha: c.a } : null;
}

function pickName(map: Map<string, KodiColor>, names: string[]): KodiColor | null {
  for (const n of names) {
    const lower = n.toLowerCase();
    for (const [k, v] of map) {
      if (k.toLowerCase() === lower) return v;
    }
  }
  return null;
}

function flatList(map: Map<string, KodiColor>, names: string[], canvas: Rgb): string[] {
  const out: string[] = [];
  for (const n of names) {
    const lower = n.toLowerCase();
    for (const [k, v] of map) {
      if (k.toLowerCase() !== lower) continue;
      out.push(
        v.alpha >= 0.999 ? toHex6(v.rgb) : toHex6(flattenAlpha({ ...v.rgb, a: v.alpha }, canvas)),
      );
    }
  }
  return out;
}

export function parseKodi(text: string, themeName = "Kodi skin"): PaletteBucket | null {
  const map = new Map<string, KodiColor>();
  let m: RegExpExecArray | null;
  while ((m = COLOR_RE.exec(text))) {
    const c = parseArgb(m[2]);
    if (c) map.set(m[1], c);
  }
  if (map.size === 0) return null;

  const canvasC =
    pickName(map, [
      "background",
      "main_bg_100",
      "Background",
      "panel_color",
      "PageBackground",
      "black",
    ]) ??
    [...map.values()].filter((v) => v.alpha >= 0.999).sort((a, b) => lum(a.rgb) - lum(b.rgb))[0] ??
    [...map.values()][0];
  const canvas = canvasC.rgb;

  const bgNames = [
    "background",
    "main_bg_100",
    "Background",
    "panel_color",
    "primary_background",
    "secondary_background",
    "dialog_tint",
    "dialog_header_tint",
    "main_back",
    "main_soft",
    "main_hard",
    "PageBackground",
    "black",
  ];
  const bg = [toHex6(canvas), ...flatList(map, bgNames, canvas)];

  const inkNames = [
    "white",
    "main_fg_100",
    "White100",
    "grey",
    "lightgrey",
    "main_fg_70",
    "White70",
    "midgrey",
    "main_fg_50",
    "main_fg_30",
    "disabled",
    "darkgrey",
  ];
  const ink = flatList(map, inkNames, canvas);

  const accentC =
    pickName(map, [
      "button_focus",
      "Highlight",
      "selected",
      "mainblue",
      "focus",
      "highlight_color",
    ]) ?? mostChromatic(map);
  const accent = accentC ? toHex6(accentC.rgb) : "#3aa0c7";

  const dangerC = pickName(map, ["invalid", "red", "error", "notification_error"]);

  const edge = firstFlat(
    map,
    ["border_alpha", "overlay_hard", "list_separator", "overlay_soft"],
    canvas,
  );

  const inkRgb = ink[0] ? parseColor(ink[0]) : null;
  const isLight = inkRgb ? lum(canvas) > lum({ r: inkRgb.r, g: inkRgb.g, b: inkRgb.b }) : undefined;

  return {
    name: themeName,
    blurb: "Imported Kodi skin palette",
    bg,
    ink,
    edge,
    accent,
    accentAlt: undefined,
    danger: dangerC ? toHex6(dangerC.rgb) : undefined,
    isLight,
  };
}

function firstFlat(map: Map<string, KodiColor>, names: string[], canvas: Rgb): string | undefined {
  const l = flatList(map, names, canvas);
  return l[0];
}

function mostChromatic(map: Map<string, KodiColor>): KodiColor | null {
  let best: KodiColor | null = null;
  let bestC = 0.05;
  for (const v of map.values()) {
    const c = chroma(v.rgb);
    if (c > bestC) {
      bestC = c;
      best = v;
    }
  }
  return best;
}

function lum(c: Rgb): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}
