let lastDismiss = 0;

export function noteOverlayDismiss(): void {
  lastDismiss = typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function dismissedJustNow(withinMs = 400): boolean {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  return now - lastDismiss < withinMs;
}

export function clearOverlayDismiss(): void {
  lastDismiss = 0;
}

export function watchOutsideMouseDown(handler: (e: MouseEvent) => void): () => void {
  const wrapped = (e: MouseEvent) => {
    if ((e.target as Element | null)?.closest?.("[data-dropdown-menu]")) return;
    noteOverlayDismiss();
    handler(e);
  };
  window.addEventListener("mousedown", wrapped);
  return () => window.removeEventListener("mousedown", wrapped);
}
