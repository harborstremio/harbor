import { artistCreditParts } from "@/lib/music/search-artists";
import { featuredCreditNames } from "@/lib/music/artist-credit";
import { artistIdentityKey, identityForRef, resolveArtist } from "@/lib/music/artist-authority";
import { loadRecordingProfile } from "@/lib/music/recording-profile";
import { loadArtistRarities } from "@/lib/music/artist-rarities";
import {
  albumTracks,
  artistCatalog,
  artistRows,
  catalogPlaylistTracks,
  localCollection,
  searchTyped,
  stationTracks,
} from "@/lib/music/catalog";
import { errorText } from "@/components/music/music-connections/connection-row";
import type { MusicArtistRef, MusicCatalogItem, MusicTrack } from "@/lib/music/types";
import type { MusicDetailState } from "./music-detail";
import { tracksOf } from "./music-band-types";

function creditedTo(track: MusicTrack, name: string): boolean {
  const wanted = artistIdentityKey(name);
  return [track.artist, ...artistCreditParts(track.artist)].some(
    (part) => artistIdentityKey(part) === wanted,
  );
}

// Only reached when the artist's own connector returned nothing, so excluding that
// connector here would discard the best source and leave a major artist on a handful
// of guest features. Keep it, and search wide enough to be worth showing.
async function artistTracksElsewhere(artist: MusicArtistRef): Promise<MusicTrack[]> {
  const results = await searchTyped(artist.name, 60).catch(() => null);
  if (!results) return [];
  const seen = new Set<string>();
  const padded: MusicTrack[] = [];
  for (const track of results.tracks) {
    if (!creditedTo(track, artist.name)) continue;
    const key = `${artistIdentityKey(track.title)}|${artistIdentityKey(track.artist)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    padded.push(track);
  }
  return padded;
}

export async function loadDetailTracks(
  item: MusicCatalogItem,
): Promise<Pick<MusicDetailState, "tracks" | "nextOffset" | "trackCursor" | "trackScope">> {
  if (item.kind === "artist") {
    if (item.connectorId === "local") {
      const page = await localCollection("tracks", "", 0, item.id);
      return { tracks: tracksOf(page.items), nextOffset: page.nextOffset, trackScope: "catalog" };
    }
    let refusal: unknown = null;
    try {
      const page = await artistCatalog(item, "tracks");
      if (page.items.length)
        return {
          tracks: tracksOf(page.items),
          trackCursor: page.nextCursor,
          trackScope: page.scope,
        };
    } catch (error) {
      refusal = error;
    }
    const padded = await artistTracksElsewhere(item);
    if (padded.length) return { tracks: padded, trackScope: "top" };
    if (refusal) throw refusal;
    return { tracks: [], trackScope: "top" };
  }
  return {
    tracks:
      item.kind === "track"
        ? [item]
        : item.kind === "album"
          ? await albumTracks(item)
          : item.kind === "playlist"
            ? await catalogPlaylistTracks(item)
            : await stationTracks(item),
  };
}

export async function loadDetailRows(
  item: MusicCatalogItem,
): Promise<Pick<MusicDetailState, "rows" | "rowsError" | "releaseCursor">> {
  if (item.kind === "artist") {
    const releases =
      item.connectorId === "local" ? Promise.resolve(null) : artistCatalog(item, "albums");
    const rarities =
      item.connectorId === "local"
        ? Promise.resolve([] as MusicTrack[])
        : loadArtistRarities(item.name);
    const playlists =
      item.connectorId === "local"
        ? Promise.resolve([] as MusicCatalogItem[])
        : searchTyped(item.name, 24).then((found) =>
            found.playlists.map((playlist) => ({ ...playlist, kind: "playlist" as const })),
          );
    const [related, albums, rare, lists] = await Promise.allSettled([
      artistRows(item),
      releases,
      rarities,
      playlists,
    ]);
    const page = albums.status === "fulfilled" ? albums.value : null;
    const rows =
      related.status === "fulfilled"
        ? related.value
            .map((row) => ({
              ...row,
              items: row.items.filter(
                (entry) =>
                  item.connectorId === "local" ||
                  (entry.kind !== "album" && entry.kind !== "track"),
              ),
            }))
            .filter((row) => row.items.length)
        : [];
    const inPlaylists = lists.status === "fulfilled" ? lists.value : [];
    if (inPlaylists.length)
      rows.push({
        id: "artist:playlists",
        title: "music.row.playlists",
        titleLiteral: false,
        layout: "covers",
        source: "",
        items: inPlaylists,
      });
    const rareTracks = rare.status === "fulfilled" ? rare.value : [];
    if (rareTracks.length)
      rows.unshift({
        id: "artist:rarities",
        title: "music.artist.rarities",
        titleLiteral: false,
        layout: "trackGrid",
        source: "",
        items: rareTracks.map((track) => ({ ...track, kind: "track" as const })),
      });
    if (page)
      rows.unshift({
        id: "artist:releases",
        title: "music.artist.releases",
        titleLiteral: false,
        layout: "covers",
        source: item.connectorId,
        items: page.items,
      });
    return {
      rows,
      releaseCursor: page?.nextCursor,
      rowsError:
        albums.status === "rejected"
          ? errorText(albums.reason)
          : related.status === "rejected"
            ? errorText(related.reason)
            : "",
    };
  }
  if (item.kind === "album") {
    const connector = item.connectorId === "local" ? undefined : item.connectorId;
    const results = await searchTyped(item.artist, 24, connector);
    const credits = new Set(
      [item.artist, ...artistCreditParts(item.artist)].map(artistIdentityKey),
    );
    const albums = results.albums
      .filter((album) => album.id !== item.id && credits.has(artistIdentityKey(album.artist)))
      .map((album) => ({ ...album, kind: "album" as const }));
    const rows = albums.length
      ? [
          {
            id: "album:more",
            title: "music.detail.moreAlbums",
            titleLiteral: false,
            layout: "covers" as const,
            source: item.connectorId,
            items: albums,
          },
        ]
      : [];
    return { rows, rowsError: "" };
  }
  if (item.kind !== "track") return { rows: [], rowsError: "" };
  const connector = item.connectorId === "local" ? undefined : item.connectorId;
  const results = await searchTyped(item.artist, 24, connector);
  const profile = await loadRecordingProfile(item).catch(() => null);
  const credits = new Set([item.artist, ...artistCreditParts(item.artist)].map(artistIdentityKey));
  // A recording's credited identities take precedence over a combined display label.
  const credited =
    profile?.primaryArtist.name === item.artist
      ? [item.artist]
      : artistCreditParts(item.artist)
          .map((name) => name.trim())
          .filter(Boolean);
  const creditedKeys = new Set(credited.map(artistIdentityKey));
  // Most catalogues credit only the lead and bury the guests in the title.
  const names = [
    ...credited,
    ...featuredCreditNames(item.title).filter(
      (name) => !creditedKeys.has(artistIdentityKey(name)),
    ),
  ];
  const artists = (
    await Promise.all(
      names.map(async (name) => {
        const known = profile?.credits.find(
          (credit) => artistIdentityKey(credit.name) === artistIdentityKey(name),
        )?.artist;
        if (known) return [await identityForRef(known)];
        const canonical = (await resolveArtist(name)).canonical;
        return canonical ? [canonical] : [];
      }),
    )
  ).flat();
  const uniqueArtists = [
    ...new Map(artists.map((artist) => [`${artist.connectorId}:${artist.id}`, artist])).values(),
  ];
  const rows = [
    {
      id: "song-artists",
      title: "music.search.artists",
      titleLiteral: false,
      layout: "circles" as const,
      source: "",
      items: uniqueArtists.map((artist) => ({ ...artist, kind: "artist" as const })),
    },
    {
      id: "song-albums",
      title: "music.search.albums",
      titleLiteral: false,
      layout: "covers" as const,
      source: "",
      items: results.albums
        .filter((album) => credits.has(artistIdentityKey(album.artist)))
        .map((album) => ({ ...album, kind: "album" as const })),
    },
    {
      id: "song-tracks",
      title: "music.search.tracks",
      titleLiteral: false,
      layout: "covers" as const,
      source: "",
      items: results.tracks
        .filter((track) => track.id !== item.id && credits.has(artistIdentityKey(track.artist)))
        .map((track) => ({ ...track, kind: "track" as const })),
    },
  ].filter((row) => row.items.length);
  return { rows, rowsError: "" };
}
