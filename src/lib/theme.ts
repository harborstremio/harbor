import auroraPreview from "@/assets/theme-previews/aurora.png";
import crunchPreview from "@/assets/theme-previews/crunchy.png";
import draculaPreview from "@/assets/theme-previews/dracula.png";
import forestPreview from "@/assets/theme-previews/forest.png";
import harborPreview from "@/assets/theme-previews/harbor.png";
import minuiPreview from "@/assets/theme-previews/minui.png";
import noirPreview from "@/assets/theme-previews/noir.png";
import nordPreview from "@/assets/theme-previews/nord.png";
import royalPreview from "@/assets/theme-previews/royal.png";
import stremioPreview from "@/assets/theme-previews/stremio.png";
import velvetPreview from "@/assets/theme-previews/velvet.png";
import { getCustomThemes } from "./custom-themes";

export type ThemePresetId =
  | "cool-grey"
  | "nord"
  | "stremio"
  | "crunch"
  | "tokyo-night"
  | "dracula"
  | "forest"
  | "noir";

export type ThemeLayout =
  | "sidebar"
  | "topdock"
  | "rail"
  | "stremio"
  | "minui"
  | "dracula"
  | "nord"
  | "forest"
  | "royal"
  | "cinematic"
  | "custom";
export type ThemeCardStyle = "flat" | "glass" | "stremio" | "minui" | "crunch" | "noir" | "custom";
export type ThemeButtonStyle = "flat" | "glossy" | "minui" | "crunch" | "noir" | "custom";

export type ActiveThemeId = ThemePresetId | "custom" | `user:${string}`;

export type FontPairId =
  | "sentient-switzer"
  | "fraunces-inter"
  | "general-sans"
  | "cabinet-switzer"
  | "plex"
  | "plus-jakarta"
  | "system";

export type ThemeBackground = {
  image: string;
  dim?: number;
};

export type ThemeLogo = {
  wordmark?: string;
  mark?: string;
};

export type ChromeNavId =
  | "home"
  | "movies"
  | "shows"
  | "anime"
  | "library"
  | "live"
  | "discover"
  | "calendar"
  | "settings";

export type ChromeConfig = {
  position: "sidebar" | "topbar";
  brand: string;
  items: ChromeNavId[];
  labels?: Partial<Record<ChromeNavId, string>>;
  icons?: Partial<Record<ChromeNavId, string>>;
};

export type ThemePreset = {
  id: ThemePresetId;
  name: string;
  blurb: string;
  swatch: [string, string, string];
  tokens: Record<string, string>;
  background?: ThemeBackground;
  logo?: ThemeLogo;
  layout?: ThemeLayout;
  cardStyle?: ThemeCardStyle;
  buttonStyle?: ThemeButtonStyle;
  bokeh?: boolean;
  chrome?: ChromeConfig;
  navCustomization?: {
    order: string[];
    hidden: string[];
    renamed: Record<string, string>;
  };
  previewImage?: string;
  fontPair?: FontPairId;
  css?: string;
  js?: string;
  html?: string;
};

export type FontPair = {
  id: FontPairId;
  name: string;
  blurb: string;
  display: string;
  sans: string;
};

export const THEME_PRESETS: Record<ThemePresetId, ThemePreset> = {
  "cool-grey": {
    id: "cool-grey",
    name: "Harbor default",
    blurb: "What ships out of the box.",
    previewImage: harborPreview,
    swatch: ["#2c2e36", "#3a3d47", "#dcdde4"],
    tokens: {
      "--color-canvas": "oklch(0.18 0.004 260)",
      "--color-surface": "oklch(0.22 0.004 260)",
      "--color-elevated": "oklch(0.27 0.004 260)",
      "--color-raised": "oklch(0.32 0.004 260)",
      "--color-ink": "oklch(0.97 0.003 260)",
      "--color-ink-muted": "oklch(0.72 0.003 260)",
      "--color-ink-subtle": "oklch(0.50 0.003 260)",
      "--color-edge": "oklch(0.36 0.004 260 / 0.55)",
      "--color-edge-soft": "oklch(0.36 0.004 260 / 0.25)",
      "--color-accent": "oklch(0.78 0.13 60)",
      "--color-accent-soft": "oklch(0.78 0.13 60 / 0.18)",
      "--color-danger": "oklch(0.55 0.18 25)",
    },
  },
  nord: {
    id: "nord",
    name: "Nord",
    blurb: "Cool grey-blue. Arctic and crisp.",
    previewImage: nordPreview,
    swatch: ["#2e3440", "#434c5e", "#88c0d0"],
    tokens: {
      "--color-canvas": "#2e3440",
      "--color-surface": "#353a47",
      "--color-elevated": "#3b4252",
      "--color-raised": "#434c5e",
      "--color-ink": "#eceff4",
      "--color-ink-muted": "#d8dee9",
      "--color-ink-subtle": "#8b95a4",
      "--color-edge": "#4c566a8c",
      "--color-edge-soft": "#4c566a40",
      "--color-accent": "#88c0d0",
      "--color-accent-soft": "#88c0d02e",
      "--color-danger": "#bf616a",
    },
    layout: "nord",
  },
  stremio: {
    id: "stremio",
    name: "Stremio",
    blurb: "Purple accent, Indigo gradient, Narrow icon rail.",
    previewImage: stremioPreview,
    swatch: ["#0c0b11", "#1a173e", "#7b5bf5"],
    tokens: {
      "--color-canvas": "#0c0b11",
      "--color-surface": "#181434",
      "--color-elevated": "#1f1b3f",
      "--color-raised": "#2a2358",
      "--color-ink": "rgba(255,255,255,0.9)",
      "--color-ink-muted": "rgba(255,255,255,0.6)",
      "--color-ink-subtle": "rgba(255,255,255,0.35)",
      "--color-edge": "rgba(255,255,255,0.14)",
      "--color-edge-soft": "rgba(255,255,255,0.06)",
      "--color-accent": "#7b5bf5",
      "--color-accent-soft": "rgba(123,91,245,0.18)",
      "--color-danger": "#dc2626",
    },
    background: {
      image: "linear-gradient(41deg, #0c0b11 0%, #1a173e 100%)",
      dim: 0,
    },
    layout: "stremio",
    cardStyle: "stremio",
    fontPair: "plus-jakarta",
  },
  crunch: {
    id: "crunch",
    name: "Crunchy",
    blurb: "Charcoal chrome with a spice-orange accent. Bold and clean.",
    previewImage: crunchPreview,
    swatch: ["#000000", "#272727", "#ff640a"],
    tokens: {
      "--color-canvas": "#000000",
      "--color-surface": "#151515",
      "--color-elevated": "#272727",
      "--color-raised": "#414141",
      "--color-ink": "#ffffff",
      "--color-ink-muted": "#bbbbbb",
      "--color-ink-subtle": "#8c8c8c",
      "--color-edge": "rgba(255,255,255,0.10)",
      "--color-edge-soft": "rgba(255,255,255,0.05)",
      "--color-accent": "#ff640a",
      "--color-accent-soft": "rgba(255,100,10,0.18)",
      "--color-danger": "#c13937",
    },
    background: {
      image: "linear-gradient(180deg, #000 0%, #000 100%)",
      dim: 0,
    },
    layout: "topdock",
    cardStyle: "crunch",
    buttonStyle: "crunch",
    fontPair: "plus-jakarta",
  },
  "tokyo-night": {
    id: "tokyo-night",
    name: "Royal",
    blurb: "Deep navy with a warm orange accent.",
    previewImage: royalPreview,
    swatch: ["#0c1118", "#1c2230", "#f08032"],
    tokens: {
      "--color-canvas": "#0c1118",
      "--color-surface": "#141a24",
      "--color-elevated": "#1c2230",
      "--color-raised": "#262d3d",
      "--color-ink": "#f5f6fa",
      "--color-ink-muted": "#b8bcca",
      "--color-ink-subtle": "#6d7384",
      "--color-edge": "#2e3647a0",
      "--color-edge-soft": "#2e36474d",
      "--color-accent": "#f08032",
      "--color-accent-soft": "#f080322e",
      "--color-danger": "#ef5a5a",
    },
    layout: "royal",
  },
  dracula: {
    id: "dracula",
    name: "Dracula",
    blurb: "Violet on graphite, bold accents. Easy on the eyes.",
    previewImage: draculaPreview,
    swatch: ["#282a36", "#44475a", "#bd93f9"],
    tokens: {
      "--color-canvas": "#282a36",
      "--color-surface": "#21222c",
      "--color-elevated": "#44475a",
      "--color-raised": "#565969",
      "--color-ink": "#f8f8f2",
      "--color-ink-muted": "#d6d6d0",
      "--color-ink-subtle": "#6272a4",
      "--color-edge": "#6272a48c",
      "--color-edge-soft": "#6272a440",
      "--color-accent": "#bd93f9",
      "--color-accent-soft": "#bd93f92e",
      "--color-danger": "#ff5555",
    },
    layout: "dracula",
  },
  forest: {
    id: "forest",
    name: "Forest",
    blurb: "Greens, low saturation.",
    previewImage: forestPreview,
    swatch: ["#1a221d", "#26312a", "#dde7df"],
    tokens: {
      "--color-canvas": "oklch(0.18 0.018 145)",
      "--color-surface": "oklch(0.22 0.020 145)",
      "--color-elevated": "oklch(0.26 0.024 145)",
      "--color-raised": "oklch(0.31 0.026 145)",
      "--color-ink": "oklch(0.97 0.012 140)",
      "--color-ink-muted": "oklch(0.74 0.020 140)",
      "--color-ink-subtle": "oklch(0.52 0.022 140)",
      "--color-edge": "oklch(0.38 0.028 145 / 0.55)",
      "--color-edge-soft": "oklch(0.38 0.028 145 / 0.25)",
      "--color-accent": "oklch(0.80 0.15 145)",
      "--color-accent-soft": "oklch(0.80 0.15 145 / 0.18)",
      "--color-danger": "oklch(0.58 0.20 25)",
    },
    layout: "forest",
  },
  noir: {
    id: "noir",
    name: "Noir",
    blurb: "Pure black. Clean.",
    previewImage: noirPreview,
    swatch: ["#000000", "#0a0a0a", "#ffffff"],
    tokens: {
      "--color-canvas": "#000000",
      "--color-surface": "#070707",
      "--color-elevated": "#0e0e0e",
      "--color-raised": "#1a1a1a",
      "--color-ink": "#f5f5f5",
      "--color-ink-muted": "#9a9a9a",
      "--color-ink-subtle": "#555555",
      "--color-edge": "rgba(255,255,255,0.08)",
      "--color-edge-soft": "rgba(255,255,255,0.03)",
      "--color-accent": "#ffffff",
      "--color-accent-soft": "rgba(255,255,255,0.10)",
      "--color-danger": "#b94545",
    },
    background: {
      image: "linear-gradient(180deg, #000 0%, #000 100%)",
      dim: 0,
    },
    layout: "topdock",
    cardStyle: "noir",
    buttonStyle: "noir",
    fontPair: "general-sans",
  },
};

const elegantFinCss = `@import url("https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap");

/* ==========================================================================
   ElegantFin for Harbor  (after lscambo13's ElegantFin Jellyfin theme)
   Dark navy glass, one purple accent, 1em rounded cards, white shine-sweep,
   Inter 425 body / 600 headings, calm 125ms motion, hairline + blur structure.
   Injected raw into <style id="harbor-theme-css"> so !important + any selector wins.
   ========================================================================== */

:root {
  --color-canvas: #111827;
  --color-surface: #1f2937;
  --color-elevated: #1e2836;
  --color-raised: #374151;
  --color-ink: #d1d5db;
  --color-ink-muted: #9ca3af;
  --color-ink-subtle: #6b7280;
  --color-edge: #47505ce6;
  --color-edge-soft: #47505c66;
  --color-accent: #775bf4;
  --color-accent-soft: #775bf42e;
  --color-danger: #a91d1d;

  --ef-accent-strong: rgba(119, 91, 244, 0.9);
  --ef-ui-accent: #756fe2;
  --ef-header-glass: rgba(30, 40, 54, 0.8);
  --ef-drawer-glass: rgba(30, 40, 54, 0.92);
  --ef-panel-glass: rgba(30, 40, 54, 0.95);
  --ef-hairline: #47505c;
  --ef-border-w: 0.06em;
  --ef-shine: linear-gradient(
    0deg,
    transparent 0%,
    rgba(255, 255, 255, 0.34) 45%,
    rgba(255, 255, 255, 0.34) 55%,
    transparent 100%
  );
  --ef-btn-green: #299a5d;
  --ef-btn-green-edge: #32a769;
  --ef-shadow: 0.1em 0.1em 0.15em rgba(0, 0, 0, 0.3);

  --poster-radius: 1em;

  --font-display: "Inter", system-ui, sans-serif;
  --font-sans: "Inter", system-ui, sans-serif;
}

body {
  font-weight: 425;
  letter-spacing: 0.003em;
}

/* ==========================================================================
   SIDEBAR / LEFT DRAWER  (glass rgba(30,40,54,.9)+blur10, right hairline, no radius)
   ========================================================================== */
aside[data-harbor-sidebar] {
  background-color: var(--ef-drawer-glass) !important;
  background-image: none !important;
  backdrop-filter: blur(14px) saturate(120%);
  -webkit-backdrop-filter: blur(14px) saturate(120%);
  border-inline-end: var(--ef-border-w) solid var(--ef-hairline) !important;
  border-radius: 0 !important;
  position: fixed !important;
  inset-block: 0 !important;
  inset-inline-start: 0 !important;
  z-index: 120 !important;
  width: 260px !important;
  transform: translateX(-103%);
  transition: transform 170ms ease !important;
  box-shadow: 0.5em 0 2.5em rgba(0, 0, 0, 0.5);
}
html[dir="rtl"] aside[data-harbor-sidebar] {
  transform: translateX(103%);
}
html.ef-drawer-open aside[data-harbor-sidebar],
html[dir="rtl"].ef-drawer-open aside[data-harbor-sidebar] {
  transform: translateX(0);
}
aside[data-harbor-sidebar] [data-tauri-drag-region] > span {
  font-family: "Inter", system-ui, sans-serif !important;
  font-size: 26px !important;
  font-weight: 600 !important;
  letter-spacing: -0.02em !important;
  transform: translateY(0) !important;
  color: var(--color-ink) !important;
}
aside[data-harbor-sidebar] [data-tauri-drag-region] > span > span {
  transform: none !important;
  transform-origin: center !important;
}
[data-harbor-nav] {
  border-radius: var(--largeRadius, 0.6em) !important;
  font-weight: 500 !important;
  letter-spacing: -0.005em;
  color: var(--color-ink-muted);
  transition: background-color 125ms ease, color 125ms ease, box-shadow 125ms ease !important;
}
[data-harbor-nav]:hover {
  background-color: color-mix(in srgb, var(--color-raised) 42%, transparent) !important;
  color: var(--color-ink) !important;
}
[data-harbor-nav][data-active] {
  background-color: var(--color-accent-soft) !important;
  color: var(--color-accent) !important;
  box-shadow: inset 0 0 0 var(--ef-border-w) color-mix(in srgb, var(--color-accent) 55%, transparent) !important;
}
[data-harbor-nav][data-active]:hover {
  background-color: color-mix(in srgb, var(--color-accent) 24%, transparent) !important;
  color: var(--color-accent) !important;
}
aside[data-harbor-sidebar].w-\[72px\] [data-harbor-nav][data-active],
html:not(.lg) [data-harbor-nav][data-active] {
  box-shadow: inset 0 0 0 var(--ef-border-w) color-mix(in srgb, var(--color-accent) 55%, transparent) !important;
}
aside[data-harbor-sidebar] .h-px.bg-gradient-to-r {
  background-image: linear-gradient(
    to right,
    transparent,
    color-mix(in srgb, var(--ef-hairline) 70%, transparent) 50%,
    transparent
  ) !important;
}
aside[data-harbor-sidebar] > div:last-child .rounded-full.border,
aside[data-harbor-sidebar] > div:last-child .bg-elevated\/50 {
  background-color: color-mix(in srgb, var(--color-raised) 40%, transparent) !important;
  border-color: color-mix(in srgb, var(--ef-hairline) 80%, transparent) !important;
}

/* ==========================================================================
   TOP HEADER BAR  (glass it: blur10 + bottom hairline on the inner grid)
   ========================================================================== */
header.fixed.inset-x-0.top-0 > div {
  background-color: transparent !important;
  background-image: none !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  border-bottom: 0 !important;
  padding-inline-start: 4.25rem !important;
}
.harbor-search-pill {
  background-color: color-mix(in srgb, var(--color-raised) 45%, transparent) !important;
  background-image: none !important;
  border: var(--ef-border-w) solid color-mix(in srgb, #ffffff 16%, transparent) !important;
  border-radius: 4em !important;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  opacity: 1 !important;
  transition: background-color 125ms ease, border-color 125ms ease !important;
}
.harbor-search-pill:hover {
  background-color: color-mix(in srgb, var(--color-raised) 62%, transparent) !important;
  border-color: color-mix(in srgb, #ffffff 26%, transparent) !important;
}
.harbor-search-pill kbd {
  border-color: color-mix(in srgb, var(--ef-hairline) 70%, transparent) !important;
  background-color: color-mix(in srgb, var(--color-canvas) 55%, transparent) !important;
}
.harbor-win-control {
  background-color: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  border-radius: 999px !important;
  color: var(--color-ink-muted) !important;
  transition: background-color 125ms ease, color 125ms ease !important;
}
.harbor-win-control:hover {
  background-color: rgba(255, 255, 255, 0.1) !important;
  color: var(--color-ink) !important;
}
.harbor-win-close:hover {
  background-color: var(--color-danger) !important;
  color: #ffffff !important;
}
.harbor-together-btn:not(.harbor-wt-tab) {
  background-color: transparent !important;
  background-image: none !important;
  border: 0 !important;
  box-shadow: none !important;
  border-radius: 999px !important;
  color: var(--color-ink-muted) !important;
  transition: background-color 125ms ease, color 125ms ease !important;
}
.harbor-together-btn:not(.harbor-wt-tab):hover {
  background-color: rgba(255, 255, 255, 0.1) !important;
  color: var(--color-ink) !important;
}
.harbor-together-surface {
  background-color: var(--ef-panel-glass) !important;
  background-image: none !important;
  border-color: color-mix(in srgb, var(--ef-hairline) 90%, transparent) !important;
  backdrop-filter: blur(24px) saturate(130%);
  -webkit-backdrop-filter: blur(24px) saturate(130%);
}
.harbor-wt-tab {
  background-color: var(--ef-panel-glass) !important;
  color: var(--color-ink) !important;
}
.harbor-wt-modal .modal-panel,
.harbor-wt-modal > div {
  background-color: var(--ef-panel-glass) !important;
  backdrop-filter: blur(24px) saturate(130%);
  -webkit-backdrop-filter: blur(24px) saturate(130%);
}

/* ==========================================================================
   HOME + DETAIL RAILS  (main transparent so gradient shows; detail main opaque)
   ========================================================================== */
main {
  background-color: transparent !important;
}
main.absolute.inset-0 {
  background-color: var(--color-canvas) !important;
}
.flex.flex-col.gap-5 > .flex > .flex > h3.truncate.font-medium.tracking-tight,
h3.truncate.font-medium.tracking-tight {
  font-family: "Inter", system-ui, sans-serif !important;
  font-weight: 600 !important;
  letter-spacing: -0.018em !important;
  color: var(--color-ink) !important;
}
.group\/va {
  color: var(--color-ink-subtle) !important;
  transition: color 125ms ease !important;
}
.group\/va:hover {
  color: var(--color-accent) !important;
}
.harbor-row-arrow {
  background-color: color-mix(in srgb, var(--color-canvas) 82%, transparent) !important;
  border: var(--ef-border-w) solid color-mix(in srgb, var(--ef-hairline) 70%, transparent) !important;
  box-shadow: var(--ef-shadow) !important;
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
  transition: transform 125ms ease, background-color 125ms ease !important;
}
.harbor-row-arrow:hover {
  background-color: color-mix(in srgb, var(--color-canvas) 96%, transparent) !important;
  transform: scale(1.06) !important;
}
.harbor-service-tile {
  background-color: color-mix(in srgb, var(--color-raised) 34%, transparent) !important;
  border: var(--ef-border-w) solid color-mix(in srgb, var(--ef-hairline) 55%, transparent) !important;
  border-radius: var(--largeRadius, 0.75em) !important;
  box-shadow: var(--ef-shadow);
  transition: background-color 125ms ease, border-color 125ms ease, transform 125ms ease !important;
}
.harbor-service-tile:hover {
  background-color: color-mix(in srgb, var(--color-raised) 55%, transparent) !important;
  border-color: color-mix(in srgb, var(--ef-hairline) 90%, transparent) !important;
  transform: translateY(-1px);
}

/* ==========================================================================
   POSTER CARDS  (1em radius, scale(1.02)/125ms lift, white vertical shine-sweep)
   ========================================================================== */
button.group > div.relative.w-full.transition-transform {
  transition: transform 125ms ease !important;
  will-change: transform;
}
button.group:hover > div.relative.w-full.transition-transform {
  transform: scale(1.02) !important;
}
button.group:hover > div.relative.w-full.transition-transform,
button.group:hover > div.relative[class*="translate3d"] {
  --tw-translate-y: 0 !important;
}
.harbor-poster,
.your-card {
  border-radius: var(--poster-radius, 1em) !important;
  overflow: hidden !important;
}
button.group .harbor-poster {
  box-shadow:
    var(--ef-shadow),
    inset 0 0 0 var(--ef-border-w) color-mix(in srgb, #ffffff 8%, transparent) !important;
  transition: box-shadow 125ms ease !important;
}
button.group:hover .harbor-poster {
  box-shadow:
    0.15em 0.2em 0.35em rgba(0, 0, 0, 0.4),
    inset 0 0 0 var(--ef-border-w) color-mix(in srgb, #ffffff 12%, transparent) !important;
}
.harbor-poster::before {
  content: none;
}
button.group:not([data-no-card-ring]):hover .harbor-card-ring::after {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--color-accent) 70%, transparent) !important;
}
button.group > p.line-clamp-2 {
  font-family: "Inter", system-ui, sans-serif !important;
  font-weight: 500 !important;
  color: var(--color-ink) !important;
}
.harbor-poster > .absolute.rounded-md.bg-canvas\/95 {
  background-color: color-mix(in srgb, var(--ef-panel-glass) 95%, transparent) !important;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
}
.harbor-cinema-badge {
  color: var(--color-accent) !important;
  border: var(--ef-border-w) solid color-mix(in srgb, var(--color-accent) 45%, transparent) !important;
}
.harbor-poster .rounded-full.bg-canvas\/85 {
  background-color: color-mix(in srgb, var(--ef-panel-glass) 85%, transparent) !important;
}

/* ==========================================================================
   DETAIL PAGE  (Inter title, glass pills, green Play, flat-glass secondaries)
   ========================================================================== */
.harbor-bleed-stremio h1,
.harbor-bleed-stremio .font-display,
main.absolute .font-display {
  font-family: "Inter", system-ui, sans-serif !important;
  font-weight: 600 !important;
  letter-spacing: -0.02em !important;
}
.harbor-bleed-stremio ~ * .rounded-full.border,
main.absolute .mt-6 .rounded-full,
main.absolute .mt-6 .rounded-md {
  border-color: color-mix(in srgb, var(--ef-hairline) 80%, transparent) !important;
}
div.mt-9.flex.items-center.gap-3 > button:first-child {
  background-color: var(--ef-btn-green) !important;
  background-image: linear-gradient(
    180deg,
    color-mix(in srgb, #ffffff 16%, transparent),
    transparent 55%
  ) !important;
  color: #ffffff !important;
  border: var(--ef-border-w) solid var(--ef-btn-green-edge) !important;
  box-shadow:
    0 0.4em 1em rgba(41, 154, 93, 0.28),
    inset 0 1px 0 rgba(255, 255, 255, 0.4) !important;
  transition: transform 125ms ease, filter 125ms ease !important;
}
div.mt-9.flex.items-center.gap-3 > button:first-child:hover {
  filter: brightness(1.06);
  transform: scale(1.03) !important;
}
div.mt-9.flex.items-center.gap-3 > button:not(:first-child) {
  background-color: color-mix(in srgb, var(--color-elevated) 78%, transparent) !important;
  border: var(--ef-border-w) solid color-mix(in srgb, var(--ef-hairline) 85%, transparent) !important;
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  box-shadow: var(--ef-shadow) !important;
  transition: background-color 125ms ease, border-color 125ms ease, transform 125ms ease !important;
}
div.mt-9.flex.items-center.gap-3 > button:not(:first-child):hover {
  background-color: color-mix(in srgb, var(--color-elevated) 95%, transparent) !important;
  border-color: color-mix(in srgb, #ffffff 22%, transparent) !important;
}
main.absolute .border-b {
  border-bottom-color: color-mix(in srgb, var(--ef-hairline) 60%, transparent) !important;
}

/* ==========================================================================
   GLASS SURFACES / MODALS / OVERLAYS
   ========================================================================== */
.glass-card,
.bg-surface:not(button):not(.rounded-full),
.bg-elevated:not(button):not(.rounded-full) {
  background-color: color-mix(in srgb, var(--ef-panel-glass) 72%, transparent) !important;
  background-image: none !important;
  border-color: color-mix(in srgb, var(--ef-hairline) 70%, transparent) !important;
  box-shadow: var(--ef-shadow) !important;
}
.glass-card {
  backdrop-filter: blur(10px) saturate(130%) !important;
  -webkit-backdrop-filter: blur(10px) saturate(130%) !important;
}
.absolute.bg-elevated:not(button),
.fixed.bg-elevated:not(button),
.absolute.bg-surface:not(button),
.fixed.bg-surface:not(button) {
  background-color: var(--color-elevated) !important;
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
}
.modal-panel {
  background-color: var(--ef-panel-glass) !important;
  background-image: none !important;
  border: var(--ef-border-w) solid color-mix(in srgb, var(--ef-hairline) 90%, transparent) !important;
  border-radius: var(--largeRadius, 1em) !important;
  backdrop-filter: blur(20px) saturate(130%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(130%) !important;
  box-shadow: 0 1.5em 3em rgba(0, 0, 0, 0.45) !important;
}
.harbor-search-backdrop {
  background: color-mix(in srgb, var(--ef-drawer-glass) 90%, transparent) !important;
  backdrop-filter: blur(20px) saturate(130%) !important;
  -webkit-backdrop-filter: blur(20px) saturate(130%) !important;
}
.harbor-chat-toast,
.harbor-together-pill {
  background-color: color-mix(in srgb, var(--ef-panel-glass) 90%, transparent) !important;
  background-image: none !important;
  border-color: color-mix(in srgb, var(--ef-hairline) 80%, transparent) !important;
  backdrop-filter: blur(10px) saturate(130%);
  -webkit-backdrop-filter: blur(10px) saturate(130%);
}

/* ==========================================================================
   PLAYER  (recolor progress to the single purple)
   ========================================================================== */
[data-harbor-player] .player-progress-fill {
  background-color: var(--color-accent) !important;
}
[data-harbor-player] [role="slider"] {
  accent-color: var(--color-accent);
}

/* ==========================================================================
   GLOBAL TYPE PINS
   ========================================================================== */
button,
input,
select,
textarea {
  font-family: "Inter", system-ui, sans-serif;
}
.bg-accent {
  background-color: var(--color-accent) !important;
  color: #ffffff !important;
}
.text-accent {
  color: var(--color-accent) !important;
}

/* ==========================================================================
   NAV DRAWER CHROME
   ========================================================================== */
#ef-topleft {
  pointer-events: auto;
  position: fixed;
  top: 22px;
  inset-inline-start: 1.1rem;
  z-index: 96;
  display: flex;
  align-items: center;
  gap: 0.35rem;
  transition: opacity 150ms ease;
}
#ef-topleft button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-ink);
  opacity: 0.82;
  transition: opacity 125ms ease, background-color 125ms ease;
  cursor: pointer;
}
#ef-topleft button:hover {
  opacity: 1;
  background-color: rgba(255, 255, 255, 0.08);
}
header.fixed.inset-x-0.top-0 > div > :first-child button.rounded-full {
  display: none !important;
}
.harbor-search-pill {
  display: none !important;
}
#ef-search {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex: none;
  padding: 0;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--color-ink-muted);
  cursor: pointer;
  transition: background-color 125ms ease, color 125ms ease;
}
#ef-search:hover {
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--color-ink);
}
#ef-profile {
  pointer-events: auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  flex: none;
  padding: 0;
  border-radius: 999px;
  overflow: hidden;
  border: var(--ef-border-w) solid color-mix(in srgb, #ffffff 22%, transparent);
  background-color: color-mix(in srgb, var(--color-raised) 40%, transparent);
  cursor: pointer;
  transition: border-color 125ms ease;
}
#ef-profile:hover {
  border-color: color-mix(in srgb, #ffffff 45%, transparent);
}
#ef-profile img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 999px;
}
html.ef-drawer-open #ef-topleft {
  opacity: 0;
  pointer-events: none;
}
#ef-scrim {
  pointer-events: none;
  position: fixed;
  inset: 0;
  z-index: 85;
  background: rgba(9, 13, 21, 0.5);
  opacity: 0;
  transition: opacity 170ms ease;
}
html.ef-drawer-open #ef-scrim {
  pointer-events: auto;
  opacity: 1;
}
html:not(:has(header.fixed.inset-x-0.top-0)) #ef-topleft,
html:not(:has(aside[data-harbor-sidebar])) #ef-menu,
html:not(:has(aside[data-harbor-sidebar])) #ef-home,
html:not(:has(aside[data-harbor-sidebar])) #ef-profile,
html:not(:has(aside[data-harbor-sidebar])) #ef-scrim {
  display: none !important;
}

/* ==========================================================================
   DETAIL HERO
   ========================================================================== */
.harbor-bleed-stremio {
  height: 88vh !important;
  min-height: 700px !important;
}
.harbor-bleed-stremio > div.absolute.inset-x-0.bottom-0 > div {
  margin-inline: auto;
  text-align: center;
}
.harbor-bleed-stremio > div.absolute.inset-x-0.bottom-0 > div > .flex:not(.flex-col),
.harbor-bleed-stremio > div.absolute.inset-x-0.bottom-0 > div .flex.flex-wrap {
  justify-content: center;
}
.harbor-bleed-stremio > div.absolute.inset-x-0.bottom-0 > div img {
  margin-inline: auto;
}
.harbor-bleed-stremio > div.absolute.inset-x-0.bottom-0 img.absolute {
  inset-inline: 0 !important;
  margin-inline: auto !important;
  object-position: center bottom !important;
}
.harbor-bleed-stremio > div.absolute.inset-0.bg-gradient-to-r {
  background-image: linear-gradient(
    to top,
    color-mix(in srgb, var(--color-canvas) 55%, transparent),
    transparent 40%
  ) !important;
}

/* ==========================================================================
   DETAIL HERO FLAT META + ACTIONS
   ========================================================================== */
.harbor-bleed-stremio > div.absolute.inset-x-0.bottom-0 .rounded-full.border,
.harbor-bleed-stremio > div.absolute.inset-x-0.bottom-0 .inline-flex.rounded-full {
  background-color: transparent !important;
  border-color: transparent !important;
  box-shadow: none !important;
}
.harbor-bleed-stremio > div.absolute.inset-x-0.bottom-0 > div > .flex:not(.flex-col) button:not(.bg-accent):not(.bg-ink) {
  background-color: transparent !important;
  border: 0 !important;
  border-color: transparent !important;
  box-shadow: none !important;
  color: var(--color-ink) !important;
}
.harbor-bleed-stremio > div.absolute.inset-x-0.bottom-0 > div > .flex:not(.flex-col) button:not(.bg-accent):not(.bg-ink):hover {
  background-color: rgba(255, 255, 255, 0.08) !important;
  border-radius: 999px;
}
.harbor-bleed-stremio > div.absolute.inset-x-0.bottom-0 > div > .flex:not(.flex-col) > :first-child button,
.harbor-bleed-stremio > div.absolute.inset-x-0.bottom-0 > div > .flex:not(.flex-col) > :first-child button:not(.bg-accent):not(.bg-ink) {
  background-color: #f3f4f6 !important;
  color: #111827 !important;
  border-radius: 999px !important;
  box-shadow: 0.1em 0.15em 0.4em rgba(0, 0, 0, 0.35) !important;
}
.harbor-bleed-stremio > div.absolute.inset-x-0.bottom-0 > div > .flex:not(.flex-col) > :first-child button:not(.bg-accent):not(.bg-ink):hover {
  background-color: #ffffff !important;
  color: #111827 !important;
}
main.absolute.inset-0 .rounded-xl.border.bg-elevated\\/70 {
  background-color: transparent !important;
  border-color: transparent !important;
  padding-inline: 0.25rem !important;
  height: auto !important;
}

/* ==========================================================================
   HOME HERO FULL-BLEED
   ========================================================================== */
[data-scroll-anchor="hero"] {
  margin-inline: -20px !important;
  margin-top: -96px !important;
  margin-bottom: 26px !important;
}
@media (min-width: 640px) {
  [data-scroll-anchor="hero"] { margin-inline: -32px !important; }
}
@media (min-width: 1024px) {
  [data-scroll-anchor="hero"] {
    margin-inline: -48px !important;
    margin-top: -112px !important;
  }
}
[data-scroll-anchor="hero"] .overflow-hidden {
  border-radius: 0 !important;
}
[data-scroll-anchor="hero"].harbor-anime-hero {
  margin: 0 !important;
}

/* ==========================================================================
   HOVER PREVIEW GLASS
   ========================================================================== */
.group.relative.cursor-pointer.overflow-hidden.rounded-xl.bg-elevated {
  background-color: var(--ef-panel-glass) !important;
  backdrop-filter: blur(18px) saturate(125%);
  -webkit-backdrop-filter: blur(18px) saturate(125%);
}`;

const elegantFinHtml = `<div id="ef-topleft">
  <button id="ef-back" type="button" aria-label="Back" style="display:none">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M19 12H5m0 0l7 7m-7-7l7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  <button id="ef-home" type="button" aria-label="Home" style="display:none">
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M3 10.5L12 3l9 7.5M5.5 8.5V20a1 1 0 001 1H10v-6h4v6h3.5a1 1 0 001-1V8.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
  </button>
  <button id="ef-menu" type="button" aria-label="Menu">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M4 6.5h16M4 12h16M4 17.5h16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
  </button>
</div>
<div id="ef-scrim"></div>`;

const elegantFinJs = `(function () {
  var w = window;
  if (typeof w.__efChromeCleanup === "function") {
    try { w.__efChromeCleanup(); } catch (e) {}
  }
  var root = document.documentElement;
  function setOpen(open) {
    if (open === undefined) root.classList.toggle("ef-drawer-open");
    else if (open) root.classList.add("ef-drawer-open");
    else root.classList.remove("ef-drawer-open");
  }
  function realBack() {
    return document.querySelector("header.fixed.inset-x-0.top-0 > div > :first-child button.rounded-full");
  }
  function onClick(e) {
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest("#ef-menu")) {
      setOpen();
      return;
    }
    if (t.closest("#ef-back")) {
      var rb = realBack();
      if (rb) rb.click();
      return;
    }
    if (t.closest("#ef-home")) {
      var home = document.querySelector("aside[data-harbor-sidebar] [data-harbor-nav]");
      if (home) home.click();
      return;
    }
    if (t.closest("#ef-search")) {
      var pill = document.querySelector(".harbor-search-pill");
      if (pill) pill.click();
      return;
    }
    if (t.closest("#ef-scrim")) {
      setOpen(false);
      return;
    }
    if (t.closest("#ef-profile")) {
      setOpen(true);
      return;
    }
    if (t.closest("aside[data-harbor-sidebar] [data-harbor-nav]")) {
      setOpen(false);
      return;
    }
    var bottom = t.closest("aside[data-harbor-sidebar] > div:last-child");
    if (bottom && t.closest("button") && !t.closest("div.relative")) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  }
  function onKey(e) {
    if (e.key === "Escape") setOpen(false);
  }
  function tick() {
    var back = document.getElementById("ef-back");
    var home = document.getElementById("ef-home");
    var showNav = realBack() ? "flex" : "none";
    if (back && back.style.display !== showNav) back.style.display = showNav;
    if (home && home.style.display !== showNav) home.style.display = showNav;
    var cluster = document.querySelector("header.fixed.inset-x-0.top-0 > div > :last-child");
    var prof = document.getElementById("ef-profile");
    if (!cluster) return;
    var search = document.getElementById("ef-search");
    if (!search) {
      search = document.createElement("button");
      search.id = "ef-search";
      search.type = "button";
      search.setAttribute("aria-label", "Search");
      search.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>';
    }
    if (!prof) {
      prof = document.createElement("button");
      prof.id = "ef-profile";
      prof.type = "button";
      prof.setAttribute("aria-label", "Profile");
    }
    var controls = cluster.querySelector(":scope > div.ms-1");
    var anchor = controls || null;
    if (search.parentElement !== cluster) {
      if (anchor) cluster.insertBefore(search, anchor);
      else cluster.appendChild(search);
    }
    if (prof.parentElement !== cluster) {
      if (anchor) cluster.insertBefore(prof, anchor);
      else cluster.appendChild(prof);
    }
    if (search.nextElementSibling !== prof) cluster.insertBefore(search, prof);
    var img = document.querySelector('aside[data-harbor-sidebar] > div:last-child .h-12.w-12.rounded-full > img');
    if (!img) img = document.querySelector('aside[data-harbor-sidebar] > div:last-child .rounded-full > img');
    var src = img && img.getAttribute("src") ? img.getAttribute("src") : "";
    var slot = prof.querySelector("img");
    if (src) {
      if (!slot) {
        prof.textContent = "";
        slot = document.createElement("img");
        prof.appendChild(slot);
      }
      if (slot.getAttribute("src") !== src) slot.setAttribute("src", src);
    }
  }
  document.addEventListener("click", onClick, true);
  window.addEventListener("keydown", onKey);
  var iv = w.setInterval(tick, 800);
  tick();
  var cleanup = function () {
    root.classList.remove("ef-drawer-open");
    document.removeEventListener("click", onClick, true);
    window.removeEventListener("keydown", onKey);
    w.clearInterval(iv);
    ["ef-profile", "ef-search"].forEach(function (rid) {
      var el = document.getElementById(rid);
      if (el && el.parentElement) el.parentElement.removeChild(el);
    });
    w.__efChromeCleanup = undefined;
  };
  w.__efChromeCleanup = cleanup;
  w.__harborThemeCleanup = cleanup;
})();`;

const feishinCss = `/* ===== FEISHIN THEME FOR HARBOR ===== */
/* Retoken Harbor's @theme palette to Feishin's near-black ladder + electric blue */
:root {
  --color-canvas: #0C0C0C;
  --color-surface: #141414;
  --color-elevated: #181818;
  --color-raised: #242424;
  --color-ink: #E1E1E1;
  --color-ink-muted: #969696;
  --color-ink-subtle: #6e6e6e;
  --color-edge: rgba(255,255,255,0.10);
  --color-edge-soft: rgba(255,255,255,0.06);
  --color-accent: #3574FC;
  --color-accent-soft: rgba(53,116,252,0.18);
  --color-danger: #CC3232;
  --color-success: #32CC32;
  --font-display: "Inter", "Noto Sans JP", system-ui, sans-serif;
  --font-sans: "Inter", "Noto Sans JP", system-ui, sans-serif;
  --font-channel: "Inter", system-ui, sans-serif;
  --font-anime: "Inter", system-ui, sans-serif;
  --poster-radius: 5px;
  font-variant-numeric: tabular-nums;
}

html[data-theme-layout="custom"] body,
html[data-theme-layout="custom"] #root { background: #0C0C0C; }

/* Heavy Inter headings, Feishin weight ladder */
html[data-theme-layout="custom"] h1,
html[data-theme-layout="custom"] h2 { font-weight: 900 !important; letter-spacing: -0.01em; }
html[data-theme-layout="custom"] h3 { font-weight: 700 !important; letter-spacing: -0.01em; }

/* ===== SIDEBAR RAIL (#080808, one notch darker) ===== */
html[data-theme-layout="custom"] .fsh-rail {
  pointer-events: auto;
  position: fixed;
  inset: 0 auto 90px 0;
  width: 240px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: #080808;
  border-right: 1px solid rgba(255,255,255,0.05);
  font-family: "Inter", system-ui, sans-serif;
  z-index: 60;
  overflow: hidden;
}

/* Top action bar: search pill + menu/back/fwd */
html[data-theme-layout="custom"] .fsh-actionbar {
  flex-shrink: 0;
  height: 65px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
}
html[data-theme-layout="custom"] .fsh-search {
  flex: 1 1 58%;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px;
  border: 0;
  border-radius: 3px;
  background: #141414;
  color: #969696;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s ease;
}
html[data-theme-layout="custom"] .fsh-search:hover { background: #1c1c1c; }
html[data-theme-layout="custom"] .fsh-search-ph { color: #969696; font-size: 13px; }
html[data-theme-layout="custom"] .fsh-search .fsh-ico { width: 16px; height: 16px; flex-shrink: 0; }
html[data-theme-layout="custom"] .fsh-actionbtns { display: flex; gap: 6px; flex: 1 1 42%; }
html[data-theme-layout="custom"] .fsh-iconbtn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 36px;
  border: 0;
  border-radius: 3px;
  background: #141414;
  color: #E1E1E1;
  cursor: pointer;
  transition: background 0.15s ease;
}
html[data-theme-layout="custom"] .fsh-iconbtn:hover { background: #1f1f1f; }
html[data-theme-layout="custom"] .fsh-iconbtn .fsh-ico { width: 18px; height: 18px; }

/* Scroll area of accordion sections */
html[data-theme-layout="custom"] .fsh-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(160,160,160,0.2) transparent;
}
html[data-theme-layout="custom"] .fsh-scroll::-webkit-scrollbar { width: 9px; }
html[data-theme-layout="custom"] .fsh-scroll::-webkit-scrollbar-thumb { background: rgba(160,160,160,0.2); border-radius: 5px; }
html[data-theme-layout="custom"] .fsh-scroll::-webkit-scrollbar-thumb:hover { background: rgba(160,160,160,0.6); }

html[data-theme-layout="custom"] .fsh-section-head {
  min-height: 40px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  border-radius: 5px;
  color: #969696;
  font-size: 14px;
  font-weight: 500;
}

/* Nav items: 36px, 12px pad, icon 14px + 12px gap, active = blue text no pill */
html[data-theme-layout="custom"] .fsh-nav { display: flex; flex-direction: column; }
html[data-theme-layout="custom"] .fsh-nav button {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 36px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: 5px;
  background: transparent;
  color: #E1E1E1;
  font-family: "Inter", system-ui, sans-serif;
  font-size: 14px;
  font-weight: 500;
  text-align: left;
  cursor: default;
  transition: color 0.2s ease-in-out, background 0.15s ease;
  white-space: nowrap;
  overflow: hidden;
}
html[data-theme-layout="custom"] .fsh-nav button > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
html[data-theme-layout="custom"] .fsh-nav button:hover { background: rgba(255,255,255,0.04); }
html[data-theme-layout="custom"] .fsh-nav .fsh-ico { width: 15px; height: 15px; flex-shrink: 0; }
html[data-theme-layout="custom"] .fsh-nav button[data-active] { color: #3574FC; }
html[data-theme-layout="custom"] .fsh-nav button[data-active] .fsh-ico { stroke: #3574FC; }
html[data-theme-layout="custom"] .fsh-nav button:focus-visible { outline: none; border-color: #3574FC; }

/* ===== SHIFT MAIN CONTENT for rail ===== */
html[data-theme-layout="custom"]:not([data-chrome-hidden]) main {
  padding-left: 240px !important;
}

/* ===== GATE custom chrome off during player / settings / immersive ===== */
html:not([data-theme-layout="custom"]) .fsh-rail,
html[data-chrome-hidden] .fsh-rail { display: none !important; }

/* Hide Harbor's floating-back + retint window controls (rail carries nav) */
html[data-theme-layout="custom"]:not([data-chrome-hidden]) .harbor-win-control,
html[data-theme-layout="custom"]:not([data-chrome-hidden]) .harbor-win-close {
  background: #141414 !important;
  color: #E1E1E1 !important;
}

/* ===== CARDS: square-ish, 5px corners, flat, Feishin hover ===== */
html[data-theme-layout="custom"] .harbor-poster,
html[data-theme-layout="custom"] .your-card { border-radius: 5px !important; }
html[data-theme-layout="custom"] .harbor-card-ring {
  border-radius: 5px !important;
  box-shadow: none !important;
}
html[data-theme-layout="custom"] .group:hover .harbor-card-ring {
  box-shadow: 0 0 0 1px rgba(255,255,255,0.06) !important;
}
/* Card title row: 500 weight foreground, muted meta */
html[data-theme-layout="custom"] .harbor-row-track p { font-weight: 500; }

/* ===== ROWS: Feishin carousel look, 700 titles ===== */
html[data-theme-layout="custom"] .harbor-row-track h3,
html[data-theme-layout="custom"] main h3 { font-weight: 700 !important; color: #E1E1E1; }
/* Row scroll arrows: flat surface discs, no shadow */
html[data-theme-layout="custom"] .harbor-row-arrow {
  background: #181818 !important;
  border: 1px solid rgba(255,255,255,0.08) !important;
  box-shadow: none !important;
  color: #E1E1E1 !important;
  border-radius: 5px !important;
}

/* Continue-watching progress + cinema chip retint to blue */
html[data-theme-layout="custom"] .harbor-cinema-badge { background: rgba(53,116,252,0.16) !important; color: #3574FC !important; }

/* ===== DETAIL HERO: flat scrims, blue play disc already white in Feishin ===== */
html[data-theme-layout="custom"] .harbor-bleed-stremio { border-radius: 0 !important; }
/* Detail action Play button: Feishin white circular disc */
html[data-theme-layout="custom"] main.absolute .max-w-3xl button.rounded-full.bg-ink {
  background: #ffffff !important;
  color: #000000 !important;
}

/* Generic surfaces / modals adopt Feishin flat borders instead of heavy shadow */
html[data-theme-layout="custom"] [class*="shadow-"] { --tw-shadow: 0 0 #0000; }

/* Selection / focus accent everywhere = blue */
html[data-theme-layout="custom"] ::selection { background: rgba(53,116,252,0.35); }`;

const feishinHtml = `<aside class="fsh-rail" data-tv-nav-zone data-tauri-drag-region>
  <div class="fsh-actionbar">
    <button class="fsh-search" type="button" onclick="window.harbor.search()" aria-label="Search" title="Search">
      <svg class="fsh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path></svg>
      <span class="fsh-search-ph">Search</span>
    </button>
    <div class="fsh-actionbtns">
      <button class="fsh-iconbtn" type="button" onclick="window.harbor.navigate('settings')" aria-label="Menu" title="Menu">
        <svg class="fsh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
      </button>
      <button class="fsh-iconbtn" type="button" onclick="window.harbor.back()" aria-label="Back" title="Back">
        <svg class="fsh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>
      </button>
      <button class="fsh-iconbtn" type="button" onclick="window.harbor.navigate('home')" aria-label="Forward" title="Home">
        <svg class="fsh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>
      </button>
    </div>
  </div>

  <div class="fsh-scroll">
    <div class="fsh-section">
      <div class="fsh-section-head">My Library</div>
      <nav class="fsh-nav">
        <button data-harbor-nav="home" onclick="window.harbor.navigate('home')">
          <svg class="fsh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 10.5 12 3l9 7.5"></path><path d="M5 9.5V21h14V9.5"></path></svg>
          <span>Home</span>
        </button>
        <button data-harbor-nav="discover" onclick="window.harbor.navigate('discover')">
          <svg class="fsh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="m15.5 8.5-2.2 5.3-5.3 2.2 2.2-5.3z"></path></svg>
          <span>Discover</span>
        </button>
        <button data-harbor-nav="movies" onclick="window.harbor.navigate('movies')">
          <svg class="fsh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M7 4v16M17 4v16M3 9h4M17 9h4M3 15h4M17 15h4"></path></svg>
          <span>Movies</span>
        </button>
        <button data-harbor-nav="shows" onclick="window.harbor.navigate('shows')">
          <svg class="fsh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="13" rx="2"></rect><path d="m8 3 4 4 4-4"></path></svg>
          <span>Shows</span>
        </button>
        <button data-harbor-nav="anime" onclick="window.harbor.navigate('anime')">
          <svg class="fsh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c4.5 0 8 3 8 7 0 3-2 5-5 6l1 4-4-2.5L8 20l1-4c-3-1-5-3-5-6 0-4 3.5-7 8-7z"></path></svg>
          <span>Anime</span>
        </button>
        <button data-harbor-nav="live" onclick="window.harbor.navigate('live')">
          <svg class="fsh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="7" width="20" height="14" rx="2"></rect><path d="m8 7 4-4 4 4"></path></svg>
          <span>Live TV</span>
        </button>
        <button data-harbor-nav="vod" onclick="window.harbor.navigate('vod')">
          <svg class="fsh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h11M4 12h11M4 18h7"></path><path d="m17 9 4 3-4 3z"></path></svg>
          <span>Playlists</span>
        </button>
      </nav>
    </div>

    <div class="fsh-section">
      <div class="fsh-section-head">Collections</div>
      <nav class="fsh-nav">
        <button data-harbor-nav="library" onclick="window.harbor.navigate('library')">
          <svg class="fsh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h4v16H4zM10 4h4v16h-4z"></path><path d="m17 5 3.5 1-3 14-3.4-1z"></path></svg>
          <span>Library</span>
        </button>
        <button data-harbor-nav="calendar" onclick="window.harbor.navigate('calendar')">
          <svg class="fsh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"></rect><path d="M3 10h18M8 3v4M16 3v4"></path></svg>
          <span>Calendar</span>
        </button>
        <button data-harbor-nav="downloads" onclick="window.harbor.navigate('downloads')">
          <svg class="fsh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"></path><path d="m7 11 5 5 5-5"></path><path d="M4 20h16"></path></svg>
          <span>Downloads</span>
        </button>
        <button data-harbor-nav="addons" onclick="window.harbor.navigate('addons')">
          <svg class="fsh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="8" height="8" rx="1.5"></rect><rect x="13" y="3" width="8" height="8" rx="1.5"></rect><rect x="3" y="13" width="8" height="8" rx="1.5"></rect><path d="M17 13v8M13 17h8"></path></svg>
          <span>Addons</span>
        </button>
        <button data-harbor-nav="settings" onclick="window.harbor.navigate('settings')">
          <svg class="fsh-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"></path></svg>
          <span>Settings</span>
        </button>
      </nav>
    </div>
  </div>
</aside>
`;

const feishinJs = `(function () {
  var root = document.documentElement;
  function syncActive() {
    var kind = "";
    document.querySelectorAll("[data-harbor-nav][data-active]").forEach(function (el) {
      kind = el.getAttribute("data-harbor-nav") || kind;
    });
  }
  var obs = new MutationObserver(syncActive);
  document.querySelectorAll(".fsh-rail [data-harbor-nav]").forEach(function (el) {
    obs.observe(el, { attributes: true, attributeFilter: ["data-active"] });
  });
  syncActive();
  window.__harborThemeCleanup = function () { obs.disconnect(); };
})();`;

export const BETA_THEMES: ThemePreset[] = [
  {
    id: "elegantfin" as ThemePresetId,
    name: "ElegantFin",
    blurb:
      "Dark navy glass with one purple accent, rounded cards, and a soft shine sweep. Ported from Jellyfin's ElegantFin.",
    swatch: ["#111827", "#1e2836", "#775bf4"],
    tokens: {
      "--color-canvas": "#111827",
      "--color-surface": "#1f2937",
      "--color-elevated": "#1e2836",
      "--color-raised": "#374151",
      "--color-ink": "#d1d5db",
      "--color-ink-muted": "#9ca3af",
      "--color-ink-subtle": "#6b7280",
      "--color-edge": "#47505ce6",
      "--color-edge-soft": "#47505c66",
      "--color-accent": "#775bf4",
      "--color-accent-soft": "#775bf42e",
      "--color-danger": "#a91d1d",
    },
    background: { image: "linear-gradient(0deg, #111827 35%, #1d2635 100%)", dim: 0 },
    layout: "sidebar",
    cardStyle: "glass",
    buttonStyle: "flat",
    fontPair: "fraunces-inter",
    css: elegantFinCss,
    html: elegantFinHtml,
    js: elegantFinJs,
  },
  {
    id: "feishin" as ThemePresetId,
    name: "Feishin",
    blurb:
      "Layered near-black with one electric-blue accent, tight 5px corners, and heavy Inter. Ported from the Feishin player.",
    swatch: ["#0C0C0C", "#141414", "#3574FC"],
    tokens: {
      "--color-canvas": "#0C0C0C",
      "--color-surface": "#141414",
      "--color-elevated": "#181818",
      "--color-raised": "#242424",
      "--color-ink": "#E1E1E1",
      "--color-ink-muted": "#969696",
      "--color-ink-subtle": "#6E6E6E",
      "--color-edge": "rgba(255,255,255,0.10)",
      "--color-edge-soft": "rgba(255,255,255,0.05)",
      "--color-accent": "#3574FC",
      "--color-accent-soft": "rgba(53,116,252,0.18)",
      "--color-danger": "#CC3232",
    },
    layout: "custom",
    cardStyle: "flat",
    buttonStyle: "flat",
    fontPair: "fraunces-inter",
    css: feishinCss,
    html: feishinHtml,
    js: feishinJs,
  },
];

export const FEATURED_CUSTOM_THEMES: ThemePreset[] = [
  {
    id: "aurora" as ThemePresetId,
    name: "Aurora",
    blurb: "Liquid glass / Frutiger Aero. Top dock, glossy cards, bokeh sky.",
    swatch: ["#0c1a3a", "#1f4ea8", "#7cd6ff"],
    tokens: {
      "--color-canvas": "#06112a",
      "--color-surface": "rgba(255,255,255,0.04)",
      "--color-elevated": "rgba(255,255,255,0.07)",
      "--color-raised": "rgba(255,255,255,0.11)",
      "--color-ink": "#f4f9ff",
      "--color-ink-muted": "#c7d8ee",
      "--color-ink-subtle": "#7d96bd",
      "--color-edge": "rgba(255,255,255,0.18)",
      "--color-edge-soft": "rgba(255,255,255,0.08)",
      "--color-accent": "#7cd6ff",
      "--color-accent-soft": "rgba(124,214,255,0.18)",
      "--color-danger": "#ff7393",
    },
    background: {
      image:
        "radial-gradient(ellipse 90% 70% at 20% 0%, #2e7fd6 0%, #14397f 30%, #0a1c4e 60%, #050d28 100%), radial-gradient(ellipse 70% 60% at 80% 100%, #5e36b8 0%, transparent 60%)",
      dim: 0,
    },
    layout: "topdock",
    cardStyle: "glass",
    buttonStyle: "glossy",
    bokeh: true,
    previewImage: auroraPreview,
  },
  {
    id: "minui" as ThemePresetId,
    name: "MinUI",
    blurb: "Floating icon dock. Crisp and light. Big targets, restrained chrome.",
    previewImage: minuiPreview,
    swatch: ["#f7f7f8", "#ffffff", "#0d7c66"],
    tokens: {
      "--color-canvas": "#f6f6f7",
      "--color-surface": "#ffffff",
      "--color-elevated": "#ffffff",
      "--color-raised": "#f1f1f2",
      "--color-ink": "#0a0a0c",
      "--color-ink-muted": "#3f3f46",
      "--color-ink-subtle": "#71717a",
      "--color-edge": "rgba(15,15,18,0.12)",
      "--color-edge-soft": "rgba(15,15,18,0.06)",
      "--color-accent": "#0d7c66",
      "--color-accent-soft": "rgba(13,124,102,0.12)",
      "--color-danger": "#b91c1c",
    },
    background: {
      image: "radial-gradient(ellipse 120% 70% at 50% -10%, #ffffff 0%, #f4f4f6 45%, #ececef 100%)",
      dim: 0,
    },
    layout: "minui",
    cardStyle: "minui",
    buttonStyle: "minui",
    bokeh: false,
    fontPair: "general-sans",
  },
];

export const TEMPLATE_THEMES: ThemePreset[] = [
  {
    id: "velvet" as ThemePresetId,
    name: "Velvet",
    blurb: "Eggplant + champagne gold + serif. Old theatre, late night.",
    swatch: ["#1a0f1f", "#3a1f44", "#d4b562"],
    tokens: {
      "--color-canvas": "#160c1b",
      "--color-surface": "#1f1226",
      "--color-elevated": "#2b1934",
      "--color-raised": "#382242",
      "--color-ink": "#f6efe3",
      "--color-ink-muted": "#c4b6a2",
      "--color-ink-subtle": "#7a6c64",
      "--color-edge": "rgba(212,181,98,0.18)",
      "--color-edge-soft": "rgba(212,181,98,0.08)",
      "--color-accent": "#d4b562",
      "--color-accent-soft": "rgba(212,181,98,0.16)",
      "--color-danger": "#e87474",
    },
    background: {
      image: "radial-gradient(ellipse 100% 70% at 50% 0%, #3a1f44 0%, #1f1226 40%, #0c0610 100%)",
      dim: 0,
    },
    layout: "rail",
    cardStyle: "flat",
    buttonStyle: "flat",
    bokeh: false,
    fontPair: "sentient-switzer",
    previewImage: velvetPreview,
  },
];

export const FONT_PAIRS: Record<FontPairId, FontPair> = {
  "sentient-switzer": {
    id: "sentient-switzer",
    name: "Sentient + Switzer",
    blurb: "Default. Humanist serif, warm sans.",
    display: '"Sentient", "Iowan Old Style", "Georgia", serif',
    sans: '"Switzer", "Inter", system-ui, sans-serif',
  },
  "fraunces-inter": {
    id: "fraunces-inter",
    name: "Fraunces + Inter",
    blurb: "Classic. Was Harbor's original pair.",
    display: '"Fraunces", "Iowan Old Style", "Georgia", serif',
    sans: '"Inter", system-ui, sans-serif',
  },
  "general-sans": {
    id: "general-sans",
    name: "General Sans",
    blurb: "Clean modern. Sans across the board.",
    display: '"General Sans", "Inter", system-ui, sans-serif',
    sans: '"General Sans", "Inter", system-ui, sans-serif',
  },
  "cabinet-switzer": {
    id: "cabinet-switzer",
    name: "Cabinet Grotesk + Switzer",
    blurb: "Editorial. Headline-strong display.",
    display: '"Cabinet Grotesk", "Inter", system-ui, sans-serif',
    sans: '"Switzer", "Inter", system-ui, sans-serif',
  },
  plex: {
    id: "plex",
    name: "IBM Plex",
    blurb: "Technical. IBM's open family.",
    display: '"IBM Plex Sans", system-ui, sans-serif',
    sans: '"IBM Plex Sans", system-ui, sans-serif',
  },
  "plus-jakarta": {
    id: "plus-jakarta",
    name: "Plus Jakarta Sans",
    blurb: "Stremio's typeface. Geometric humanist sans.",
    display: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
    sans: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
  },
  system: {
    id: "system",
    name: "System UI",
    blurb: "Whatever your OS uses.",
    display: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    sans: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
};

export type CustomColors = {
  canvas: string;
  surface: string;
  elevated: string;
  raised: string;
  ink: string;
  inkMuted: string;
  inkSubtle: string;
  edge: string;
  accent: string;
  danger: string;
};

export type ThemeSettings = {
  preset: ActiveThemeId;
  backgroundImage: string | null;
  backgroundDim: number;
  fontPair: FontPairId;
  customFontId?: string | null;
  customColors: CustomColors | null;
};

export const DEFAULT_CUSTOM_COLORS: CustomColors = {
  canvas: "#1f2128",
  surface: "#292c34",
  elevated: "#34373f",
  raised: "#3f424b",
  ink: "#f6f6f8",
  inkMuted: "#aaadb6",
  inkSubtle: "#6e7079",
  edge: "#70727b",
  accent: "#d3a064",
  danger: "#d35a3a",
};

export const DEFAULT_THEME: ThemeSettings = {
  preset: "cool-grey",
  backgroundImage: null,
  backgroundDim: 0.65,
  fontPair: "sentient-switzer",
  customColors: null,
};

export function customColorsToTokens(c: CustomColors): Record<string, string> {
  return {
    "--color-canvas": c.canvas,
    "--color-surface": c.surface,
    "--color-elevated": c.elevated,
    "--color-raised": c.raised,
    "--color-ink": c.ink,
    "--color-ink-muted": c.inkMuted,
    "--color-ink-subtle": c.inkSubtle,
    "--color-edge": `${c.edge}8c`,
    "--color-edge-soft": `${c.edge}40`,
    "--color-accent": c.accent,
    "--color-accent-soft": `${c.accent}2e`,
    "--color-danger": c.danger,
  };
}

export function getThemeById(id: string): ThemePreset | null {
  if (id in THEME_PRESETS) return THEME_PRESETS[id as ThemePresetId];
  const featured = FEATURED_CUSTOM_THEMES.find((t) => t.id === id);
  if (featured) return featured;
  const beta = BETA_THEMES.find((t) => t.id === id);
  if (beta) return beta;
  const template = TEMPLATE_THEMES.find((t) => t.id === id);
  if (template) return template;
  if (id.startsWith("user:")) {
    return (getCustomThemes().find((t) => t.id === id) as ThemePreset | undefined) ?? null;
  }
  return null;
}

export function isKnownPreset(id: string): boolean {
  return getThemeById(id) !== null;
}

const CYCLE_THEME_IDS: ThemePresetId[] = (Object.keys(THEME_PRESETS) as ThemePresetId[]).filter(
  (id) => id !== "crunch",
);

export function nextColorTheme(current: string): ThemePresetId {
  const i = CYCLE_THEME_IDS.indexOf(current as ThemePresetId);
  return CYCLE_THEME_IDS[(i + 1) % CYCLE_THEME_IDS.length];
}

function resolveTokens(theme: ThemeSettings): Record<string, string> {
  if (theme.preset === "custom" && theme.customColors) {
    return customColorsToTokens(theme.customColors);
  }
  if (theme.preset !== "custom") {
    const found = getThemeById(theme.preset);
    if (found) return found.tokens;
  }
  return THEME_PRESETS["cool-grey"].tokens;
}

export function applyTheme(theme: ThemeSettings): void {
  const root = document.documentElement;
  for (const [k, v] of Object.entries(resolveTokens(theme))) {
    root.style.setProperty(k, v);
  }
  const preset = theme.preset !== "custom" ? getThemeById(theme.preset) : null;
  const fontPairId = preset?.fontPair ?? theme.fontPair;
  const pair = FONT_PAIRS[fontPairId] ?? FONT_PAIRS["sentient-switzer"];
  if (theme.customFontId) {
    const custom = `"harbor-font-${theme.customFontId}"`;
    root.style.setProperty("--font-display", `${custom}, ${pair.display}`);
    root.style.setProperty("--font-sans", `${custom}, ${pair.sans}`);
  } else {
    root.style.setProperty("--font-display", pair.display);
    root.style.setProperty("--font-sans", pair.sans);
  }
  const layout: ThemeLayout = preset?.layout ?? "sidebar";
  const cardStyle: ThemeCardStyle = preset?.cardStyle ?? "flat";
  const buttonStyle: ThemeButtonStyle = preset?.buttonStyle ?? "flat";
  root.dataset.themeLayout = layout;
  root.dataset.themeCard = cardStyle;
  root.dataset.themeButton = buttonStyle;
  root.dataset.themeBokeh = preset?.bokeh ? "on" : "off";
}

export function activeLayout(theme: ThemeSettings): ThemeLayout {
  const preset = theme.preset !== "custom" ? getThemeById(theme.preset) : null;
  return preset?.layout ?? "sidebar";
}

export function resolveChromeTheme(
  theme: ThemeSettings,
  override: "auto" | "default" | "stremio",
): "default" | "stremio" {
  if (override === "default" || override === "stremio") return override;
  return activeLayout(theme) === "stremio" ? "stremio" : "default";
}

const TOPBAR_BACK_LAYOUTS = new Set(["sidebar", "dracula", "nord", "forest", "stremio"]);

export function layoutHasGlobalBack(): boolean {
  const l = document.documentElement.dataset.themeLayout ?? "sidebar";
  return TOPBAR_BACK_LAYOUTS.has(l);
}

export function activeBokeh(theme: ThemeSettings): boolean {
  const preset = theme.preset !== "custom" ? getThemeById(theme.preset) : null;
  return !!preset?.bokeh;
}

export function applyCustomColorsPreview(c: CustomColors, fontPair: FontPairId): void {
  applyTheme({
    preset: "custom",
    customColors: c,
    backgroundImage: null,
    backgroundDim: 0,
    fontPair,
  });
}
