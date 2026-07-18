import { chroma, parseColor } from "./color-math";
import type { PaletteBucket } from "./project-palette";

const SLOT_RE = /(?:^|\n)\s*["']?(base[0-9a-f]{2})["']?\s*:\s*["']?#?([0-9a-fA-F]{6})["']?/gi;

export function looksLikeBase16(text: string, filename?: string): boolean {
  if (filename && !/\.(ya?ml|json)$/i.test(filename)) {
    if (!/system\s*:\s*["']?base(16|24)/i.test(text)) return false;
  }
  if (/system\s*:\s*["']?base(16|24)/i.test(text)) return true;
  return (
    /(?:^|\n)\s*["']?base00["']?\s*:/i.test(text) && /(?:^|\n)\s*["']?base0d["']?\s*:/i.test(text)
  );
}

export function parseBase16(text: string): PaletteBucket | null {
  const slots: Record<string, string> = {};
  let m: RegExpExecArray | null;
  while ((m = SLOT_RE.exec(text))) {
    slots[m[1].toLowerCase()] = `#${m[2].toLowerCase()}`;
  }
  if (!slots.base00 || !slots.base05) return null;

  const nameMatch = text.match(
    /(?:^|\n)\s*(?:name|scheme)\s*:\s*["']?([^"'\n]+?)["']?\s*(?:\n|$)/i,
  );
  const authorMatch = text.match(/(?:^|\n)\s*author\s*:\s*["']?([^"'\n]+?)["']?\s*(?:\n|$)/i);
  const variantMatch = text.match(/(?:^|\n)\s*variant\s*:\s*["']?(light|dark)/i);
  const name = (nameMatch?.[1] ?? "Base16 theme").trim();
  const isLight = variantMatch ? variantMatch[1].toLowerCase() === "light" : undefined;

  const has24 = !!slots.base10 || !!slots.base11;
  const bg: string[] = [];
  if (has24 && isLight !== true) {
    if (slots.base11) bg.push(slots.base11);
    if (slots.base10) bg.push(slots.base10);
  }
  bg.push(slots.base00, slots.base01, slots.base02, slots.base03);

  const accentPool = ["base08", "base09", "base0a", "base0b", "base0c", "base0e"]
    .map((k) => slots[k])
    .filter(Boolean);
  let accentAlt = slots.base0d;
  let best = -1;
  for (const c of accentPool) {
    const rgb = parseColor(c);
    if (!rgb) continue;
    const ch = chroma(rgb);
    if (ch > best) {
      best = ch;
      accentAlt = c;
    }
  }

  return {
    name,
    blurb: authorMatch ? `Base16 by ${authorMatch[1].trim()}` : "Imported Base16 palette",
    bg: bg.filter(Boolean),
    ink: [slots.base05, slots.base04, slots.base03].filter(Boolean),
    edge: slots.base02,
    accent: slots.base0d ?? accentAlt ?? slots.base05,
    accentAlt,
    danger: slots.base08,
    isLight,
  };
}
