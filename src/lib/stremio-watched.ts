import type { Meta } from "./cinemeta";
import type { LibraryItem } from "./stremio";

type CinemetaVideo = NonNullable<Meta["videos"]>[number];

function ordKey(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : -Infinity;
}

function releasedMs(v: CinemetaVideo): number {
  const r = v?.released ?? v?.firstAired;
  if (!r) return -Infinity;
  const t = Date.parse(r);
  return Number.isNaN(t) ? -Infinity : t;
}

function cmpNum(a: number, b: number): number {
  return a === b ? 0 : a < b ? -1 : 1;
}

// Stremio (library_item.rs LibraryItemState.watched_bitfield) indexes the watched
// bitfield against videos sorted by (season, episode, released); bit i is the position
// in THAT order. We must match it or checkmarks land on the wrong episode cross-client.
function canonicalVideoOrder(videos: CinemetaVideo[]): CinemetaVideo[] {
  return [...videos].sort(
    (a, b) =>
      cmpNum(ordKey(a?.season), ordKey(b?.season)) ||
      cmpNum(ordKey(a?.episode), ordKey(b?.episode)) ||
      cmpNum(releasedMs(a), releasedMs(b)),
  );
}

export async function decodeWatchedEpisodes(
  watchedField: string | null | undefined,
  videos: CinemetaVideo[] | undefined,
): Promise<Set<string>> {
  const keys = new Set<string>();
  if (!watchedField || !videos || videos.length === 0) return keys;
  const parts = watchedField.split(":");
  if (parts.length < 3) return keys;
  const b64 = parts[parts.length - 1];
  const anchorLength = Number.parseInt(parts[parts.length - 2], 10);
  const anchorVideoId = parts.slice(0, -2).join(":");
  if (!Number.isFinite(anchorLength) || anchorLength <= 0) return keys;
  let bytes: Uint8Array;
  try {
    const bin = atob(b64);
    const raw = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
    const inflated = new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate"));
    bytes = new Uint8Array(await new Response(inflated).arrayBuffer());
  } catch {
    return keys;
  }
  const bit = (i: number) =>
    i >= 0 && i < bytes.length * 8 && (bytes[i >> 3] & (1 << (i & 7))) !== 0;
  const sorted = canonicalVideoOrder(videos);
  const anchorIdx = sorted.findIndex((v) => v.id === anchorVideoId);
  const offset = anchorLength - anchorIdx - 1;
  for (let i = 0; i < sorted.length; i++) {
    const v = sorted[i];
    if (v?.season != null && v?.episode != null && bit(i + offset)) {
      keys.add(`${v.season}:${v.episode}`);
    }
  }
  return keys;
}

export async function encodeWatchedEpisodes(
  watchedKeys: Set<string>,
  videos: CinemetaVideo[] | undefined,
): Promise<string | null> {
  if (!videos || videos.length === 0) return null;
  const sorted = canonicalVideoOrder(videos);
  const bytes = new Uint8Array(Math.ceil(sorted.length / 8));
  let lastWatched = -1;
  for (let i = 0; i < sorted.length; i++) {
    const v = sorted[i];
    if (v?.season != null && v?.episode != null && watchedKeys.has(`${v.season}:${v.episode}`)) {
      bytes[i >> 3] |= 1 << (i & 7);
      lastWatched = i;
    }
  }
  let b64: string;
  try {
    const deflated = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
    const out = new Uint8Array(await new Response(deflated).arrayBuffer());
    let bin = "";
    for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
    b64 = btoa(bin);
  } catch {
    return null;
  }
  const anchorIdx = Math.max(0, lastWatched);
  const anchorVideoId = sorted[anchorIdx]?.id;
  if (!anchorVideoId) return null;
  return `${anchorVideoId}:${anchorIdx + 1}:${b64}`;
}

export function stremioMovieWatched(item: LibraryItem | null | undefined): boolean {
  if (!item) return false;
  return (item.state?.flaggedWatched ?? 0) > 0 || (item.state?.timesWatched ?? 0) > 0;
}
