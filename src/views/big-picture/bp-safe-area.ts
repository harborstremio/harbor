const ZERO = Object.freeze({ x: 0, y: 0 });

const MAX_OVERSCAN = 0.1;

// Fire TV certification asks for 5 percent, which is the widest crop any panel
// has ever taken, not the crop a panel takes. HDMI sets have defaulted to 1:1
// for years, so spending 5 percent by default gives up 96px an edge at 1920 to
// a crop that is almost never there. 2 percent is the token inset the design
// gutter absorbs for free; anyone on a set that really does crop raises
// bigPictureOverscan and the gutter grows to clear it.
export const TEN_FOOT_OVERSCAN = 0.02;

// Must stay equal to STORAGE_KEY in lib/settings/defaults. It is duplicated
// instead of imported because that module drags the theme graph in behind it,
// and this one resolves at import time underneath the focus core.
const SETTINGS_KEY = "harbor.settings";

// Set-top browsers declare their form factor in the user agent and nowhere
// else. There is no API for "am I on a television". Fire TV stamps an
// AFT<model> token on every device it has shipped, and that test stays case
// sensitive so an ordinary word ending in "aft" cannot match it.
const FIRE_TV_UA = /\bAFT[A-Z0-9]+\b/;
const TEN_FOOT_UA =
  /Android ?TV|Google ?TV|SMART-?TV|Tizen|Web ?0S|WebOS|NetCast|BRAVIA|HbbTV|CrKey|VIDAA/i;

function clampOverscan(fraction: number): number {
  return Number.isFinite(fraction) ? Math.min(MAX_OVERSCAN, Math.max(0, fraction)) : 0;
}

function urlOverscan(): number | null {
  try {
    const raw = new URLSearchParams(window.location.search).get("overscan");
    return raw === null ? null : clampOverscan(Number(raw));
  } catch {
    return null;
  }
}

function settingOverscan(): number | null {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as { bigPictureOverscan?: unknown } | null;
    const value = stored?.bigPictureOverscan;
    return typeof value === "number" ? clampOverscan(value) : null;
  } catch {
    return null;
  }
}

function tenFootDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent ?? "";
  return FIRE_TV_UA.test(ua) || TEN_FOOT_UA.test(ua);
}

// bp-shell reads bpOverscan() once, inside a useMemo keyed on playback, so
// whatever the first render sees is what the whole session keeps. A source that
// cannot answer synchronously at import time cannot be a source here at all.
function resolveOverscan(): number | null {
  if (typeof window === "undefined") return null;
  const forced = urlOverscan();
  if (forced !== null) return forced;
  return settingOverscan();
}

// null means nobody asked for a specific crop, which is what lets the TV entry
// supply a default without outranking a URL param or a stored setting.
const chosen = resolveOverscan();
let overscan = chosen ?? (typeof window !== "undefined" && tenFootDevice() ? TEN_FOOT_OVERSCAN : 0);
let explicit = chosen !== null;

export function bpOverscan(): number {
  return overscan;
}

export function setBpOverscan(fraction: number): void {
  overscan = clampOverscan(fraction);
  explicit = true;
}

/**
 * What an entry point that knows its own form factor should call. It loses to
 * ?overscan= and to a stored bigPictureOverscan, so a viewer whose panel has no
 * crop can still switch it off on the one build that assumes there is one.
 * ES imports evaluate before module bodies, so a plain assignment here would be
 * last-wins and would silently discard both of those.
 */
export function setBpOverscanDefault(fraction: number): void {
  if (explicit) return;
  overscan = clampOverscan(fraction);
}

export function bpSafeAreaPx(): { x: number; y: number } {
  if (overscan <= 0 || typeof window === "undefined") return ZERO;
  return {
    x: Math.round(overscan * window.innerWidth),
    y: Math.round(overscan * window.innerHeight),
  };
}
