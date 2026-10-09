export const SOFT_LOAD_TIMEOUT_MS = 7_500;
export const EXTERNAL_LINK_FRAME_SANDBOX = "allow-scripts";
export const EXTERNAL_LINK_FRAME_PERMISSIONS =
  "camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; " +
  "clipboard-write 'none'; fullscreen 'none'; payment 'none'; usb 'none'; " +
  "serial 'none'; hid 'none'; display-capture 'none'; autoplay 'none'";

export type ExternalLinkViewerTimerScheduler = {
  setTimeout(callback: () => void, delay: number): number;
  clearTimeout(timeoutId: number): void;
};

export function createSoftLoadTimeout(
  onSlow: () => void,
  scheduler: ExternalLinkViewerTimerScheduler,
) {
  let timeoutId: number | null = null;
  let settled = false;

  const clear = () => {
    if (timeoutId === null) return;
    scheduler.clearTimeout(timeoutId);
    timeoutId = null;
  };

  return {
    start() {
      if (settled) return;
      clear();
      timeoutId = scheduler.setTimeout(() => {
        timeoutId = null;
        if (!settled) onSlow();
      }, SOFT_LOAD_TIMEOUT_MS);
    },
    settle() {
      settled = true;
      clear();
    },
    dispose() {
      settled = true;
      clear();
    },
  };
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  'input:not([disabled]):not([type="hidden"])',
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(", ");

function focusableElements(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("disabled") && element.tabIndex >= 0,
  );
}

export function createExternalLinkViewerFocusScope(
  root: HTMLElement,
  initialFocus: HTMLElement | null,
) {
  const { ownerDocument } = root;
  const previousFocus = ownerDocument.activeElement as HTMLElement | null;
  const previousOverflow = ownerDocument.body.style.overflow;

  const focusInitial = () => {
    const currentInitial = root.querySelector<HTMLElement>("[data-tv-initial-focus]");
    const target =
      currentInitial ??
      (initialFocus && root.contains(initialFocus)
        ? initialFocus
        : (focusableElements(root)[0] ?? root));
    target.focus();
  };

  const onFocusIn = (event: FocusEvent) => {
    if (!root.contains(event.target as Node)) focusInitial();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return;
    event.stopPropagation();
    const focusable = focusableElements(root);
    if (focusable.length === 0) {
      event.preventDefault();
      root.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const activeIndex = focusable.indexOf(ownerDocument.activeElement as HTMLElement);
    if (
      event.shiftKey ? activeIndex <= 0 : activeIndex === -1 || activeIndex === focusable.length - 1
    ) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  };

  ownerDocument.body.style.overflow = "hidden";
  ownerDocument.addEventListener("focusin", onFocusIn, true);
  root.addEventListener("keydown", onKeyDown);
  focusInitial();

  return () => {
    root.removeEventListener("keydown", onKeyDown);
    ownerDocument.removeEventListener("focusin", onFocusIn, true);
    ownerDocument.body.style.overflow = previousOverflow;
    if (previousFocus?.isConnected) previousFocus.focus();
  };
}
