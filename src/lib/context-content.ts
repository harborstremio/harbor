import type { ContextImage } from "./context-image";

export type ContentContext = { image?: ContextImage; link?: string; selection?: string };

const keyboardInvocations = new WeakSet<MouseEvent>();

/** Position keyboard menus by their focus origin without treating that position
 * as a pointer hit. The marker is internal and cannot be conferred by markup. */
export function dispatchKeyboardContextMenu(origin: HTMLElement): void {
  const rect = origin.getBoundingClientRect();
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + Math.min(rect.width / 2, 24),
    clientY: rect.bottom,
  });
  keyboardInvocations.add(event);
  origin.dispatchEvent(event);
}

export function contextPointerPoint(
  event: MouseEvent | { nativeEvent: MouseEvent },
): { x: number; y: number } | undefined {
  const native = "nativeEvent" in event ? event.nativeEvent : event;
  return keyboardInvocations.has(native) || !(native.clientX || native.clientY)
    ? undefined
    : { x: native.clientX, y: native.clientY };
}

export function editingTarget(target: EventTarget | null): HTMLElement | null {
  const el = target instanceof Element ? target : null;
  // Read-only fields still need native selection/copy. Password restrictions
  // are left to the engine, together with IME, undo and caret behavior.
  return (
    el?.closest<HTMLElement>("input,textarea,[contenteditable]:not([contenteditable='false'])") ??
    null
  );
}

export function clickedContent(
  target: EventTarget | null,
  point?: { x: number; y: number },
): ContentContext {
  if (!(target instanceof Element)) return {};
  const content: ContentContext = {};
  const selected = window.getSelection();
  if (selected && !selected.isCollapsed && selected.rangeCount) {
    try {
      const range = selected.getRangeAt(0);
      const owner =
        range.commonAncestorContainer instanceof Element
          ? range.commonAncestorContainer
          : range.commonAncestorContainer.parentElement;
      // A broad container intersecting a stale selection does not mean the
      // user clicked that selection. Pointer summons must hit selected text.
      const ownsSelection = point
        ? Array.from(range.getClientRects()).some(
            (rect) =>
              point.x >= rect.left &&
              point.x <= rect.right &&
              point.y >= rect.top &&
              point.y <= rect.bottom,
          )
        : owner === target || !!owner?.contains(target);
      if (ownsSelection && range.intersectsNode(target)) content.selection = selected.toString();
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
