import type { PlayerEmbedRect } from "./bridge";

export function readEmbedRect(element: HTMLElement | null): PlayerEmbedRect | null {
  if (!element || element.closest('[data-detached="true"]')) return null;
  const rect = element.getBoundingClientRect();
  const doc = document.documentElement;
  const view = doc.getBoundingClientRect();
  const usable = view.width > 0 && view.height > 0;
  return {
    cssLeft: usable ? rect.left - view.left : rect.left,
    cssTop: usable ? rect.top - view.top : rect.top,
    cssWidth: rect.width,
    cssHeight: rect.height,
    cssViewW: usable ? view.width : doc.clientWidth,
    cssViewH: usable ? view.height : doc.clientHeight,
  };
}
