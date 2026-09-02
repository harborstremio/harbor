import { t } from "@/lib/i18n";
import type { CustomizationInput } from "../profile-types";

export const CANVAS_MIN = 200;
export const CANVAS_MAX = 1400;
export const CANVAS_DEFAULT = 520;
export const MARKUP_CAP = 16384;
export const IMAGE_URL_MAX = 2048;

export const SUGGESTED_FONTS = [
  "Inter",
  "Fraunces",
  "Poppins",
  "Space Grotesk",
  "Playfair Display",
  "DM Serif Display",
  "JetBrains Mono",
  "Lora",
];

const FONT_RE = /^[A-Za-z0-9 ]{1,48}$/;
const COLOR_HEX_RE = /^#[0-9a-fA-F]{3,8}$/;
const COLOR_FN_RE = /^(rgb|rgba|hsl|hsla)\([0-9.,%\s]{1,60}\)$/;
const IMAGE_RE = new RegExp(`^https://[^\\s"'<>\\\\]{1,${IMAGE_URL_MAX}}$`);

export function validFont(value: string): boolean {
  return FONT_RE.test(value);
}

export function validColor(value: string): boolean {
  return COLOR_HEX_RE.test(value) || COLOR_FN_RE.test(value);
}

export function validImage(value: string): boolean {
  return IMAGE_RE.test(value);
}

export function validateCustomization(form: CustomizationInput): string | null {
  const font = form.profileFont.trim();
  if (font && !validFont(font)) return t("Font name can only use letters, numbers, and spaces.");
  const color = form.pageBgColor.trim();
  if (color && !validColor(color)) return t("Background color must be a hex or rgb/hsl value.");
  const image = form.pageBgImage.trim();
  if (image && !validImage(image)) return t("Background image must be an https URL.");
  const favicon = form.profileFavicon.trim();
  if (favicon && !validImage(favicon)) return t("Favicon must be an https URL.");
  if (form.customHtml.length > MARKUP_CAP) return t("Custom HTML is too large.");
  if (form.customCss.length > MARKUP_CAP) return t("Custom CSS is too large.");
  return null;
}
