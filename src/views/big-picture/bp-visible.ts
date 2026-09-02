type VisibilityProbe = { checkVisibility?: (opts: Record<string, boolean>) => boolean };

export function bpStyleVisible(el: HTMLElement): boolean {
  const probe = el as unknown as VisibilityProbe;
  if (typeof probe.checkVisibility === "function") {
    return probe.checkVisibility({ visibilityProperty: true, checkVisibilityCSS: true });
  }
  return window.getComputedStyle(el).visibility !== "hidden";
}

// visibility:hidden still leaves a layout box, so a surface inside the hidden
// shell root measures normally and reads as present to everything except focus.
// During playback there are two [data-bp-root]s and two [data-bp-top-bar]s, one
// of each hidden and EARLIER in document order, so any document-wide lookup
// filters through here or it answers with the one nobody can see.
export function bpFirstVisible(sel: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(sel)) {
    if (bpStyleVisible(el)) return el;
  }
  return null;
}

export function bpSurfaceVisible(el: HTMLElement | null): boolean {
  return el !== null && el.isConnected && bpStyleVisible(el);
}
