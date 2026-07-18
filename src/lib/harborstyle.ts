import { parseThemeJson, type CustomTheme } from "./custom-themes";
import type { ThemePreset } from "./theme";

const BLOCK_NAMES = new Set(["tokens", "css", "html", "js"]);

type ParseResult = { ok: true; theme: CustomTheme } | { ok: false; error: string };

export function isHarborStyleName(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith(".harborstyle") || lower.endsWith(".harborstyle.txt");
}

export function parseHarborStyle(text: string): ParseResult {
  const obj = harborStyleToObject(text);
  if (!obj.ok) return obj;
  return parseThemeJson(JSON.stringify(obj.value));
}

function harborStyleToObject(
  text: string,
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const noBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = noBom.replace(/\r\n/g, "\n").split("\n");
  const manifest: Record<string, string> = {};
  const blocks: Record<string, string[]> = {};
  let cur: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    const marker = trimmed.match(/^@([a-zA-Z]+)$/);
    if (marker && BLOCK_NAMES.has(marker[1].toLowerCase())) {
      cur = marker[1].toLowerCase();
      blocks[cur] = [];
      continue;
    }
    if (cur === null) {
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = line.indexOf(":");
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim().toLowerCase();
      const val = line.slice(idx + 1).trim();
      if (key) manifest[key] = val;
    } else {
      blocks[cur].push(line);
    }
  }

  const value: Record<string, unknown> = {};
  if (manifest.name) value.name = manifest.name;
  if (manifest.blurb) value.blurb = manifest.blurb;
  if (manifest.layout) value.layout = manifest.layout;
  if (manifest.card) value.cardStyle = manifest.card;
  if (manifest.button) value.buttonStyle = manifest.button;
  if (manifest.font) value.fontPair = manifest.font;
  if (manifest.bokeh) value.bokeh = manifest.bokeh === "true";
  if (manifest.swatch) {
    value.swatch = manifest.swatch
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const bg: Record<string, unknown> = {};
  if (manifest["bg-image"]) bg.image = manifest["bg-image"];
  if (manifest["bg-dim"]) {
    const dim = Number(manifest["bg-dim"]);
    if (!Number.isNaN(dim)) bg.dim = dim;
  }
  if (Object.keys(bg).length) value.background = bg;

  const logo: Record<string, unknown> = {};
  if (manifest["logo-wordmark"]) logo.wordmark = manifest["logo-wordmark"];
  if (manifest["logo-mark"]) logo.mark = manifest["logo-mark"];
  if (Object.keys(logo).length) value.logo = logo;

  const chrome: Record<string, unknown> = {};
  if (manifest["chrome-position"]) chrome.position = manifest["chrome-position"];
  if (manifest["chrome-brand"]) chrome.brand = manifest["chrome-brand"];
  if (manifest["chrome-items"]) {
    chrome.items = manifest["chrome-items"]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (Object.keys(chrome).length) value.chrome = chrome;

  const nav: Record<string, unknown> = {};
  if (manifest["nav-order"]) {
    nav.order = manifest["nav-order"]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (manifest["nav-hidden"]) {
    nav.hidden = manifest["nav-hidden"]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (manifest["nav-renamed"]) {
    const renamed: Record<string, string> = {};
    for (const pair of manifest["nav-renamed"].split(",")) {
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      const k = pair.slice(0, eq).trim();
      const v = pair.slice(eq + 1).trim();
      if (k && v) renamed[k] = v;
    }
    nav.renamed = renamed;
  }
  if (Object.keys(nav).length) value.navCustomization = nav;

  if (blocks.tokens) {
    const tokens: Record<string, string> = {};
    for (const raw of blocks.tokens) {
      const t = raw.trim();
      if (!t || t.startsWith("#")) continue;
      const idx = t.indexOf(":");
      if (idx === -1) continue;
      const k = t.slice(0, idx).trim();
      const v = t
        .slice(idx + 1)
        .trim()
        .replace(/;$/, "")
        .trim();
      if (k.startsWith("--")) tokens[k] = v;
    }
    value.tokens = tokens;
  }

  if (blocks.css) value.css = joinBlock(blocks.css);
  if (blocks.html) value.html = joinBlock(blocks.html);
  if (blocks.js) value.js = joinBlock(blocks.js);

  if (!value.name) return { ok: false, error: "This theme file is missing a name." };
  if (!value.tokens) return { ok: false, error: "This theme file is missing its colors." };
  return { ok: true, value };
}

function joinBlock(arr: string[]): string {
  return arr.join("\n").replace(/^\n+/, "").replace(/\n+$/, "");
}

export function serializeHarborStyle(theme: ThemePreset | CustomTheme): string {
  const lines: string[] = ["# Harbor Style", `name: ${theme.name}`];
  if (theme.blurb) lines.push(`blurb: ${theme.blurb}`);
  if (theme.layout) lines.push(`layout: ${theme.layout}`);
  if (theme.cardStyle) lines.push(`card: ${theme.cardStyle}`);
  if (theme.buttonStyle) lines.push(`button: ${theme.buttonStyle}`);
  if (theme.fontPair) lines.push(`font: ${theme.fontPair}`);
  if (typeof theme.bokeh === "boolean") lines.push(`bokeh: ${theme.bokeh}`);
  if (theme.swatch) lines.push(`swatch: ${theme.swatch.join(", ")}`);
  if (theme.background?.image) lines.push(`bg-image: ${theme.background.image}`);
  if (typeof theme.background?.dim === "number") lines.push(`bg-dim: ${theme.background.dim}`);
  if (theme.logo?.wordmark) lines.push(`logo-wordmark: ${theme.logo.wordmark}`);
  if (theme.logo?.mark) lines.push(`logo-mark: ${theme.logo.mark}`);
  if (theme.chrome) {
    lines.push(`chrome-position: ${theme.chrome.position}`);
    if (theme.chrome.brand) lines.push(`chrome-brand: ${theme.chrome.brand}`);
    if (theme.chrome.items.length) lines.push(`chrome-items: ${theme.chrome.items.join(", ")}`);
  }
  if (theme.navCustomization) {
    const nav = theme.navCustomization;
    if (nav.order.length) lines.push(`nav-order: ${nav.order.join(", ")}`);
    if (nav.hidden.length) lines.push(`nav-hidden: ${nav.hidden.join(", ")}`);
    const renamed = Object.entries(nav.renamed);
    if (renamed.length)
      lines.push(`nav-renamed: ${renamed.map(([k, v]) => `${k}=${v}`).join(", ")}`);
  }

  lines.push("", "@tokens");
  for (const [k, v] of Object.entries(theme.tokens)) lines.push(`${k}: ${v}`);

  const ext = theme as CustomTheme;
  if (ext.css?.trim()) lines.push("", "@css", ext.css.trimEnd());
  if (ext.html?.trim()) lines.push("", "@html", ext.html.trimEnd());
  if (ext.js?.trim()) lines.push("", "@js", ext.js.trimEnd());

  return lines.join("\n") + "\n";
}

export function harborStyleStarter(): string {
  return `# Harbor Style
name: My Theme
blurb: A short tagline shown in the picker.
layout: sidebar
card: flat
button: flat
font: sentient-switzer
bokeh: false
swatch: #0a0d14, #181d28, #7b5cff

@tokens
--color-canvas: #0a0d14
--color-surface: #11151e
--color-elevated: #181d28
--color-raised: #232936
--color-ink: #e8ebf2
--color-ink-muted: #98a0b3
--color-ink-subtle: #5f6779
--color-edge: #2c3344a0
--color-edge-soft: #2c33444d
--color-accent: #7b5cff
--color-accent-soft: #7b5cff2e
--color-danger: #ef5a5a

@css
.harbor-cinema-badge { color: #7b5cff; }
`;
}
