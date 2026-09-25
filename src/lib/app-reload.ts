/** Reload only this application surface, as the existing File → Reload command does. */
export function reloadAppWindow(): void {
  window.location.reload();
}
