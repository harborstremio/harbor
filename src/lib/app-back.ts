/** Keep the visible command and the actual side-button path equivalent. */
export function requestAppBack(
  canGoBack: boolean,
  goBack: () => void,
  events: Pick<EventTarget, "dispatchEvent"> = window,
): boolean {
  if (!events.dispatchEvent(new Event("harbor:local-back", { cancelable: true }))) return true;
  if (!canGoBack) return false;
  goBack();
  return true;
}

const capabilities = new Set<() => boolean>();
const listeners = new Set<() => void>();
export function notifyLocalBackCapability(): void {
  listeners.forEach((listener) => listener());
}
export function registerLocalBackCapability(read: () => boolean): () => void {
  capabilities.add(read);
  notifyLocalBackCapability();
  return () => {
    capabilities.delete(read);
    notifyLocalBackCapability();
  };
}
export function hasLocalBackCapability(): boolean {
  return [...capabilities].some((read) => read());
}
export function subscribeLocalBackCapability(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
