import { useEffect } from "react";
import type { ProfileSummary } from "../profile-types";
import { CANVAS_DEFAULT, validColor, validFont, validImage } from "./customization-types";

export type ResolvedCustom = {
  allowed: boolean;
  font: string;
  fontHref: string;
  background: string;
  html: string;
  css: string;
  height: number;
  hasCanvas: boolean;
  hiddenFromVisitors: boolean;
  hideTopBanner: boolean;
  hideCardTitles: boolean;
};

const SCRIM = "color-mix(in oklab, var(--color-canvas) 62%, transparent)";

export function resolveCustomization(s: ProfileSummary): ResolvedCustom {
  const allowed = !!(s.customEnabled || s.isOwner);
  const font = allowed && s.profileFont && validFont(s.profileFont) ? s.profileFont : "";
  const fontHref = font
    ? `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;500;600;700&display=swap`
    : "";
  const bgColor = allowed && s.pageBgColor && validColor(s.pageBgColor) ? s.pageBgColor : "";
  const bgImage = allowed && s.pageBgImage && validImage(s.pageBgImage) ? s.pageBgImage : "";
  let background = "";
  if (bgImage) {
    const base = bgColor || "var(--color-canvas)";
    background = `linear-gradient(${SCRIM}, ${SCRIM}), ${base} url("${bgImage}") center/cover fixed no-repeat`;
  } else if (bgColor) {
    background = bgColor;
  }
  const html = s.customHtml || "";
  const css = s.customCss || "";
  const hasCanvas = allowed && (html.trim().length > 0 || css.trim().length > 0);
  return {
    allowed,
    font,
    fontHref,
    background,
    html,
    css,
    height: s.canvasHeight ?? CANVAS_DEFAULT,
    hasCanvas,
    hiddenFromVisitors: !s.customEnabled && !!s.isOwner,
    hideTopBanner: allowed && !!s.hideTopBanner,
    hideCardTitles: allowed && !!s.hideCardTitles,
  };
}

export function useFontLink(href: string): void {
  useEffect(() => {
    if (!href) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    link.setAttribute("data-harbor-userfont", "");
    document.head.appendChild(link);
    return () => {
      link.remove();
    };
  }, [href]);
}
