import { chroma, hue, isLight as rgbIsLight, parseColor } from "./color-math";
import type { PaletteBucket } from "./project-palette";

const BG_KEYS = [
  "player",
  "shadow",
  "sidebar",
  "main",
  "card",
  "main-elevated",
  "tab-active",
  "background",
  "secondary",
  "crust",
  "mantle",
  "base",
  "surface0",
  "surface1",
];
const INK_KEYS = ["text", "subtext", "selected-row", "overlay2", "overlay1", "overlay0", "subtext1", "button-disabled"];

export function looksLikeSpicetify(text: string, filename?: string): boolean {
  if (filename && /\.ini$/i.test(filename) && /\[[^\]]+\]/.test(text)) return true;
  if (!/\[[^\]]+\]/m.test(text)) return false;
  return /(?:^|\n)\s*(text|main|sidebar|player|button|subtext)\s*=/i.test(text);
}

function normHex(raw: string): string | null {
  const v = raw.split(";")[0].trim();
  if (!v) return null;
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`;
  if (/^#[0-9a-fA-F]{6}$/.test(v)) return v.toLowerCase();
  const dec = parseColor(v);
  return dec ? `#${[dec.r, dec.g, dec.b].map((n) => n.toString(16).padStart(2, "0")).join("")}` : null;
}

function sectionsOf(text: string): Array<{ name: string; map: Record<string, string> }> {
  const out: Array<{ name: string; map: Record<string, string> }> = [];
  let cur: { name: string; map: Record<string, string> } | null = null;
  for (const line of text.split(/\r?\n/)) {
    const head = line.match(/^\s*\[([^\]]+)\]\s*$/);
    if (head) {
      cur = { name: head[1].trim(), map: {} };
      out.push(cur);
      continue;
    }
    if (!cur) continue;
    const kv = line.match(/^\s*([a-z0-9-]+)\s*=\s*(.+)$/i);
    if (!kv) continue;
    const hex = normHex(kv[2]);
    if (hex) cur.map[kv[1].toLowerCase()] = hex;
  }
  return out;
}

function pickAccent(map: Record<string, string>, exclude?: string): { accent: string; accentAlt?: string } {
  const ex = exclude?.toLowerCase();
  const entries = Object.entries(map)
    .map(([k, v]) => ({ k, v, rgb: parseColor(v) }))
    .filter((e) => e.rgb && chroma(e.rgb) > 0.04 && e.v.toLowerCase() !== ex)
    .sort((a, b) => chroma(b.rgb!) - chroma(a.rgb!));
  if (entries.length === 0) return { accent: map.button ?? map.text ?? "#7b5cff" };
  const accent = entries[0];
  const alt = entries.find((e) => Math.abs(hue(e.rgb!) - hue(accent.rgb!)) > 40);
  return { accent: accent.v, accentAlt: alt?.v };
}

function bucketFor(schemeName: string, themeName: string, map: Record<string, string>): PaletteBucket | null {
  const present = (keys: string[]) => keys.map((k) => map[k]).filter(Boolean);
  const bgAll = present(BG_KEYS);
  if (bgAll.length === 0 || !map.text) return null;

  const light =
    /latte|light|day|dawn/i.test(schemeName) ||
    (parseColor(map.main ?? bgAll[0]) ? rgbIsLight(parseColor(map.main ?? bgAll[0])!) : false);
  const ranked = bgAll
    .map((h) => ({ h, rgb: parseColor(h)! }))
    .sort((a, b) => (light ? bLum(b.rgb) - bLum(a.rgb) : bLum(a.rgb) - bLum(b.rgb)));
  const bg = ranked.map((r) => r.h);

  const danger = map["notification-error"] ?? map.red ?? map.notification;
  const { accent, accentAlt } = pickAccent(map, danger);
  const label = schemeName && schemeName.toLowerCase() !== "base" ? `${themeName} ${schemeName}` : themeName;

  return {
    name: label,
    blurb: "Imported Spicetify scheme",
    bg,
    ink: present(INK_KEYS),
    edge: map.misc ?? map["highlight-elevated"] ?? map["selected-row"],
    accent,
    accentAlt,
    danger,
    isLight: light,
  };
}

function bLum(c: { r: number; g: number; b: number }): number {
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
}

export function parseSpicetify(text: string, themeName = "Spicetify"): PaletteBucket[] {
  const out: PaletteBucket[] = [];
  for (const sec of sectionsOf(text)) {
    if (Object.keys(sec.map).length < 3) continue;
    const b = bucketFor(sec.name, themeName, sec.map);
    if (b) out.push(b);
  }
  return out;
}
