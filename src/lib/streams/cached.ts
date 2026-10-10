import type { DebridSlug } from "./types";

export const UNCACHED_MARKER_RX = /\b(?:rd|ad|pm|dl|tb|oc)\s*download\b|\buncached\b|[⬇⏳⌛⏬🔽📥☁]/i;
export const CACHED_MARKER_RX = /[⚡✅]/u;
export const DEBRID_TAG_RX =
  /\[(?:realdebrid|real-debrid|torbox|alldebrid|all-debrid|premiumize|debridlink|debrid-link|easydebrid|offcloud|rd|ad|pm|dl|tb|trb|oc|ed|putio)(?:\+|⚡|✅|⬇|⏳|\]|\s)/iu;

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

export function hasDebridMarker(s: {
  name?: string | null;
  title?: string | null;
  description?: string | null;
}): boolean {
  const haystack = `${s.name ?? ""} ${s.title ?? ""} ${s.description ?? ""}`;
  return DEBRID_TAG_RX.test(haystack) || UNCACHED_MARKER_RX.test(haystack) || CACHED_MARKER_RX.test(haystack);
}

export function isCached(
  s: {
    url?: string;
    cached: Partial<Record<DebridSlug, boolean>>;
    name?: string;
    title?: string;
    description?: string;
  },
  activeDebrids: DebridSlug[],
): boolean {
  return (
    (s.url != null && !hasUncachedMarker(s)) || activeDebrids.some((slug) => s.cached[slug] === true)
  );
}

export function isP2pStream(s: {
  infoHash?: string | null;
  url?: string | null;
  cached?: Partial<Record<string, boolean>>;
  name?: string | null;
  title?: string | null;
  description?: string | null;
}): boolean {
  if (!s.infoHash) return false;
  if (s.cached && Object.values(s.cached).some(Boolean)) return false;
  const haystack = `${s.name ?? ""} ${s.title ?? ""} ${s.description ?? ""}`;
  return !DEBRID_TAG_RX.test(haystack) && !CACHED_MARKER_RX.test(haystack);
}
