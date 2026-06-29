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
export type ThemeCardStyle =
  | "flat"
  | "glass"
  | "stremio"
  | "minui"
  | "crunch"
  | "noir"
  | "custom";
export type ThemeButtonStyle =
  | "flat"
  | "glossy"
  | "minui"
  | "crunch"
  | "noir"
  | "custom";

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
  previewImage?: string;
  fontPair?: FontPairId;
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
    blurb:
      "Floating icon dock. Crisp and light. Big targets, restrained chrome.",
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
      image:
        "radial-gradient(ellipse 120% 70% at 50% -10%, #ffffff 0%, #f4f4f6 45%, #ececef 100%)",
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
      image:
        "radial-gradient(ellipse 100% 70% at 50% 0%, #3a1f44 0%, #1f1226 40%, #0c0610 100%)",
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
  const template = TEMPLATE_THEMES.find((t) => t.id === id);
  if (template) return template;
  if (id.startsWith("user:")) {
    return (
      (getCustomThemes().find((t) => t.id === id) as ThemePreset | undefined) ??
      null
    );
  }
  return null;
}

export function isKnownPreset(id: string): boolean {
  return getThemeById(id) !== null;
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

const TOPBAR_BACK_LAYOUTS = new Set([
  "sidebar",
  "dracula",
  "nord",
  "forest",
  "stremio",
]);

export function layoutHasGlobalBack(): boolean {
  const l = document.documentElement.dataset.themeLayout ?? "sidebar";
  return TOPBAR_BACK_LAYOUTS.has(l);
}

export function activeBokeh(theme: ThemeSettings): boolean {
  const preset = theme.preset !== "custom" ? getThemeById(theme.preset) : null;
  return !!preset?.bokeh;
}

export function applyCustomColorsPreview(
  c: CustomColors,
  fontPair: FontPairId,
): void {
  applyTheme({
    preset: "custom",
    customColors: c,
    backgroundImage: null,
    backgroundDim: 0,
    fontPair,
  });
}
