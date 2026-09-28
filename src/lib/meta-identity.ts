import type { Meta } from "./cinemeta";

export function metaImdbId(meta: Pick<Meta, "id" | "imdb_id">): string | undefined {
  if (/^tt\d{7,}$/.test(meta.id)) return meta.id;
  return typeof meta.imdb_id === "string" && /^tt\d{7,}$/.test(meta.imdb_id)
    ? meta.imdb_id
    : undefined;
}

export function isAddonNativeMeta(meta: Meta): boolean {
  if (meta.type === "tv" || meta.type === "channel") return true;
  if (meta.id.startsWith("cnative:")) return true;
  if (!meta.addonOrigin) return false;
  const id = meta.id || "";
  const resolvable =
    /^tt\d/.test(id) || id.startsWith("tmdb:") || id.startsWith("kitsu:") || id.startsWith("mal:");
  return !resolvable;
}

export function metaIdentityKeys(meta: Meta): string[] {
  const keys = [`${meta.type}:id:${meta.id}`];
  const imdbId = metaImdbId(meta);
  if (imdbId) keys.push(`${meta.type}:imdb:${imdbId}`);
  const tmdbMatch = meta.id.match(/^tmdb:(movie|tv):(\d+)$/);
  const tmdbId = meta.tmdb_id ?? (tmdbMatch ? Number(tmdbMatch[2]) : undefined);
  if (tmdbId !== undefined && Number.isSafeInteger(tmdbId) && tmdbId > 0) {
    keys.push(`${meta.type}:tmdb:${tmdbId}`);
  }
  return keys;
}
