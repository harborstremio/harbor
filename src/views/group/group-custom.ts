import type { GroupDetail } from "@/lib/social/groups";
import { CANVAS_DEFAULT, validColor, validFont, validImage } from "@/views/profile/customization/customization-types";

export type ResolvedGroupCustom = {
  font: string;
  fontHref: string;
  background: string;
  html: string;
  css: string;
  height: number;
  hasCanvas: boolean;
  hiddenFromMembers: boolean;
};

const SCRIM = "color-mix(in oklab, var(--color-canvas) 62%, transparent)";

export function resolveGroupCustom(g: GroupDetail): ResolvedGroupCustom {
  const shown = !!g.customEnabled || g.isOwner;
  const font = shown && g.groupFont && validFont(g.groupFont) ? g.groupFont : "";
  const bgColor = shown && g.pageBgColor && validColor(g.pageBgColor) ? g.pageBgColor : "";
  const bgImage = shown && g.pageBgImage && validImage(g.pageBgImage) ? g.pageBgImage : "";
  let background = "";
  if (bgImage) {
    const base = bgColor || "var(--color-canvas)";
    background = `linear-gradient(${SCRIM}, ${SCRIM}), ${base} url("${bgImage}") center/cover fixed no-repeat`;
  } else if (bgColor) {
    background = bgColor;
  }
  const html = shown ? g.customHtml ?? "" : "";
  const css = shown ? g.customCss ?? "" : "";
  return {
    font,
    fontHref: font
      ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;500;600;700&display=swap`
      : "",
    background,
    html,
    css,
    height: g.canvasHeight ?? CANVAS_DEFAULT,
    hasCanvas: html.trim().length > 0 || css.trim().length > 0,
    hiddenFromMembers: !g.customEnabled && g.isOwner,
  };
}
