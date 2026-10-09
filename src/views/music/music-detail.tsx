import { MusicActionGlyph, useMusicActionReceipt } from "@/components/music/music-action-feedback";
import { MusicPlaylistToolbar } from "@/components/music/music-playlist-toolbar";
import { usePlaylistFilters } from "@/lib/music/use-playlist-filters";
import { LibraryTrackList } from "@/components/music/music-library-parts";
import { recordMusicDestination } from "@/lib/music/recent-destinations";
import { MusicVideoDiscovery } from "@/components/music/music-video-discovery";
import { MusicArtistFilmography } from "@/components/music/music-artist-filmography";
import { MusicTrackCredits } from "@/components/music/music-listening-details";
import { MusicSoundtrackLink } from "@/components/music/music-soundtrack-link";
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowDownAZ,
  ChevronLeft,
  Clock3,
  Disc3,
  Heart,
  ListMusic,
  ListPlus,
  LoaderCircle,
  Music2,
  Plus,
  Search,
  UserRound,
  Video,
  X,
} from "@/components/icons/music-icons";
import { Dropdown } from "@/components/dropdown";
import { HoverTooltip } from "@/components/hover-tooltip";
import { MusicQualityBadge } from "@/components/music/music-quality-badge";
import { MusicReleaseMetadata } from "@/components/music/music-release-metadata";
import { MusicArtistOverview, MusicWhereToBuy } from "@/components/music/music-artist-overview";
import { MusicArtistLink } from "@/components/music/music-artist-link";
import { useMusicNavigate } from "@/components/music/music-navigate";
import { MusicBillboardRank } from "@/components/music/music-billboard-rank";
import { useMusicTrackContextMenu } from "@/components/music/music-track-menu";
import {
  MusicArtistPlaylistNote,
  MusicTrackPlaylistChip,
} from "@/components/music/music-playlist-chip";
import { MusicCollectionControls } from "@/components/music/music-collection-controls";
import { useMusicArtworkColor } from "@/lib/music/appearance";
import { MusicArtistMenu } from "@/components/music/music-artist-menu";
import { useBlockedArtistFilter } from "@/lib/music/artist-blocks";
import { requestMusicExplore } from "@/lib/music/navigation";
import { tracksOf } from "./music-band-types";
import { MusicStickyTitle } from "@/components/music/music-sticky-title";
import { toggleLikedArtist, useLikedArtist } from "@/lib/music/liked-artists";
import { musicSourceLink } from "@/lib/music/source-link";
import { MusicTrackRow } from "@/components/music/music-track-row";
import { MusicCardsSkeleton, MusicTrackRowsSkeleton } from "@/components/music/music-skeletons";
import { MusicCatalogRow } from "@/components/music/music-catalog-row";
import { Poster } from "@/components/poster";
import { useMusicPlaylistPicker } from "@/components/music/music-playlist-picker";
import { enqueueMusic } from "@/lib/music/player";
import { useMusicPlayback } from "@/lib/music/use-music-playback";
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
  onPlay: playTrack,
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
  const player = useMusicPlayback();
  const { profile: playingRecording } = useRecordingProfile(player.current);
  const isCurrent = (track: MusicTrack) =>
    [player.current, player.current?.collectionOrigin, playingRecording?.catalogTrack].some(
      (identity) => identity?.id === track.id && identity.connectorId === track.connectorId,
    );
  const { openPlaylistPicker } = useMusicPlaylistPicker();
  const { goToAlbum } = useMusicNavigate();
  const heading = useRef<HTMLHeadingElement>(null);
  const hero = useRef<HTMLElement>(null);
  const view = detail.view ?? DEFAULT_VIEW;
  const { query, sort, section } = view;
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const searchId = useId();
  const searchExpanded = searchOpen || Boolean(query);
  const setQuery = (query: string) => onViewChange({ ...view, query });
  const setSort = (sort: string) => onViewChange({ ...view, sort });
  const setSection = (section: string) => onViewChange({ ...view, section });
  const closeSearch = () => {
    setQuery("");
    setSearchOpen(false);
    searchTrigger.current?.focus({ preventScroll: true });
  };
  useEffect(() => { setSearchOpen(false); }, [detail.item.id, detail.item.connectorId]);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, [detail.item.id]);
  const language = useUiLanguage();
  const [artistImage, setArtistImage] = useState<string | null>(null);
  const [showAllTracks, setShowAllTracks] = useState(false);
  useEffect(() => {
    setShowAllTracks(false);
  }, [detail.item.id, detail.item.connectorId]);
  const { item, tracks, loading, error } = detail;
  const queued = useMusicActionReceipt(item.id);
  const artistSaved = useLikedArtist(item.kind === "artist" ? item : null);
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
  // Only a page the listener actually played from earns a place in Jump back in; merely opening
  // it is browsing, not listening.
  const onPlay = (track: MusicTrack, queue: MusicTrack[]) => {
    if (item.kind === "artist" || item.kind === "album" || item.kind === "track") {
      recordMusicDestination({
        item,
        kind: item.kind,
        id: item.id,
        connectorId: item.connectorId ?? undefined,
        name: item.kind === "artist" ? item.name : item.title,
        artist: item.kind === "artist" ? undefined : item.artist,
        artwork: (Array.isArray(item.artwork) ? item.artwork[0] : item.artwork) ?? "",
      });
    }
    playTrack(track, queue);
  };
  const heroArt = artwork || artistImage;
  const heroTint = useMusicArtworkColor(heroArt ?? undefined, true);
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
  const visible = useBlockedArtistFilter(tracks, "show");
  const collection = usePlaylistFilters(item.id, item.kind === "playlist" ? visible : undefined);
  const matched = visible.filter((track) =>
    `${track.title} ${track.artist} ${track.album ?? ""}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  if (sort === "title") matched.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "duration") matched.sort((a, b) => a.durationSeconds - b.durationSeconds);
  const filtered = item.kind === "playlist" ? collection.tracks : matched;
  const repeatsHeroTrack =
    item.kind === "track" &&
    tracks.length === 1 &&
    tracks[0].id === item.id &&
    tracks[0].connectorId === item.connectorId;
  const showTracks =
    !repeatsHeroTrack && (item.kind !== "artist" || section === "all" || section === "tracks");
  const shownTracks =
    item.kind === "artist" && section === "all" && !query && !showAllTracks
      ? filtered.slice(0, 8)
      : filtered;
  const shownRows = detail.rows.filter(
    (row) =>
      section === "all" ||
      (section === "albums" && row.items.some((entry) => entry.kind === "album")) ||
      (section === "artists" && row.items.some((entry) => entry.kind === "artist")) ||
      (section === "tracks" && row.items.some((entry) => entry.kind === "track")),
  );
  const trackControls = (
    <div className="music-detail-track-controls">
      <div className="music-detail-filter" data-expanded={searchExpanded || undefined}
        onBlur={(event) => {
          if (!query && !event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false);
        }}>
        <button ref={searchTrigger} type="button" className="music-detail-search-trigger"
          aria-label={t("music.filter.tracks")} aria-expanded={searchExpanded} aria-controls={searchId}
          onClick={() => {
            setSearchOpen(true);
            requestAnimationFrame(() => searchInput.current?.focus({ preventScroll: true }));
          }}>
          <Search size={19} aria-hidden />
        </button>
        <div className="music-detail-search-field" inert={!searchExpanded}>
          <input
            ref={searchInput}
            id={searchId}
            type="search"
            value={query}
            maxLength={200}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                closeSearch();
              }
            }}
            aria-label={t("music.filter.tracks")}
            placeholder={t("music.filter.tracks")}
          />
          <button
            type="button"
            onClick={() => {
              if (query) {
                setQuery("");
                searchInput.current?.focus({ preventScroll: true });
              } else closeSearch();
            }}
            aria-label={t(query ? "music.search.clear" : "common.close")}
          >
            <X size={16} />
          </button>
        </div>
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
    </div>
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
      <MusicStickyTitle title={title} tracks={filtered} onPlay={onPlay} revealAfter={hero} />
      <header
        ref={hero}
        className="music-detail-hero"
        style={
          heroTint
            ? ({
                "--music-hero-tint": heroTint.color,
                "--music-hero-ink": heroTint.ink,
              } as CSSProperties)
            : undefined
        }
      >
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
          {item.kind !== "artist" && (
            <p className="music-detail-meta">
              {(item.kind === "album" || item.kind === "track") && item.explicit === true && (
                <span
                  className="music-detail-explicit"
                  title={t("music.label.explicit")}
                  aria-label={t("music.label.explicit")}
                >
                  E
                </span>
              )}
              {(item.kind === "album" || item.kind === "track") && (
                <span>
                  <MusicArtistLink
                    name={item.artist}
                    track={item.kind === "track" ? item : undefined}
                  />
                </span>
              )}
              {item.kind === "album" && item.year ? <span>{item.year}</span> : null}
              {item.kind !== "track" && !loading && !error ? (
                <span>{t("music.trackCount", { count: tracks.length })}</span>
              ) : null}
            </p>
          )}
          {item.kind === "track" && (
            <div className="music-detail-facts text-sm text-ink-muted">
              {item.album && (
                <span>
                  <Disc3 size={15} aria-hidden />
                  <button
                    type="button"
                    onClick={() => goToAlbum(item.album ?? "", item.artist)}
                    className="text-start underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    {item.album}
                  </button>
                </span>
              )}
              {item.durationLabel && (
                <span>
                  <Clock3 size={15} aria-hidden />
                  <span dir="ltr">{item.durationLabel}</span>
                </span>
              )}
              <MusicQualityBadge track={item} />
              <MusicBillboardRank title={item.title} artist={item.artist} />
            </div>
          )}
          {item.kind === "artist" && (
            <div className="mt-3">
              <MusicArtistPlaylistNote artist={title} artwork={heroArt} />
            </div>
          )}
          {item.kind === "track" && (
            <div className="mt-3">
              <MusicTrackPlaylistChip track={item} />
            </div>
          )}
          {(tracks.length > 0 || loading || item.kind === "artist") && (
            <div className="music-detail-hero-actions">
              <MusicCollectionControls
                tracks={filtered}
                onPlay={onPlay}
                disabled={loading}
                loading={loading}
                extra={
                  <>
                    {item.kind === "track" && (
                      <>
                        <HoverTooltip label={t("music.card.addToQueue")} side="top" align="center">
                          <button type="button" className="music-collection-extra"
                            aria-label={t("music.card.addToQueue")} onClick={() => { enqueueMusic(item); queued.confirm(); }}>
                            <MusicActionGlyph state={queued.confirmed ? "done" : "idle"} idle={<ListPlus size={26} />} size={26} identity={item.id} />
                          </button>
                        </HoverTooltip>
                        <HoverTooltip label={t("music.card.addToPlaylist")} side="top" align="center">
                          <button type="button" className="music-collection-extra"
                            aria-label={t("music.card.addToPlaylist")} onClick={() => openPlaylistPicker(item)}>
                            <Plus size={26} aria-hidden />
                          </button>
                        </HoverTooltip>
                        <HoverTooltip label={t("music.ytm.title")} side="top" align="center">
                          <button type="button" className="music-collection-extra"
                            aria-label={t("music.ytm.title")} onClick={() => onWatch(item)}>
                            <Video size={26} aria-hidden />
                          </button>
                        </HoverTooltip>
                      </>
                    )}
                    {item.kind === "artist" && (
                      <button
                        type="button"
                        className="music-collection-extra"
                        aria-pressed={artistSaved}
                        aria-label={t(artistSaved ? "music.artist.unsave" : "music.artist.save")}
                        title={t(artistSaved ? "music.artist.unsave" : "music.artist.save")}
                        onClick={() => toggleLikedArtist(item)}
                      >
                        <Heart size={24} fill={artistSaved ? "currentColor" : "none"} aria-hidden />
                      </button>
                    )}
                    {item.kind === "artist" && (
                      <MusicArtistMenu
                        artist={item}
                        seed={filtered[0]}
                        onRadio={(track) => requestMusicExplore({ kind: "similar", track })}
                      />
                    )}
                  </>
                }
              />
            </div>
          )}
        </div>
        {item.kind === "artist" && <MusicReleaseMetadata item={item} />}
      </header>
      {item.kind === "track" && <MusicSoundtrackLink title={item.title} album={item.album} />}
      {item.kind !== "artist" && <MusicReleaseMetadata item={item} />}
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
      {item.kind === "playlist" && <MusicPlaylistToolbar controller={collection} loading={loading} />}
      {item.kind !== "playlist" && showTracks && tracks.length > 1 && (
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
      ) : item.kind === "playlist" ? (
        <LibraryTrackList title="" subtitle="" showControls={false} tracks={filtered} view={collection.filters.view}
          likedIds={player.likedIds} selectedPlaylist={null} onPlay={onPlay}
          emptyCopy={t(collection.active ? "music.searchEmpty" : "music.row.emptyRow")} />
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
            onClick={() => {
              setShowAllTracks(true);
              onLoadMore();
            }}
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
          row={
            row.id === "artist:playlists" && item.kind === "artist"
              ? {
                  ...row,
                  title: t("music.artist.inPlaylists", { name: item.name }),
                  titleLiteral: true,
                }
              : row
          }
          min={160}
          onOpen={(item) => onOpen(item, row.items)}
          onEndReached={
            row.id === "artist:releases" && detail.releaseCursor && !detail.releasesLoadingMore
              ? onLoadMoreReleases
              : undefined
          }
          onViewAll={
            row.id === "artist:rarities"
              ? () => {
                  const queue = tracksOf(row.items);
                  if (!queue.length) return;
                  requestMusicExplore({
                    kind: "similar",
                    track: queue[0],
                    queue,
                    label: t("music.artist.rarities"),
                  });
                }
              : undefined
          }
        />
      ))}
      {(section === "all" || section === "albums") && detail.releasesMoreError && (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-ink-muted">
            {detail.releasesMoreError}
          </p>
          <button
            type="button"
            disabled={detail.releasesLoadingMore}
            onClick={onLoadMoreReleases}
            className="inline-flex w-fit items-center gap-2 rounded-md bg-elevated px-5 py-3 text-sm text-ink disabled:opacity-50"
          >
            {detail.releasesLoadingMore && (
              <LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" />
            )}
            {t("common.retry")}
          </button>
        </div>
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
              subject={item.name}
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
          extraLinks={source ? [{ url: source.url, name: source.name, kind: "source" }] : []}
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
