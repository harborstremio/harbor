export type LibraryShuffle = { version: 1; seed: number; enabled: boolean };
export const libraryShuffleKey = (profile: string) => `harbor.games.shuffle.v1:${encodeURIComponent(profile)}`;
export const LIBRARY_SHUFFLE_CHANGED = "harbor:library-shuffle-changed";
export function parseLibraryShuffle(raw: string | null): LibraryShuffle {
  if (raw === null) return { version: 1, seed: 0, enabled: false };
  if (raw.length > 256) throw Error("library_shuffle_read");
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Number.isInteger(value.seed) || value.seed < 0 || value.seed > 0xffffffff || typeof value.enabled !== "boolean") throw Error("library_shuffle_read");
  return { version: 1, seed: value.seed, enabled: value.enabled };
}
/** Stable per-identity ranks keep the surviving order intact when filters or artwork change. */
export function libraryShuffleRank(id: string, seed: number): number {
  let hash = (2166136261 ^ seed) >>> 0;
  for (let index = 0; index < id.length; index++) hash = Math.imul(hash ^ id.charCodeAt(index), 16777619);
  hash ^= hash >>> 16; hash = Math.imul(hash, 0x7feb352d); hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b); return (hash ^ hash >>> 16) >>> 0;
}
export function nextLibraryShuffleSeed(previous: number): number {
  const value = crypto.getRandomValues(new Uint32Array(1))[0];
  return value === previous ? (value + 1) >>> 0 : value;
}
