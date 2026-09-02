const FADE_MS = 620;

// index-tv.html paints #boot from the html itself, before any bundle exists.
// Only the television entry ships it, so every read here has to tolerate the
// element being absent: on desktop Big Picture there is no boot splash and the
// intro owns the whole opening.
function node(): HTMLElement | null {
  return document.getElementById("boot");
}

let dismissed = false;

export function bpBootSplashUp(): boolean {
  return !dismissed && node() !== null;
}

/**
 * Milliseconds the viewer has already been looking at the boot splash.
 *
 * performance.now() is measured from the navigation, which is the moment the
 * document started, and the splash is the first thing in the body. Returns 0
 * when there was no boot splash so callers can add it unconditionally.
 */
export function bpBootElapsedMs(): number {
  if (!node()) return 0;
  return Math.max(0, Math.round(performance.now()));
}

/**
 * Take the boot splash down.
 *
 * Instant is for the handoff to BpIntro, which draws the same mark in the same
 * place: fading there would cross-dissolve an image with itself and read as a
 * flicker. The fade is for going straight to the home screen.
 */
export function bpBootSplashDismiss(fade: boolean): void {
  const el = node();
  if (!el || dismissed) return;
  dismissed = true;
  if (!fade) {
    el.remove();
    return;
  }
  el.dataset.leaving = "true";
  window.setTimeout(() => el.remove(), FADE_MS);
}
