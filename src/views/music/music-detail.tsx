import { MusicVideoDiscovery } from "@/components/music/music-video-discovery";
import { MusicArtistFilmography } from "@/components/music/music-artist-filmography";
import { MusicTrackCredits } from "@/components/music/music-listening-details";
import { MusicSoundtrackLink } from "@/components/music/music-soundtrack-link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ,
  ChevronLeft,
  Clock3,
  Disc3,
  ExternalLink,
  ListMusic,
  ListPlus,
  LoaderCircle,
  Music2,
  Plus,
  Search,
  UserRound,
  Video,
  X,
} from "lucide-react";
import { Dropdown } from "@/components/dropdown";
import { MusicQualityBadge } from "@/components/music/music-quality-badge";
import { MusicReleaseMetadata } from "@/components/music/music-release-metadata";
import { MusicArtistOverview, MusicWhereToBuy } from "@/components/music/music-artist-overview";
import { MusicArtistLink } from "@/components/music/music-artist-link";
import { useMusicTrackContextMenu } from "@/components/music/music-track-menu";
import {
  MusicArtistPlaylistNote,
  MusicTrackPlaylistChip,
} from "@/components/music/music-playlist-chip";
import { MusicCollectionControls } from "@/components/music/music-collection-controls";
import { musicSourceLink } from "@/lib/music/source-link";
import { MusicServiceLogo } from "@/components/music/music-service-logo";
import { openUrl } from "@/lib/window";
import { MusicTrackRow } from "@/components/music/music-track-row";
import { MusicCardsSkeleton, MusicTrackRowsSkeleton } from "@/components/music/music-skeletons";
import { MusicCatalogRow } from "@/components/music/music-catalog-row";
import { Poster } from "@/components/poster";
import { useMusicPlaylistPicker } from "@/components/music/music-playlist-picker";
import { enqueueMusic, toggleMusicLiked, useMusicPlayer } from "@/lib/music/player";
import { useRecordingProfile } from "@/lib/music/use-recording-profile";
import { useT, useUiLanguage } from "@/lib/i18n";
import { loadArtistProfile } from "@/lib/music/artist-profile";
import type {
  MusicCatalogItem,
  MusicCatalogRow as CatalogRow,
  MusicCatalogPage,
  MusicTrack,
} from "@/lib/music/types";
import "./music-detail.css";

export type MusicDetailViewState = { query: string; sort: string; section: string };
const DEFAULT_VIEW: MusicDetailViewState = { query: "", sort: "default", section: "all" };

export type MusicDetailState = {
  item: MusicCatalogItem;
  tracks: MusicTrack[];
  rows: CatalogRow[];
  loading: boolean;
  error: string;
  rowsLoading?: boolean;
  rowsError?: string;
  nextOffset?: number | null;
  loadingMore?: boolean;
  moreError?: string;
  trackCursor?: string | null;
  trackScope?: MusicCatalogPage["scope"];
  releaseCursor?: string | null;
  releasesLoadingMore?: boolean;
  releasesMoreError?: string;
  view?: MusicDetailViewState;
};

export function MusicDetail({
  detail,
  onBack,
  onPlay,
  onOpen,
  onRetry,
  onLoadMore,
  onLoadMoreReleases,
  onWatch,
  onVideo,
  onArtistSearch,
  onViewChange,
}: {
  detail: MusicDetailState;
  onBack: () => void;
  onPlay: (track: MusicTrack, queue: MusicTrack[]) => void;
  onOpen: (item: MusicCatalogItem, siblings: MusicCatalogItem[]) => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onLoadMoreReleases: () => void;
  onWatch: (track: MusicTrack) => void;
  onVideo: (track: MusicTrack, queue: MusicTrack[]) => void;
  onArtistSearch: (name: string, track?: MusicTrack) => void;
  onViewChange: (view: MusicDetailViewState) => void;
}) {
  const t = useT();
  const player = useMusicPlayer();
  const { profile: playingRecording } = useRecordingProfile(player.current);
  const isCurrent = (track: MusicTrack) =>
    [player.current, player.current?.collectionOrigin, playingRecording?.catalogTrack].some(
      (identity) => identity?.id === track.id && identity.connectorId === track.connectorId,
    );
  const { openPlaylistPicker } = useMusicPlaylistPicker();
  const heading = useRef<HTMLHeadingElement>(null);
  const view = detail.view ?? DEFAULT_VIEW;
  const { query, sort, section } = view;
  const setQuery = (query: string) => onViewChange({ ...view, query });
  const setSort = (sort: string) => onViewChange({ ...view, sort });
  const setSection = (section: string) => onViewChange({ ...view, section });
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [detail.item.id]);
  const language = useUiLanguage();
  const [artistImage, setArtistImage] = useState<string | null>(null);
  const { item, tracks, loading, error } = detail;
  const heroTrack = item.kind === "track" ? item : null;
  const heroMenu = useMusicTrackContextMenu(heroTrack, {
    onPlay: heroTrack ? () => onPlay(heroTrack, [heroTrack]) : undefined,
    onAddToQueue: heroTrack ? () => enqueueMusic(heroTrack) : undefined,
    onGoToArtist: heroTrack ? () => onArtistSearch(heroTrack.artist) : undefined,
  });
  const trackNumbers = useMemo(
    () => new Map(tracks.map((track, index) => [track, index + 1])),
    [tracks],
  );
  const title = item.kind === "album" || item.kind === "track" ? item.title : item.name;
  const source = musicSourceLink(item);
  const artwork = Array.isArray(item.artwork) ? item.artwork[0] : item.artwork;
  const heroArt = artwork || artistImage;
  useEffect(() => {
    setArtistImage(null);
    if (item.kind !== "artist" || artwork) return;
    const controller = new AbortController();
    void loadArtistProfile(item, language, controller.signal)
      .then((profile) => {
        if (profile?.artwork && !controller.signal.aborted) setArtistImage(profile.artwork);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [item.id, item.kind, artwork, language]);
  const filtered = tracks.filter((track) =>
    `${track.title} ${track.artist} ${track.album ?? ""}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  if (sort === "title") filtered.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "duration") filtered.sort((a, b) => a.durationSeconds - b.durationSeconds);
  const repeatsHeroTrack =
    item.kind === "track" &&
    tracks.length === 1 &&
    tracks[0].id === item.id &&
    tracks[0].connectorId === item.connectorId;
  const showTracks =
    !repeatsHeroTrack && (item.kind !== "artist" || section === "all" || section === "tracks");
  const shownTracks =
    item.kind === "artist" && section === "all" && !query ? filtered.slice(0, 8) : filtered;
  const shownRows = detail.rows.filter(
    (row) =>
      section === "all" ||
      (section === "albums" && row.items.some((entry) => entry.kind === "album")) ||
      (section === "artists" && row.items.some((entry) => entry.kind === "artist")),
  );
  const trackControls = (
    <>
      <div className="music-detail-filter">
        <Search size={16} aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label={t("music.filter.tracks")}
          placeholder={t("music.filter.tracks")}
        />
        {query && (
          <button
            type="button"
            onClick={(event) => {
              setQuery("");
              event.currentTarget.parentElement?.querySelector("input")?.focus();
            }}
            aria-label={t("music.search.clear")}
          >
            <X size={16} />
          </button>
        )}
      </div>
      <Dropdown
        value={sort}
        onChange={setSort}
        ariaLabel={t("music.sort.label")}
        className="music-detail-sort"
        menuClassName="music-detail-sort-menu"
        options={[
          {
            value: "default",
            label: t("music.sort.default"),
            left: <ListMusic size={16} aria-hidden />,
          },
          {
            value: "title",
            label: t("music.sort.title"),
            left: <ArrowDownAZ size={16} aria-hidden />,
          },
          {
            value: "duration",
            label: t("music.sort.duration"),
            left: <Clock3 size={16} aria-hidden />,
          },
        ]}
      />
    </>
  );
  return (
    <section className="music-detail-page flex min-w-0 flex-col gap-6">
      <button
        type="button"
        data-music-inner-back
        onClick={onBack}
        className="music-detail-back flex w-fit items-center gap-2 text-sm text-ink-muted hover:text-ink"
      >
        <ChevronLeft size={18} />
        {t("music.watch.back")}
      </button>
      <header className="music-detail-hero">
        {heroMenu.menu}
        <div
          onContextMenu={heroMenu.onContextMenu}
          className={`music-detail-art grid size-48 shrink-0 place-items-center overflow-hidden bg-elevated ${item.kind === "artist" ? "rounded-full" : "rounded-lg"}`}
        >
          {heroArt ? (
            <Poster
              src={heroArt}
              seed={item.id}
              ratio="square"
              className="w-full [--poster-radius:0px]"
            />
          ) : (
            <Music2 size={48} className="text-ink-subtle" />
          )}
        </div>
        <div className="music-detail-title min-w-0">
          <h1
            ref={heading}
            tabIndex={-1}
            className="text-3xl font-bold tracking-tight text-ink sm:text-5xl"
          >
            {title}
          </h1>
          {(item.kind === "album" || item.kind === "track") && (
            <p className="mt-3 text-ink-muted">
              <MusicArtistLink
                name={item.artist}
                track={item.kind === "track" ? item : undefined}
              />
              {item.kind === "album" && item.year ? ` / ${item.year}` : ""}
            </p>
          )}
          {item.kind !== "track" && !loading && !error && (
            <p className="mt-3 text-sm text-ink-muted">
              {item.kind === "artist"
                ? t(
                    detail.trackScope === "top"
                      ? "music.artist.popular"
                      : "music.artist.recordings",
                  )
                : t("music.trackCount", { count: tracks.length })}
            </p>
          )}
          {item.kind === "track" && (
            <div className="music-detail-facts text-sm text-ink-muted">
              {item.album && (
                <span>
                  <Disc3 size={15} aria-hidden />
                  {item.album}
                </span>
              )}
              {item.durationLabel && (
                <span>
                  <Clock3 size={15} aria-hidden />
                  <span dir="ltr">{item.durationLabel}</span>
                </span>
              )}
            </div>
          )}
          {item.kind === "artist" && (
            <div className="mt-3">
              <MusicArtistPlaylistNote artist={title} />
            </div>
          )}
          {item.kind === "track" && (
            <div className="mt-3">
              <MusicTrackPlaylistChip track={item} />
            </div>
          )}
          {source && (
            <button
              type="button"
              onClick={() => openUrl(source.url)}
              className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
            >
              <MusicServiceLogo source={item.connectorId ?? ""} itemId={item.id} size={20} />
              {source.name}
              <ExternalLink size={14} aria-hidden />
            </button>
          )}
          {item.kind === "track" && <MusicQualityBadge track={item} />}
        </div>
      </header>
      <div className="music-detail-actions">
        {tracks.length > 0 && (
          <MusicCollectionControls tracks={filtered} onPlay={onPlay} disabled={loading} />
        )}
        {item.kind === "track" && (
          <>
            <button
              type="button"
              onClick={() => enqueueMusic(item)}
              className="music-detail-secondary"
            >
              <ListPlus size={18} aria-hidden />
              {t("music.card.addToQueue")}
            </button>
            <button
              type="button"
              onClick={() => openPlaylistPicker(item)}
              className="music-detail-secondary"
            >
              <Plus size={18} aria-hidden />
              {t("music.card.addToPlaylist")}
            </button>
          </>
        )}
        {item.kind === "track" && (
          <button type="button" onClick={() => onWatch(item)} className="music-home-text">
            <Video size={18} />
            {t("music.ytm.title")}
          </button>
        )}
      </div>
      {item.kind === "track" && <MusicSoundtrackLink title={item.title} album={item.album} />}
      <MusicReleaseMetadata item={item} />
      {item.kind !== "artist" && <MusicWhereToBuy item={item} />}
      {item.kind === "artist" && (
        <div className="music-detail-sections">
          <div className="music-detail-chips">
            {[
              ["all", "music.filter.all", Music2],
              ["tracks", "music.search.tracks", Music2],
              ["albums", "music.search.albums", Disc3],
              ["artists", "music.detail.relatedArtists", UserRound],
              ["videos", "music.videos.title", Video],
              ["interviews", "music.videos.interviews", UserRound],
            ].map(([id, label, Icon]) => {
              const Glyph = Icon as typeof Music2;
              return (
                <button
                  key={String(id)}
                  type="button"
                  aria-pressed={section === id}
                  onClick={() => setSection(String(id))}
                  className={`inline-flex items-center gap-2 rounded-md px-4 py-2.5 text-sm ${section === id ? "bg-ink text-canvas" : "bg-elevated text-ink-muted hover:text-ink"}`}
                >
                  <Glyph size={16} />
                  {t(String(label))}
                </button>
              );
            })}
          </div>
          {showTracks && tracks.length > 1 && trackControls}
        </div>
      )}
      {showTracks && tracks.length > 1 && (
        <div className="music-detail-toolbar">
          <h2>
            {t(
              item.kind === "artist" && detail.trackScope === "top"
                ? "music.artist.popular"
                : "music.search.tracks",
            )}
            <span>{filtered.length}</span>
          </h2>
          {item.kind !== "artist" && trackControls}
        </div>
      )}
      {loading ? (
        <div className="py-2">
          <MusicTrackRowsSkeleton rows={6} />
        </div>
      ) : error ? (
        <div className="py-8 text-ink-muted">
          <p role="alert">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-md bg-elevated px-4 py-2 text-ink"
          >
            {t("music.offline.retry")}
          </button>
        </div>
      ) : !showTracks ? null : shownTracks.length ? (
        <div className="music-detail-track-list">
          {shownTracks.map((track, index) => (
            <MusicTrackRow
              key={`${track.id}:${index}`}
              track={track}
              nowPlaying={isCurrent(track)}
              loading={isCurrent(track) && player.phase === "resolving"}
              paused={isCurrent(track) && player.phase === "paused"}
              index={item.kind === "track" ? undefined : trackNumbers.get(track)}
              showDuration
              onPlay={() => onPlay(track, filtered)}
              onAddToQueue={() => enqueueMusic(track)}
              onAddToPlaylist={() => openPlaylistPicker(track)}
              onGoToArtist={() => onArtistSearch(track.artist, track)}
              liked={player.likedIds.includes(track.id)}
              onToggleFavorite={() => toggleMusicLiked(track)}
            />
          ))}
        </div>
      ) : (
        <p className="py-8 text-ink-muted">{t("music.row.emptyRow")}</p>
      )}
      {showTracks && shownTracks.length < filtered.length && (
        <button
          type="button"
          className="w-fit text-sm text-ink-muted hover:text-ink"
          onClick={() => setSection("tracks")}
        >
          {t("music.row.viewAll")}
        </button>
      )}
      {detail.moreError && (
        <p role="alert" className="text-sm text-ink-muted">
          {detail.moreError}
        </p>
      )}
      {showTracks &&
        shownTracks.length >= filtered.length &&
        (detail.nextOffset != null || detail.trackCursor) && (
          <button
            type="button"
            disabled={detail.loadingMore}
            onClick={onLoadMore}
            className="inline-flex w-fit items-center gap-2 rounded-md bg-elevated px-5 py-3 text-sm text-ink disabled:opacity-50"
          >
            {detail.loadingMore && (
              <LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" />
            )}
            {t(detail.moreError ? "common.retry" : "music.library.loadMore")}
          </button>
        )}
      {showTracks && detail.trackScope === "limited" && (
        <p className="text-sm text-ink-muted">{t("music.artist.limited")}</p>
      )}
      {detail.rowsLoading && (
        <div className="py-2">
          <MusicCardsSkeleton />
        </div>
      )}
      {detail.rowsError && (
        <div className="border-t border-edge-soft py-6 text-ink-muted">
          <p role="alert">{detail.rowsError}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 rounded-md bg-elevated px-4 py-2 text-ink"
          >
            {t("common.retry")}
          </button>
        </div>
      )}
      {shownRows.map((row) => (
        <MusicCatalogRow
          key={row.id}
          row={row}
          min={160}
          onOpen={(item) => onOpen(item, row.items)}
        />
      ))}
      {(section === "all" || section === "albums") && (
        <>
          {detail.releasesMoreError && (
            <p role="alert" className="text-sm text-ink-muted">
              {detail.releasesMoreError}
            </p>
          )}
          {detail.releaseCursor && (
            <button
              type="button"
              disabled={detail.releasesLoadingMore}
              onClick={onLoadMoreReleases}
              className="inline-flex w-fit items-center gap-2 rounded-md bg-elevated px-5 py-3 text-sm text-ink disabled:opacity-50"
            >
              {detail.releasesLoadingMore && (
                <LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" />
              )}
              {t(detail.releasesMoreError ? "common.retry" : "music.library.loadMore")}
            </button>
          )}
        </>
      )}
      {item.kind === "artist" && (
        <>
          {(section === "all" || section === "videos") && (
            <MusicVideoDiscovery
              key={`${item.id}:videos`}
              kinds={["videos", "concerts"]}
              subject={item.name}
              onWatch={onVideo}
            />
          )}{" "}
          {(section === "all" || section === "interviews") && (
            <MusicVideoDiscovery
              key={`${item.id}:interviews`}
              query={`${item.name} interview`}
              interviews
              onWatch={onVideo}
            />
          )}
        </>
      )}
      {item.kind === "artist" && <MusicArtistFilmography name={item.name} />}
      {item.kind === "artist" && (
        <MusicArtistOverview
          artist={item}
          onOpen={(artist) => onOpen({ ...artist, kind: "artist" }, [])}
        />
      )}
      {item.kind === "track" && (
        <MusicTrackCredits
          track={item}
          onArtist={(artist) => onOpen({ ...artist, kind: "artist" }, [])}
        />
      )}
    </section>
  );
}
