import { type CSSProperties } from "react";
import { customColorsToTokens, FONT_PAIRS } from "@/lib/theme";

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

export const SUITE_COLORS_LIGHT = {
  canvas: "#ffffff",
  surface: "#f2f4f6",
  elevated: "#f7f8fa",
  raised: "#e9ecf0",
  ink: "#181b20",
  inkMuted: "#565f6d",
  inkSubtle: "#89909d",
  edge: "#cfd3da",
  accent: "#e0a33e",
  danger: "#d75760",
};

export const SUITE_CHROME_LIGHT = {
  ...customColorsToTokens(SUITE_COLORS_LIGHT),
  "--font-display": FONT_PAIRS["sentient-switzer"].display,
  "--font-sans": FONT_PAIRS["sentient-switzer"].sans,
} as CSSProperties;
