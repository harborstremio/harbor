import type { LocalEntry } from "@/lib/local-library";

// Deliberately self-contained (type-only imports): tests run under `node --test`
// with no path-alias resolution, so anything with runtime imports is untestable.
// Mirrors the normalizer in @/lib/streams/library.
function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\s.\-_()[\]:;,!?'"‘’“”–—]+/g, "");
}

/**
 * Identity of the *title* a file belongs to. Metadata id wins; normalized
 * title + year is the fallback for files that never resolved to an id.
 */
export function localTitleKey(entry: LocalEntry): string {
  if (entry.tmdbId != null) {
    return `tmdb:${entry.type === "show" ? "tv" : "movie"}:${entry.tmdbId}`;
  }
  if (entry.imdbId) return entry.imdbId;
  const title = normalizeTitle(entry.title || entry.filename);
  return `title:${entry.type}:${title}:${entry.year ?? "?"}`;
}

/**
 * Identity of the thing a poster/row represents: a movie, or one episode of a
 * show. Two files sharing this key are two versions of the same content.
 */
export function localGroupKey(entry: LocalEntry): string {
  const base = localTitleKey(entry);
  if (entry.type !== "show") return base;
  return `${base}:s${entry.season ?? 0}e${entry.episode ?? 0}`;
}
