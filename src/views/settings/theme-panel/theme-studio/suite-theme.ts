import { customColorsToTokens, FONT_PAIRS } from "@/lib/theme";
import { type CSSProperties } from "react";

export const SUITE_COLORS = {
  canvas: "#1c1f24",
  surface: "#21252b",
  elevated: "#282c34",
  raised: "#2c313a",
  ink: "#e6e9ef",
  inkMuted: "#abb2bf",
  inkSubtle: "#828a99",
  edge: "#586074",
  accent: "#e3b341",
  danger: "#e06c75",
};

export const SUITE_CHROME = {
  ...customColorsToTokens(SUITE_COLORS),
  "--font-display": FONT_PAIRS["sentient-switzer"].display,
  "--font-sans": FONT_PAIRS["sentient-switzer"].sans,
} as CSSProperties;
