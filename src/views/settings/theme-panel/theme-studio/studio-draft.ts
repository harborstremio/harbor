import { DEFAULT_CHROME } from "./chrome-config";
import { DEFAULT_CUSTOM_COLORS, type ThemePreset } from "@/lib/theme";
import { t } from "@/lib/i18n";
import type { Draft } from "./studio-types";

export function cssColorToHex(input: string): string {
  const s = input.trim();
  if (s.startsWith("#")) return s.slice(0, 7);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "#808080";
    ctx.fillStyle = "#808080";
    ctx.fillStyle = s;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    const hex = (n: number) => n.toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  } catch {
    return "#808080";
  }
}

export function emptyDraft(seed?: ThemePreset): Draft {
  if (!seed) {
    return {
      name: "",
      blurb: "",
      layout: "sidebar",
      cardStyle: "flat",
      buttonStyle: "flat",
      fontPair: "sentient-switzer",
      customFontId: null,
      bokeh: false,
      colors: { ...DEFAULT_CUSTOM_COLORS },
      chrome: { ...DEFAULT_CHROME },
      chromeDirty: false,
      css: "",
      js: "",
      html: "",
    };
  }
  const tokens = seed.tokens;
  const ext = seed as ThemePreset & {
    css?: string;
    js?: string;
    html?: string;
    customFontId?: string | null;
  };
  return {
    name: t("{name} copy", { name: t(seed.name) }),
    blurb: seed.blurb ? t(seed.blurb) : "",
    layout: seed.layout ?? "sidebar",
    cardStyle: seed.cardStyle ?? "flat",
    buttonStyle: seed.buttonStyle ?? "flat",
    fontPair: seed.fontPair ?? "sentient-switzer",
    customFontId: ext.customFontId ?? null,
    bokeh: !!seed.bokeh,
    colors: {
      canvas: cssColorToHex(tokens["--color-canvas"]),
      surface: cssColorToHex(tokens["--color-surface"]),
      elevated: cssColorToHex(tokens["--color-elevated"]),
      raised: cssColorToHex(tokens["--color-raised"]),
      ink: cssColorToHex(tokens["--color-ink"]),
      inkMuted: cssColorToHex(tokens["--color-ink-muted"]),
      inkSubtle: cssColorToHex(tokens["--color-ink-subtle"]),
      edge: cssColorToHex(tokens["--color-edge"]),
      accent: cssColorToHex(tokens["--color-accent"]),
      danger: cssColorToHex(tokens["--color-danger"]),
    },
    chrome: seed.chrome ? { ...seed.chrome } : { ...DEFAULT_CHROME },
    chromeDirty: false,
    css: ext.css ?? "",
    js: ext.js ?? "",
    html: ext.html ?? "",
  };
}
