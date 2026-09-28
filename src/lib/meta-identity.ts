import type { Meta } from "./cinemeta";

export function metaImdbId(meta: Pick<Meta, "id" | "imdb_id">): string | undefined {
  if (/^tt\d{7,}$/.test(meta.id)) return meta.id;
  return typeof meta.imdb_id === "string" && /^tt\d{7,}$/.test(meta.imdb_id)
    ? meta.imdb_id
    : undefined;
}

export function metaIdentityKeys(meta: Meta): string[] {
  const keys = [`${meta.type}:id:${meta.id}`];
  const imdb = metaImdbId(meta);
  if (imdb) keys.push(`${meta.type}:imdb:${imdb}`);
  const match = meta.id.match(/^tmdb:(?:(?:movie|tv):)?(\d+)$/);
  const tmdb = meta.tmdb_id ?? (match ? Number(match[1]) : undefined);
  if (tmdb !== undefined && Number.isSafeInteger(tmdb) && tmdb > 0) {
    keys.push(`${meta.type}:tmdb:${tmdb}`);
  }
  return keys;
}

export function isAddonNativeMeta(meta: Meta): boolean {
  if (meta.type === "tv" || meta.type === "channel") return true;
  if (meta.id.startsWith("cnative:")) return true;
  if (!meta.addonOrigin && !metaImdbId(meta)) return false;
  const id = meta.id || "";
  const resolvable =
    /^tt\d/.test(id) || id.startsWith("tmdb:") || id.startsWith("kitsu:") || id.startsWith("mal:");
  return !resolvable;
}
