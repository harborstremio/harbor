import type { ContextImage } from "./context-image";

export type ContentContext = { image?: ContextImage; link?: string; selection?: string };

export function editingTarget(target: EventTarget | null): HTMLElement | null {
  const el = target instanceof Element ? target : null;
  // Read-only fields still need native selection/copy. Password restrictions
  // are left to the engine, together with IME, undo and caret behavior.
  return (
    el?.closest<HTMLElement>("input,textarea,[contenteditable]:not([contenteditable='false'])") ??
    null
  );
}

export function clickedContent(target: EventTarget | null): ContentContext {
  if (!(target instanceof Element)) return {};
  const content: ContentContext = {};
  const selected = window.getSelection();
  if (selected && !selected.isCollapsed && selected.rangeCount) {
    try {
      if (selected.getRangeAt(0).intersectsNode(target)) content.selection = selected.toString();
    } catch {
      /* Detached hover content cannot own a selection. */
    }
  }
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (anchor) content.link = anchor.href;
  const img = target.closest<HTMLImageElement>("img");
  if (img?.currentSrc || img?.src) {
    content.image = { src: img.currentSrc || img.src, label: img.alt || undefined };
  }
  return content;
}
