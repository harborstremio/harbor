import type {
  ChromeConfig,
  CustomColors,
  FontPairId,
  ThemeButtonStyle,
  ThemeCardStyle,
  ThemeLayout,
} from "@/lib/theme";

import type { NavCustomization } from "@/chrome/nav-items";

export type Draft = {
  navCustomization: NavCustomization;
  name: string;
  blurb: string;
  layout: ThemeLayout;
  cardStyle: ThemeCardStyle;
  buttonStyle: ThemeButtonStyle;
  fontPair: FontPairId;
  customFontId: string | null;
  bokeh: boolean;
  colors: CustomColors;
  chrome: ChromeConfig;
  chromeDirty: boolean;
  css: string;
  js: string;
  html: string;
};
