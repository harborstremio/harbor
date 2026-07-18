export const UNCACHED_MARKER_RX =
  /\b(?:rd|ad|pm|dl|tb|oc)\s*download\b|\buncached\b|[⬇⏳⌛⏬🔽📥☁]/i;
export const CACHED_MARKER_RX = /[⚡✅]/u;

export function hasUncachedMarker(s: {
  name?: string | null;
  title?: string | null;
  description?: string | null;
}): boolean {
  const haystack = `${s.name ?? ""} ${s.title ?? ""} ${s.description ?? ""}`;
  return UNCACHED_MARKER_RX.test(haystack);
}

export function hasCachedMarker(s: {
  name?: string | null;
  title?: string | null;
  description?: string | null;
}): boolean {
  const haystack = `${s.name ?? ""} ${s.title ?? ""} ${s.description ?? ""}`;
  return CACHED_MARKER_RX.test(haystack);
}
