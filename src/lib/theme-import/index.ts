import type { CustomTheme } from "../custom-themes";
import type { ThemeCardStyle } from "../theme";
import { looksLikeBase16, parseBase16 } from "./parse-base16";
import { looksLikeKodi, parseKodi } from "./parse-kodi";
import { looksLikeSpicetify, parseSpicetify } from "./parse-spicetify";
import { projectPalette, type PaletteBucket } from "./project-palette";

export type ForeignImport = { ok: true; themes: CustomTheme[]; format: string } | { ok: false; error: string };

const PREFIX = "user:";

function makeId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${PREFIX}${slug || "theme"}-${Date.now().toString(36)}-${Math.floor(performance.now() % 1000)}`;
}

function toTheme(bucket: PaletteBucket): CustomTheme {
  const projected = projectPalette(bucket);
  const theme: CustomTheme = {
    id: makeId(bucket.name),
    name: bucket.name.slice(0, 60) || "Imported theme",
    blurb: (bucket.blurb ?? "Imported theme").slice(0, 160),
    swatch: projected.swatch,
    tokens: projected.tokens,
  };
  if (bucket.background) theme.background = bucket.background;
  if (bucket.cardStyle) theme.cardStyle = bucket.cardStyle as ThemeCardStyle;
  return theme;
}

function baseName(filename?: string): string {
  if (!filename) return "";
  return filename
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]/g, " ")
    .replace(/\bcolor(s|scheme)?\b/gi, "")
    .trim();
}

export function importForeignTheme(text: string, filename?: string): ForeignImport {
  const label = baseName(filename);

  if (looksLikeBase16(text, filename)) {
    const bucket = parseBase16(text);
    if (!bucket) return { ok: false, error: "This looks like a Base16 scheme but its colors couldn't be read." };
    if (label) bucket.name = label;
    return { ok: true, themes: [toTheme(bucket)], format: "Base16" };
  }

  if (looksLikeSpicetify(text, filename)) {
    const buckets = parseSpicetify(text, label || "Spicetify");
    if (buckets.length === 0) {
      return { ok: false, error: "This looks like a Spicetify color.ini but no readable schemes were found." };
    }
    return { ok: true, themes: buckets.map(toTheme), format: "Spicetify" };
  }

  if (looksLikeKodi(text, filename)) {
    const bucket = parseKodi(text, label || "Kodi skin");
    if (!bucket) return { ok: false, error: "This looks like a Kodi colors file but no <color> entries parsed." };
    return { ok: true, themes: [toTheme(bucket)], format: "Kodi" };
  }

  return {
    ok: false,
    error: "Unrecognized theme format. Harbor imports its own themes plus Base16, Spicetify, and Kodi color files.",
  };
}
