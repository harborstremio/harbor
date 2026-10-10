import type { searchTyped } from "@/lib/music/catalog";
import type { MusicSearchHit } from "@/lib/search";
import { artistIdentityKey } from "@/lib/music/artist-authority";
import { audienceValue, SUBSTANTIVE_AUDIENCE } from "@/lib/music/artist-popularity";

const first = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

/** Artists lead, then albums, then songs: a name query should not be buried under its own tracks. */
export function toMusicHits(results: Awaited<ReturnType<typeof searchTyped>>): MusicSearchHit[] {
  return [
    ...results.artists.slice(0, 3).map((artist) => ({
      id: `artist:${artist.connectorId ?? ""}:${artist.id}`,
      kind: "artist" as const,
      title: artist.name,
      subtitle: artist.subtitle ?? "",
      artwork: first(artist.artwork),
    })),
    ...results.albums.slice(0, 3).map((album) => ({
      id: `album:${album.connectorId ?? ""}:${album.id}`,
      kind: "album" as const,
      title: album.title,
      subtitle: album.artist,
      artwork: first(album.artwork),
    })),
    ...results.tracks.slice(0, 4).map((track) => ({
      id: `track:${track.connectorId ?? ""}:${track.id}`,
      kind: "track" as const,
      title: track.title,
      subtitle: track.artist,
      artwork: first(track.artwork),
    })),
  ];
}

/** A person page must show only that artist's own releases, never every namesake in the catalog. */
export function personMusicHits(
  results: Awaited<ReturnType<typeof searchTyped>>,
  name: string,
): MusicSearchHit[] {
  const wanted = artistIdentityKey(name);
  if (!wanted) return [];
  const mine = (credit: string) => artistIdentityKey(credit) === wanted;
  const recognised = results.artists.some(
    (artist) => mine(artist.name) && audienceValue(artist.subtitle) >= SUBSTANTIVE_AUDIENCE,
  );
  if (!recognised) return [];
  return [
    ...results.albums.filter((album) => mine(album.artist)).map((album) => ({
      id: `album:${album.connectorId ?? ""}:${album.id}`,
      kind: "album" as const,
      title: album.title,
      subtitle: album.artist,
      artwork: first(album.artwork),
    })),
    ...results.tracks.filter((track) => mine(track.artist)).map((track) => ({
      id: `track:${track.connectorId ?? ""}:${track.id}`,
      kind: "track" as const,
      title: track.title,
      subtitle: track.artist,
      artwork: first(track.artwork),
    })),
  ].slice(0, 20);
}
