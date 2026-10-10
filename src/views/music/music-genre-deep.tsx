import { useEffect, useMemo, useRef, useState } from "react";
import { MusicCollectionGrid } from "@/components/music/music-collection-grid";
import { MusicSectionHead } from "@/components/music/music-track-grid";
import { MusicTrackGrid } from "@/components/music/music-track-grid";
import { useT } from "@/lib/i18n";
import {
  loadMusicGenreArtistsPage,
  loadMusicGenreTracksPage,
  type MusicGenreArtist,
} from "@/lib/music/discovery";
import type { MusicDiscoveryGenre } from "@/lib/music/genre-catalog";
import type { MusicCollectionEntry } from "@/lib/music/library-collections";
import type { MusicCatalogItem, MusicTrack } from "@/lib/music/types";
import { trackItem } from "./music-band-types";

type Lane = "songs" | "albums" | "artists";
const LANES: readonly Lane[] = ["songs", "albums", "artists"];
type Album = Extract<MusicCatalogItem, { kind: "album" }>;

const firstArtwork = (value: string | string[] | undefined) =>
  typeof value === "string" ? value : (value?.[0] ?? "");

export function MusicGenreDeep({
  genre,
  active,
  onOpen,
  onPlay,
}: {
  genre: MusicDiscoveryGenre;
  active: boolean;
  onOpen: (item: MusicCatalogItem, siblings: MusicCatalogItem[]) => void;
  onPlay: (track: MusicTrack, queue: MusicTrack[]) => void;
}) {
  const t = useT();
  const [lane, setLane] = useState<Lane>("songs");
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [artists, setArtists] = useState<MusicGenreArtist[]>([]);
  const [page, setPage] = useState(0);
  const [artistPage, setArtistPage] = useState(0);
  const [done, setDone] = useState(false);
  const [artistsDone, setArtistsDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const seen = useRef(new Set<string>());
  const seenAlbums = useRef(new Set<string>());
  const seenArtists = useRef(new Set<string>());

  const onArtists = lane === "artists";
  const laneDone = onArtists ? artistsDone : done;

  useEffect(() => {
    if (done || !active || onArtists) return;
    let live = true;
    setBusy(true);
    setFailed(false);
    loadMusicGenreTracksPage(genre.id, page)
      .then((result) => {
        if (!live) return;
        const fresh = result.tracks.filter((track) => {
          const key = `${track.connectorId}:${track.id}`;
          if (seen.current.has(key)) return false;
          seen.current.add(key);
          return true;
        });
        const freshAlbums = (result.albums ?? []).filter((album) => {
          if (seenAlbums.current.has(album.id)) return false;
          seenAlbums.current.add(album.id);
          return true;
        });
        if (fresh.length > 0) setTracks((held) => [...held, ...fresh]);
        if (freshAlbums.length > 0) setAlbums((held) => [...held, ...freshAlbums]);
        if (result.done) setDone(true);
        else if (fresh.length === 0) setPage((value) => value + 1);
      })
      .catch(() => {
        if (live) setFailed(true);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [genre.id, page, active, done, onArtists, retry]);

  useEffect(() => {
    if (artistsDone || !active || !onArtists) return;
    let live = true;
    setBusy(true);
    setFailed(false);
    loadMusicGenreArtistsPage(genre.id, artistPage)
      .then((result) => {
        if (!live) return;
        const fresh = result.artists.filter((artist) => {
          if (seenArtists.current.has(artist.id)) return false;
          seenArtists.current.add(artist.id);
          return true;
        });
        if (fresh.length > 0) setArtists((held) => [...held, ...fresh]);
        if (result.done) setArtistsDone(true);
        else if (fresh.length === 0) setArtistPage((value) => value + 1);
      })
      .catch(() => {
        if (live) setFailed(true);
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [genre.id, artistPage, active, artistsDone, onArtists, retry]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || laneDone || busy || failed || !active) return;
    const observer = new IntersectionObserver(
      (rows) => {
        if (!rows.some((row) => row.isIntersecting)) return;
        if (onArtists) setArtistPage((value) => value + 1);
        else setPage((value) => value + 1);
      },
      { rootMargin: "800px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [laneDone, busy, failed, active, onArtists, tracks.length, artists.length]);

  const fansLabel = useMemo(
    () => new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }),
    [],
  );

  const albumEntries: MusicCollectionEntry[] = useMemo(
    () =>
      albums.map((album) => ({
        key: album.id,
        kind: "album",
        id: album.id,
        name: album.title,
        subtitle: album.artist ?? "",
        artwork: [firstArtwork(album.artwork)].filter(Boolean),
        count: 0,
        stamp: 0,
        pinned: false,
        round: false,
        item: album,
      })),
    [albums],
  );

  const artistEntries: MusicCollectionEntry[] = useMemo(
    () =>
      [...artists]
        .sort((a, b) => b.score - a.score || b.fans - a.fans || a.name.localeCompare(b.name))
        .map((artist) => ({
        key: artist.id,
        kind: "artist",
        id: artist.id,
        name: artist.name,
        subtitle: artist.fans > 0 ? t("music.explore.fans", { count: fansLabel.format(artist.fans) }) : "",
        artwork: [artist.artwork].filter(Boolean),
        count: 0,
        stamp: 0,
        pinned: false,
        round: true,
        item: { kind: "artist", id: artist.id, connectorId: "catalog", name: artist.name, artwork: artist.artwork },
      })),
    [artists, fansLabel, t],
  );

  if (laneDone && tracks.length === 0 && artists.length === 0) return null;

  return (
    <section className="flex flex-col gap-4">
      {lane !== "songs" && (
        <MusicSectionHead title={t("music.explore.deepTitle")} subtitle={t("music.explore.deepSubtitle")} />
      )}
      <div className="flex flex-wrap items-center justify-end gap-4">
        <div className="inline-flex shrink-0 items-center gap-1" role="group" aria-label={t("music.explore.deepTitle")}>
          {LANES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={lane === value}
              onClick={() => setLane(value)}
              className="inline-flex h-8 items-center rounded-full px-3.5 text-[12px] font-medium text-ink-muted transition-colors duration-200 ease-out hover:text-ink aria-pressed:bg-elevated aria-pressed:text-ink"
            >
              {t(`music.explore.lane.${value}`)}
            </button>
          ))}
        </div>
      </div>

      {lane === "songs" && (
        <MusicTrackGrid
          title={t("music.explore.deepTitle")}
          subtitle={t("music.explore.deepSubtitle")}
          tracks={tracks}
          count={tracks.length || 12}
          status={tracks.length === 0 && busy ? "loading" : "ready"}
          onPlay={(track) => onPlay(track, tracks)}
          onOpen={(track) => onOpen(trackItem(track), tracks.map(trackItem))}
        />
      )}
      {lane === "albums" && (
        <MusicCollectionGrid
          entries={albumEntries}
          emptyCopy={t("music.explore.deepEmpty")}
          onOpen={(entry) => entry.item && onOpen(entry.item, albums)}
        />
      )}
      {lane === "artists" && (
        <MusicCollectionGrid
          entries={artistEntries}
          emptyCopy={t("music.explore.deepEmpty")}
          onOpen={(entry) => entry.item && onOpen(entry.item, artistEntries.flatMap((row) => (row.item ? [row.item] : [])))}
        />
      )}
      {failed && <button type="button" className="self-start rounded-md bg-elevated px-4 py-2 text-sm" onClick={() => setRetry(value => value + 1)}>{t("common.retry")}</button>}
      {!laneDone && !failed && <div ref={sentinel} aria-hidden="true" className="h-12 w-full" />}
    </section>
  );
}
