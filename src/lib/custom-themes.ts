import {
  FONT_PAIRS,
  type ChromeConfig,
  type ChromeNavId,
  type FontPairId,
  type ThemePreset,
  type ThemeButtonStyle,
  type ThemeCardStyle,
  type ThemeLayout,
} from "./theme";

const STORAGE_KEY = "harbor.custom-themes.v1";
const PREFIX = "user:";
const HEX_RE = /^#[0-9a-f]{6,8}$/i;
const COLOR_FN_RE = /^(rgba?|hsla?|oklch|oklab|color)\(/i;
const isColor = (s: string) => HEX_RE.test(s) || COLOR_FN_RE.test(s);
const TOKEN_KEYS = [
  "--color-canvas",
  "--color-surface",
  "--color-elevated",
  "--color-raised",
  "--color-ink",
  "--color-ink-muted",
  "--color-ink-subtle",
  "--color-edge",
  "--color-edge-soft",
  "--color-accent",
  "--color-accent-soft",
  "--color-danger",
] as const;

export type CustomTheme = Omit<ThemePreset, "id"> & {
  id: string;
  css?: string;
  js?: string;
  html?: string;
  customFontId?: string | null;
};

const subscribers = new Set<() => void>();
let cache: CustomTheme[] | null = null;

function readRaw(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p) => isCustomTheme(p));
  } catch {
    return [];
  }
}

function writeRaw(themes: CustomTheme[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(themes));
  } catch {
    return;
  }
}

function isCustomTheme(t: unknown): t is CustomTheme {
  if (!t || typeof t !== "object") return false;
  const o = t as Partial<CustomTheme>;
  if (typeof o.id !== "string" || !o.id.startsWith(PREFIX)) return false;
  if (typeof o.name !== "string" || !o.name.trim()) return false;
  if (!Array.isArray(o.swatch) || o.swatch.length !== 3) return false;
  if (!o.swatch.every((s) => typeof s === "string")) return false;
  if (!o.tokens || typeof o.tokens !== "object") return false;
  for (const k of TOKEN_KEYS) {
    if (typeof o.tokens[k] !== "string") return false;
  }
  return true;
}

const LAYOUTS = new Set<ThemeLayout>([
  "sidebar",
  "topdock",
  "rail",
  "stremio",
  "minui",
  "dracula",
  "nord",
  "forest",
  "royal",
  "custom",
]);
const CARDS = new Set<ThemeCardStyle>(["flat", "glass", "stremio", "minui", "crunch", "noir", "custom"]);
const BUTTONS = new Set<ThemeButtonStyle>(["flat", "glossy", "minui", "crunch", "noir", "custom"]);
const asLayout = (v: unknown): ThemeLayout | undefined =>
  typeof v === "string" && (LAYOUTS as Set<string>).has(v) ? (v as ThemeLayout) : undefined;
const asCard = (v: unknown): ThemeCardStyle | undefined =>
  typeof v === "string" && (CARDS as Set<string>).has(v) ? (v as ThemeCardStyle) : undefined;
const asButton = (v: unknown): ThemeButtonStyle | undefined =>
  typeof v === "string" && (BUTTONS as Set<string>).has(v) ? (v as ThemeButtonStyle) : undefined;
const asFontPair = (v: unknown): FontPairId | undefined =>
  typeof v === "string" && v in FONT_PAIRS ? (v as FontPairId) : undefined;
const CHROME_NAV = new Set<ChromeNavId>([
  "home",
  "movies",
  "shows",
  "anime",
  "library",
  "live",
  "discover",
  "calendar",
  "settings",
]);
function parseNavMap(raw: unknown): Partial<Record<ChromeNavId, string>> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: Partial<Record<ChromeNavId, string>> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if ((CHROME_NAV as Set<string>).has(k) && typeof v === "string" && v && v.length <= 300000)
      out[k as ChromeNavId] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

function parseNavIdList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string" && !!x && x.length <= 64).slice(0, 64);
}

function parseNavCustomization(
  raw: unknown,
): { order: string[]; hidden: string[]; renamed: Record<string, string> } | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as { order?: unknown; hidden?: unknown; renamed?: unknown };
  const order = parseNavIdList(o.order);
  const hidden = parseNavIdList(o.hidden);
  const renamed: Record<string, string> = {};
  if (o.renamed && typeof o.renamed === "object") {
    for (const [k, v] of Object.entries(o.renamed as Record<string, unknown>)) {
      if (k.length <= 64 && typeof v === "string" && v && v.length <= 300) renamed[k] = v;
    }
  }
  if (!order.length && !hidden.length && !Object.keys(renamed).length) return undefined;
  return { order, hidden, renamed };
}

function parseChrome(raw: unknown): ChromeConfig | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as { position?: unknown; brand?: unknown; items?: unknown; labels?: unknown; icons?: unknown };
  const position = o.position === "topbar" ? "topbar" : "sidebar";
  const brand = typeof o.brand === "string" ? o.brand.slice(0, 40) : "";
  const items = Array.isArray(o.items)
    ? o.items.filter((x): x is ChromeNavId => typeof x === "string" && (CHROME_NAV as Set<string>).has(x))
    : [];
  const labels = parseNavMap(o.labels);
  const icons = parseNavMap(o.icons);
  const config: ChromeConfig = { position, brand, items };
  if (labels) config.labels = labels;
  if (icons) config.icons = icons;
  return config;
}

export function getCustomThemes(): CustomTheme[] {
  if (cache == null) cache = readRaw();
  return cache;
}

export function subscribeCustomThemes(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

function emit(): void {
  for (const fn of subscribers) fn();
}

export function parseThemeJson(text: string): { ok: true; theme: CustomTheme } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "This file isn't a readable theme." };
  }
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "This file isn't a Harbor theme." };
  }
  const o = raw as Partial<CustomTheme>;
  const name = typeof o.name === "string" ? o.name.trim() : "";
  if (!name) return { ok: false, error: "Theme is missing a name." };
  const blurb = typeof o.blurb === "string" ? o.blurb : "";
  const swatch = Array.isArray(o.swatch) ? o.swatch : [];
  if (swatch.length !== 3 || !swatch.every((s) => typeof s === "string" && HEX_RE.test(s))) {
    return { ok: false, error: "This theme's preview colors look invalid." };
  }
  if (!o.tokens || typeof o.tokens !== "object") {
    return { ok: false, error: "This theme is missing its colors." };
  }
  const tokens: Record<string, string> = {};
  for (const k of TOKEN_KEYS) {
    const v = (o.tokens as Record<string, unknown>)[k];
    if (typeof v !== "string" || !v.trim() || !isColor(v.trim())) {
      return { ok: false, error: `This theme is missing a color (${k}).` };
    }
    tokens[k] = v.trim();
  }
  const id = makeId(name);
  const background = parseBackground(o.background);
  const logo = parseLogo(o.logo);
  const co = o as Partial<CustomTheme>;
  const layout = asLayout(co.layout);
  const cardStyle = asCard(co.cardStyle);
  const buttonStyle = asButton(co.buttonStyle);
  const fontPair = asFontPair(co.fontPair);
  const bokeh = typeof co.bokeh === "boolean" ? co.bokeh : undefined;
  const chrome = parseChrome((co as { chrome?: unknown }).chrome);
  const navCustomization = parseNavCustomization((co as { navCustomization?: unknown }).navCustomization);
  const css = typeof co.css === "string" ? co.css : undefined;
  const js = typeof co.js === "string" ? co.js : undefined;
  const html = typeof co.html === "string" ? co.html : undefined;
  return {
    ok: true,
    theme: {
      id,
      name: name.slice(0, 60),
      blurb: blurb.slice(0, 160),
      swatch: [swatch[0], swatch[1], swatch[2]],
      tokens,
      ...(background ? { background } : {}),
      ...(logo ? { logo } : {}),
      ...(layout ? { layout } : {}),
      ...(cardStyle ? { cardStyle } : {}),
      ...(buttonStyle ? { buttonStyle } : {}),
      ...(fontPair ? { fontPair } : {}),
      ...(bokeh !== undefined ? { bokeh } : {}),
      ...(chrome ? { chrome } : {}),
      ...(navCustomization ? { navCustomization } : {}),
      ...(css ? { css } : {}),
      ...(js ? { js } : {}),
      ...(html ? { html } : {}),
    },
  };
}

function parseBackground(raw: unknown): { image: string; dim?: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { image?: unknown; dim?: unknown };
  if (typeof o.image !== "string" || !o.image.trim()) return null;
  const dim = typeof o.dim === "number" && o.dim >= 0 && o.dim <= 1 ? o.dim : undefined;
  return { image: o.image.trim(), ...(dim !== undefined ? { dim } : {}) };
}

function parseLogo(raw: unknown): { wordmark?: string; mark?: string } | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { wordmark?: unknown; mark?: unknown };
  const out: { wordmark?: string; mark?: string } = {};
  if (typeof o.wordmark === "string" && o.wordmark.trim()) out.wordmark = o.wordmark.trim();
  if (typeof o.mark === "string" && o.mark.trim()) out.mark = o.mark.trim();
  return Object.keys(out).length > 0 ? out : null;
}

function makeId(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${PREFIX}${slug}-${Date.now().toString(36)}`;
}

export function saveCustomTheme(theme: CustomTheme): void {
  const list = getCustomThemes().filter((t) => t.id !== theme.id);
  cache = [...list, theme];
  writeRaw(cache);
  emit();
}

export function removeCustomTheme(id: string): void {
  cache = getCustomThemes().filter((t) => t.id !== id);
  writeRaw(cache);
  emit();
}

export function setCustomThemePreview(id: string, previewImage: string | null): void {
  const list = getCustomThemes();
  if (!list.some((t) => t.id === id)) return;
  cache = list.map((t) => (t.id === id ? { ...t, previewImage: previewImage ?? undefined } : t));
  writeRaw(cache);
  emit();
}

export function exportThemeJson(theme: ThemePreset | CustomTheme): string {
  const out: Record<string, unknown> = {
    name: theme.name,
    blurb: theme.blurb,
    swatch: theme.swatch,
    tokens: theme.tokens,
  };
  if (theme.background) out.background = theme.background;
  if (theme.logo) out.logo = theme.logo;
  if (theme.layout) out.layout = theme.layout;
  if (theme.cardStyle) out.cardStyle = theme.cardStyle;
  if (theme.buttonStyle) out.buttonStyle = theme.buttonStyle;
  if (theme.fontPair) out.fontPair = theme.fontPair;
  if (typeof theme.bokeh === "boolean") out.bokeh = theme.bokeh;
  if (theme.chrome) out.chrome = theme.chrome;
  if (theme.navCustomization) out.navCustomization = theme.navCustomization;
  const ext = theme as CustomTheme;
  if (ext.css) out.css = ext.css;
  if (ext.js) out.js = ext.js;
  if (ext.html) out.html = ext.html;
  return JSON.stringify(out, null, 2);
}

export function getStarterTemplate(): string {
  return JSON.stringify(
    {
      name: "My theme",
      blurb: "A short tagline shown in the picker.",
      swatch: ["#0a0d14", "#181d28", "#7b5cff"],
      tokens: {
        "--color-canvas": "#0a0d14",
        "--color-surface": "#11151e",
        "--color-elevated": "#181d28",
        "--color-raised": "#232936",
        "--color-ink": "#e8ebf2",
        "--color-ink-muted": "#98a0b3",
        "--color-ink-subtle": "#5f6779",
        "--color-edge": "#2c3344a0",
        "--color-edge-soft": "#2c33444d",
        "--color-accent": "#7b5cff",
        "--color-accent-soft": "#7b5cff2e",
        "--color-danger": "#ef5a5a",
      },
      layout: "sidebar",
      cardStyle: "flat",
      buttonStyle: "flat",
      fontPair: "sentient-switzer",
      bokeh: false,
      background: {
        image: "linear-gradient(180deg, #0a0d14 0%, #181d28 100%)",
        dim: 0,
      },
      logo: {
        wordmark:
          "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgMjQiPjx0ZXh0IHg9IjAiIHk9IjE4IiBmb250LWZhbWlseT0iJ0ZyYXVuY2VzJyxzZXJpZiIgZm9udC1zaXplPSIyMiIgZmlsbD0iI2U4ZWJmMiI+TXkgVGhlbWU8L3RleHQ+PC9zdmc+",
        mark: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiM3YjVjZmYiLz48L3N2Zz4=",
      },
      css: "/* Optional: extra CSS layered on top. Targets work like a regular stylesheet. */\n.harbor-cinema-badge { color: #7b5cff; border-color: rgba(123,92,255,0.35); }",
      js: "/* Optional: runs once when this theme is applied. Wrap async with an IIFE. */\nconsole.info('[my-theme] hello from custom JS');",
      html: "<!-- Optional: HTML injected into a fixed overlay. Useful for watermark widgets. -->\n<!-- <div style='position:fixed;bottom:8px;right:8px;font-size:11px;opacity:.4;color:#fff'>built with my theme</div> -->",
    },
    null,
    2,
  );
}
