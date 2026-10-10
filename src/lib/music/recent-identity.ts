import { artistIdentityKey } from "./artist-popularity";
import { normalizeName } from "./search-normalize";
import type { MusicRecentContext } from "./recent-context";
import type { MusicDestination } from "./recent-destinations";

export function musicDestinationIdentity(entry: Pick<MusicDestination, "kind" | "id" | "name" | "artist" | "connectorId">): string {
  if (entry.kind === "liked") return "liked";
  if (entry.kind === "artist") return `artist:${artistIdentityKey(entry.name)}`;
  // A title alone cannot identify a recording or album; preserve different artists/editions.
  if (entry.artist?.trim()) return `${entry.kind}:${normalizeName(entry.name)}:${artistIdentityKey(entry.artist)}`;
  return `${entry.kind}:${entry.connectorId ?? ""}:${entry.id}`;
}

export function legacySingleArtist(context: Pick<MusicRecentContext, "id" | "seed">): string | null {
  if (!context.id.startsWith("mix:daily:v2:")) return null;
  try {
    const artists = new Set(context.id.slice("mix:daily:v2:".length).split("|").map(value => artistIdentityKey(decodeURIComponent(value))));
    if (artists.size !== 1 || !context.seed) return null;
    return context.seed.artist;
  } catch { return null; }
}

export function musicRecentContextIdentity(context: Pick<MusicRecentContext, "kind" | "id" | "seed">): string {
  if (context.kind === "similar") {
    const personalGenre = /^mix:personal:v2:([a-z0-9]+):\d{4}-\d{2}-\d{2}:genre:(\d+)$/.exec(context.id);
    if (personalGenre) return `genre-mix:${personalGenre[1]}:${personalGenre[2]}`;
    const personal = /^mix:personal:v2:([a-z0-9]+):\d{4}-\d{2}-\d{2}:([a-z0-9]+)(:artist)?$/.exec(context.id);
    if (personal) return personal[3] && context.seed ? `artist-mix:${artistIdentityKey(context.seed.collectionOrigin?.artist || context.seed.artist)}` : `daily-mix:${personal[1]}:${personal[2]}`;
    const genre = /^mix:discovery:v1:\d{4}-\d{2}-\d{2}:(\d+):/.exec(context.id)?.[1]
      ?? /^mix:genre:(\d+)$/.exec(context.id)?.[1];
    if (genre) return `genre-mix:${genre}`;
    const artist = legacySingleArtist(context) ?? (context.id.startsWith("mix:artist:") ? context.id.slice("mix:artist:".length) : null);
    if (artist) return `artist-mix:${artistIdentityKey(artist)}`;
  }
  return `${context.kind}:${context.id}`;
}

/** Keep the newest actionable destination; dedupe before limiting so older unique tiles fill in. */
export function uniqueMusicRecents<T extends { at: number }>(entries: readonly T[], identity: (entry: T) => string): T[] {
  const seen = new Set<string>();
  return [...entries].sort((a, b) => b.at - a.at).filter(entry => {
    const key = identity(entry);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
