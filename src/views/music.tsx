import { HoverTooltip } from "@/components/hover-tooltip";
import { PRODUCT_NAME } from "@/lib/i18n/brand";
import { MusicQuickListenIcon } from "@/components/music/music-quick-listen-icon";
import { MusicSurpriseButton } from "@/components/music/music-surprise-button";
import "@/components/music/music-quick-listen.css";
import "./music/music-page-system.css";
import { reopenMusicMix } from "@/lib/music/recent-context";
import { MusicBillboardPage } from "@/components/music/music-billboard-page";
import { MusicGenres, type MusicGenreEntry } from "./music/music-genres";
import { MusicExploreBands } from "./music/music-explore-bands";
import { MusicBillboardCharts } from "@/components/music/music-discovery-charts";
import { MusicAudioSettings } from "@/components/music/music-audio-settings";
import { MusicSpeakers } from "@/components/music/music-speakers";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, LoaderCircle, Music2, X } from "@/components/icons/music-icons";
import { BackToTop } from "@/components/back-to-top";
import { MusicGlyph } from "@/components/icons/music-glyph";
import { CatalogCustomizeBar } from "@/components/catalog/customize-bar";
import { errorText } from "@/components/music/music-connections/connection-row";
import {
  MusicConnectionsProvider,
  MusicConnections,
  useMusicConnections,
} from "@/components/music/music-connections";
import { MusicHomeHero } from "./music/music-home-hero";
import {
  MusicTastes,
  readMusicTastes,
  useMusicTasteRows,
} from "./music/music-tastes";
import { MusicCatalogRow } from "@/components/music/music-catalog-row";
import { MusicSectionError } from "@/components/music/music-track-grid";
import { MusicNavigateProvider } from "@/components/music/music-navigate";
import { MusicYouTube } from "@/components/music/music-youtube";
import { MusicPlaylistPickerProvider } from "@/components/music/music-playlist-picker";
import { MusicWatch } from "@/components/music/music-watch";
import { MusicVideoDiscovery } from "@/components/music/music-video-discovery";
import { MusicSimilarPage } from "./music/music-similar-page";
import { MusicRollingStoneRow } from "@/components/music/music-rolling-stone-row";
import { MusicRollingStonePage } from "@/components/music/music-rolling-stone-page";
import { RS_500_TITLE, RS_SOURCE } from "@/lib/rolling-stone-500";
import {
  MUSIC_EXPLORE_EVENT,
  MUSIC_GENRE_EVENT,
  MUSIC_LABEL_EVENT,
  MUSIC_PANEL_EVENT,
  MUSIC_LIBRARY_EVENT,
  MUSIC_PLAY_EVENT,
  MUSIC_PLAYLIST_EVENT,
  MUSIC_SEARCH_EVENT,
  takeMusicExploreRequest,
  takeMusicGenreRequest,
  takeMusicLabelRequest,
  takeMusicPanelRequest,
  takeMusicLibraryRequest,
  takeMusicPlayRequest,
  takeMusicPlaylistRequest,
  takeMusicSearchRequest,
} from "@/lib/music/navigation";
import { artistNameKey } from "@/lib/music/artist-profile";
import { displayClusters, identityForRef, resolveArtist } from "@/lib/music/artist-authority";
import { MusicLibrary } from "@/components/music/music-library";
import { MusicMast } from "@/components/music/music-mast";
import {
  MusicSourcePickerProvider,
  useMusicSourcePicker,
} from "@/components/music/music-source-picker";
import {
  MusicTabs,
  musicTabButtonId,
  musicTabPanelId,
  type MusicTabId,
} from "@/components/music/music-tabs";
import { ScrollRootContext } from "@/components/row";
import { useT } from "@/lib/i18n";
import { artistCatalog, localCollection, searchTyped } from "@/lib/music/catalog";
import { loadMusicGenre } from "@/lib/music/genre-page";
import { loadMusicLabel } from "@/lib/music/label-page";
import {
  queryLadder,
  runQueryLadder,
  type MusicQueryIntent,
  type QueryRung,
} from "@/lib/music/search-fallback";
import {
  musicSimilarTracks,
  playMusicOnSpeaker,
  returnMusicToComputer,
  stopMusicCasting,
} from "@/lib/music/player";
import { useMusicPlayback } from "@/lib/music/use-music-playback";
import type { MusicCatalogItem, MusicSearchResults, MusicTrack } from "@/lib/music/types";
import { hasPageRowChanges, resetPageRows, usePageRows } from "@/lib/page-rows";
import { useScrollMemory } from "@/lib/view";
import { resetMusicScroll, useMusicScrollContinuity } from "@/lib/music/scroll-continuity";
import { useSectionBack } from "@/lib/section-back";
import { MusicBandStack } from "./music/music-band-stack";
import { MusicPlaylistPage } from "./music/music-playlist-page";
import { MusicTrackCollectionPage } from "./music/music-track-collection-page";
import type { MusicCollectionEntry } from "@/lib/music/library-collections";
import { gateBand, scrobbleShelf } from "./music/music-band-gates";
import { tracksOf, type MusicBand, type MusicBandContext } from "./music/music-band-types";
import { catalogBands } from "./music/music-catalog-bands";
import { splitHomeRows } from "./music/music-home-rows";
import { madeForYouBand } from "./music/music-made-for-you-band";
import { jumpBackInBand } from "./music/music-jump-back-in";
import { newReleaseCtaBand } from "./music/music-new-release-ctas";
import { personalBands } from "./music/music-personal-bands";
import { spotifyBands } from "./music/music-spotify-band";
import { MusicTopPlaylists } from "./music/music-top-playlists";
import { MusicSearchPanel } from "./music/music-search-panel";
import { rememberMusicSearchItem } from "@/lib/music/search-history";
import { useMusicData } from "./music/use-music-data";

import { MusicDetail, type MusicDetailState } from "./music/music-detail";
import { registerMusicCatalogOrigin } from "@/lib/music/playback-origin";
import { loadDetailRows, loadDetailTracks } from "./music/music-detail-data";

type SearchState = {
  query: string;
  connector: string | null;
  results: MusicSearchResults | null;
  error: string;
  mode?: "search" | "genre" | "label";
  labelId?: string;
  /** Retries the work that produced this state, so a climbed search does not retry as a flat one. */
  retry?: () => void;
};

type Notice = { kind: "busy" | "info" | "error"; text: string };

const MusicQuickListen = lazy(() => import("@/components/music/music-quick-listen").then(module => ({ default: module.MusicQuickListen })));

export function MusicView({ active }: { active: boolean; shellBackAvailable?: boolean }) {
  return (
    <MusicConnectionsProvider active={active}>
      <MusicSourcePickerProvider active={active}>
        <MusicPlaylistPickerProvider active={active}>
          <MusicViewContent active={active} />
        </MusicPlaylistPickerProvider>
      </MusicSourcePickerProvider>
    </MusicConnectionsProvider>
  );
}

function MusicViewContent({ active }: { active: boolean }) {
  const t = useT();
  const player = useMusicPlayback();
  const { openSourcePicker } = useMusicSourcePicker();
  const {
    openConnections,
    connections,
    status: connectionsStatus,
    error: connectionsError,
    reload: reloadConnections,
    request: connectionsPage,
    closeConnections,
  } = useMusicConnections();
  useEffect(() => {
    const receive = () => {
      const panel = takeMusicPanelRequest();
      if (panel) openConnections(panel);
    };
    window.addEventListener(MUSIC_PANEL_EVENT, receive);
    receive();
    return () => window.removeEventListener(MUSIC_PANEL_EVENT, receive);
  }, [openConnections]);
  const pageRows = usePageRows("music");
  const data = useMusicData(player.recents);
  const [tastes, setTastes] = useState(readMusicTastes);
  const tasteRows = useMusicTasteRows(tastes);

  const scrollRef = useRef<HTMLElement>(null);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);
  const scrollCb = useCallback((el: HTMLElement | null) => {
    (scrollRef as { current: HTMLElement | null }).current = el;
    setScrollEl(el);
  }, []);
  useScrollMemory("music", scrollRef, active);

  const [genre, setGenre] = useState<MusicGenreEntry | null>(null);
  const [discoveryPage, setDiscoveryPage] = useState<
    "tastes" | "playlists" | "videos" | "billboard" | "rollingStone" | null
  >(null);
  const [billboardChart, setBillboardChart] = useState("hot-100");
  const [videoQuery, setVideoQuery] = useState("music videos");
  const discoveryOrigin = useRef<{ text: string | null } | null>(null);
  const openDiscovery = (
    page: "tastes" | "playlists" | "videos" | "billboard" | "rollingStone",
  ) => {
    discoveryOrigin.current = { text: document.activeElement?.textContent ?? null };
    setDiscoveryPage(page);
  };
  const openBillboard = (chartId = "hot-100") => {
    setBillboardChart(chartId);
    openDiscovery("billboard");
  };
  const closeDiscovery = useCallback(() => {
    setDiscoveryPage(null);
    const origin = discoveryOrigin.current;
    requestAnimationFrame(() => {
      [...(scrollRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])]
        .find((button) => button.textContent === origin?.text)
        ?.focus({ preventScroll: true });
    });
  }, []);
  const connectionOrigin = useRef<{ label: string | null; text: string | null } | null>(null);
  useEffect(() => {
    if (connectionsPage) {
      connectionOrigin.current ??= {
        label: connectionsPage.originLabel ?? null,
        text: connectionsPage.originText ?? null,
      };
    } else if (connectionOrigin.current) {
      const origin = connectionOrigin.current;
      connectionOrigin.current = null;
      requestAnimationFrame(() => {
        const buttons = [
          ...(scrollRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []),
          ...document.querySelectorAll<HTMLButtonElement>("[data-music-dock] button"),
        ];
        const trigger = buttons.find(
          (button) =>
            !button.disabled &&
            button.getClientRects().length > 0 &&
            (origin.label
              ? button.getAttribute("aria-label") === origin.label
              : origin.text && button.textContent === origin.text),
        );
        (trigger ?? scrollRef.current?.querySelector<HTMLHeadingElement>("h1"))?.focus({
          preventScroll: true,
        });
      });
    }
  }, [connectionsPage]);
  const [quickListen, setQuickListen] = useState<MusicTrack[] | null>(null);
  useEffect(() => { if (!active) setQuickListen(null); }, [active]);
  const [tab, setTab] = useState<MusicTabId>("forYou");
  const [search, setSearch] = useState<SearchState | null>(null);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [watch, setWatch] = useState<{ track: MusicTrack; queue: MusicTrack[] } | null>(null);
  const [similar, setSimilar] = useState<{
    seed: MusicTrack;
    tracks: MusicTrack[];
    state: "loading" | "ready" | "error";
    label?: string;
    contextId?: string;
  } | null>(null);
  const similarRun = useRef(0);
  const watchFromVideos = useRef(false);
  const openVideo = (track: MusicTrack, queue: MusicTrack[]) => {
    watchFromVideos.current = discoveryPage === "videos";
    if (watchFromVideos.current) setDiscoveryPage(null);
    setWatch({ track, queue });
  };
  const closeSimilar = useCallback(() => {
    similarRun.current += 1;
    setSimilar(null);
  }, []);
  const [collectionPage, setCollectionPage] = useState<{
    kind: "playlist" | "liked" | "recent";
    id: string;
  } | null>(null);
  const closeCollectionPage = useCallback(() => setCollectionPage(null), []);
  const openCollection = useCallback((entry: MusicCollectionEntry) => {
    if (entry.kind === "playlist" || entry.kind === "liked" || entry.kind === "recent")
      setCollectionPage({ kind: entry.kind, id: entry.id });
  }, []);
  const closeWatch = () => {
    setWatch(null);
    if (watchFromVideos.current) {
      watchFromVideos.current = false;
      setDiscoveryPage("videos");
    }
  };
  const [detail, setDetail] = useState<MusicDetailState | null>(null);
  const detailRef = useRef(detail);
  detailRef.current = detail;
  const resolveGeneration = useRef(0);
  const [openingDetail, setOpeningDetail] = useState<number | null>(null);
  const loadPendingDetail = useCallback((snapshot: MusicDetailState, generation: number) => {
    if (snapshot.loading)
      void loadDetailTracks(snapshot.item)
        .then((result) => {
          if (generation === resolveGeneration.current)
            setDetail((current) =>
              current ? { ...current, ...result, loading: false, error: "" } : current,
            );
        })
        .catch((cause) => {
          if (generation === resolveGeneration.current)
            setDetail((current) =>
              current ? { ...current, loading: false, error: errorText(cause) } : current,
            );
        });
    if (snapshot.rowsLoading)
      void loadDetailRows(snapshot.item)
        .then((result) => {
          if (generation === resolveGeneration.current)
            setDetail((current) =>
              current ? { ...current, ...result, rowsLoading: false } : current,
            );
        })
        .catch((cause) => {
          if (generation === resolveGeneration.current)
            setDetail((current) =>
              current ? { ...current, rowsLoading: false, rowsError: errorText(cause) } : current,
            );
        });
  }, []);
  const searchOrigin = useRef<MusicDetailState | null>(null);
  const detailTrail = useRef<
    Array<{ detail: MusicDetailState | null; label: string | null; text: string | null }>
  >([]);
  const closeDetail = useCallback(() => {
    resolveGeneration.current += 1;
    setNotice(null);
    const previous = detailTrail.current.pop();
    const restored = previous?.detail;
    setDetail(restored ? { ...restored, loadingMore: false, releasesLoadingMore: false } : null);
    if (restored) loadPendingDetail(restored, resolveGeneration.current);
    requestAnimationFrame(() => {
      const buttons = [...(scrollRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
      const trigger = buttons.find((button) =>
        previous?.label
          ? button.getAttribute("aria-label") === previous.label
          : previous?.text && button.textContent === previous.text,
      );
      trigger?.focus({ preventScroll: true });
    });
  }, [loadPendingDetail]);
  const [ytm, setYtm] = useState(false);
  const closeYtm = useCallback(() => setYtm(false), []);
  const searchGeneration = useRef(0);

  useEffect(() => {
    if (active) document.title = `${t("music.title")} | ${PRODUCT_NAME}`;
  }, [active, t]);

  const runSearch = useCallback((query: string, connector: string | null) => {
    const generation = ++searchGeneration.current;
    if (detailRef.current) searchOrigin.current = detailRef.current;
    setDetail(null);
    setSimilar(null);
    if (!searchOrigin.current) detailTrail.current = [];
    resolveGeneration.current += 1;
    setNotice(null);
    setSearch({ query, connector, results: null, error: "" });
    setSearching(true);
    searchTyped(query, 36, connector ?? undefined)
      .then((results) => {
        if (searchGeneration.current !== generation) return;
        setSearch({ query, connector, results, error: "" });
      })
      .catch((cause) => {
        if (searchGeneration.current !== generation) return;
        setSearch({ query, connector, results: null, error: errorText(cause) });
      })
      .finally(() => {
        if (searchGeneration.current === generation) setSearching(false);
      });
  }, []);

  const openLabel = useCallback((id: string, name: string) => {
    const generation = ++searchGeneration.current;
    if (detailRef.current) searchOrigin.current = detailRef.current;
    setDetail(null);
    if (!searchOrigin.current) detailTrail.current = [];
    resolveGeneration.current += 1;
    setSimilar(null);
    setSearch({ labelId: id, query: name, connector: null, results: null, error: "", mode: "label" });
    setSearching(true);
    loadMusicLabel(id)
      .then((results) => {
        if (searchGeneration.current !== generation) return;
        setSearch({ labelId: id, query: name, connector: null, results, error: "", mode: "label" });
      })
      .catch((cause) => {
        if (searchGeneration.current !== generation) return;
        setSearch({
          query: name,
          connector: null,
          results: null,
          error: errorText(cause),
          mode: "label",
        });
      })
      .finally(() => {
        if (searchGeneration.current === generation) setSearching(false);
      });
  }, []);

  const openGenre = useCallback((name: string) => {
    const generation = ++searchGeneration.current;
    if (detailRef.current) searchOrigin.current = detailRef.current;
    setDetail(null);
    if (!searchOrigin.current) detailTrail.current = [];
    resolveGeneration.current += 1;
    setSimilar(null);
    setSearch({ query: name, connector: null, results: null, error: "", mode: "genre" });
    setSearching(true);
    loadMusicGenre(name)
      .then((results) => {
        if (searchGeneration.current !== generation) return;
        setSearch({ query: name, connector: null, results, error: "", mode: "genre" });
      })
      .catch((cause) => {
        if (searchGeneration.current !== generation) return;
        setSearch({
          query: name,
          connector: null,
          results: null,
          error: errorText(cause),
          mode: "genre",
        });
      })
      .finally(() => {
        if (searchGeneration.current === generation) setSearching(false);
      });
  }, []);

  const clearSearch = useCallback(() => {
    searchGeneration.current += 1;
    setNotice(null);
    setSearch(null);
    setSearching(false);
    if (searchOrigin.current) {
      const restored = searchOrigin.current;
      setDetail({ ...restored, loadingMore: false, releasesLoadingMore: false });
      loadPendingDetail(restored, ++resolveGeneration.current);
      searchOrigin.current = null;
    }
  }, [loadPendingDetail]);

  useEffect(() => {
    const closed = () => {
      setWatch(null);
    };
    window.addEventListener("harbor:music-player-closed", closed);
    return () => window.removeEventListener("harbor:music-player-closed", closed);
  }, []);
  useMusicPageEscape(closeConnections, active && connectionsPage !== null);
  useMusicPageEscape(
    closeDiscovery,
    active &&
      discoveryPage !== null &&
      !connectionsPage &&
      (discoveryPage === "videos" || (!detail && !search && !watch && !ytm && !similar)),
  );
  useMusicPageEscape(
    clearSearch,
    active &&
      discoveryPage !== "videos" &&
      !connectionsPage &&
      search !== null &&
      detail === null &&
      similar === null &&
      watch === null &&
      !ytm,
  );
  useMusicPageEscape(
    closeDetail,
    active &&
      discoveryPage !== "videos" &&
      !connectionsPage &&
      detail !== null &&
      similar === null &&
      watch === null &&
      !ytm,
  );
  useMusicPageEscape(closeYtm, active && discoveryPage !== "videos" && !connectionsPage && ytm);
  useMusicPageEscape(
    closeWatch,
    active && discoveryPage !== "videos" && !connectionsPage && watch !== null && !ytm,
  );
  useMusicPageEscape(
    closeSimilar,
    active &&
      discoveryPage !== "videos" &&
      !connectionsPage &&
      similar !== null &&
      watch === null &&
      !ytm,
  );
  useMusicPageEscape(
    () => setGenre(null),
    active &&
      tab === "explore" &&
      genre !== null &&
      !connectionsPage &&
      !discoveryPage &&
      !search &&
      !detail &&
      !similar &&
      !watch &&
      !ytm,
  );
  const layerKey = connectionsPage
    ? `connections:${connectionsPage.focusId ?? "all"}`
    : discoveryPage === "videos"
      ? `videos:${videoQuery}`
      : ytm
        ? "ytm"
        : watch
          ? "watch"
          : similar
            ? `similar:${similar.seed.id}`
            : detail
              ? `detail:${detailTrail.current.length}|${detail.item.connectorId ?? ""}:${detail.item.kind}:${detail.item.id}`
              : search
                ? `search:${search.mode ?? "search"}:${search.query}`
                : discoveryPage
                  ? `discovery:${discoveryPage}`
                  : `tab:${tab}`;
  useMusicScrollContinuity(scrollRef, layerKey);

  const retry = useCallback(() => {
    reloadConnections();
    data.reload();
  }, [data, reloadConnections]);

  const playTrack = useCallback(
    (track: MusicTrack, queue: MusicTrack[]) => {
      openSourcePicker(track, queue.length > 0 ? queue : [track]);
    },
    [openSourcePicker],
  );

  const openItem = useCallback(
    (item: MusicCatalogItem, _siblings: MusicCatalogItem[], remember = true) => {
      similarRun.current += 1;
      searchGeneration.current += 1;
      const generation = ++resolveGeneration.current;
      const leaveSource = () => {
        setSimilar(null);
        setSearch(null);
        setCollectionPage(null);
        setDiscoveryPage(null);
        setYtm(false);
        setWatch(null);
        setOpeningDetail(null);
      };
      if (item.kind === "track" && item.mediaKind === "video") {
        leaveSource();
        watchFromVideos.current = false;
        const queue = _siblings.filter(
          (entry): entry is Extract<MusicCatalogItem, { kind: "track" }> =>
            entry.kind === "track" && entry.mediaKind === "video",
        );
        setWatch({ track: item, queue: queue.length ? queue : [item] });
        return;
      }
      const trigger = document.activeElement;
      const label = trigger?.getAttribute("aria-label") ?? null;
      const text = trigger?.textContent ?? null;
      const view =
        !remember && detailRef.current?.item.id === item.id ? detailRef.current.view : undefined;
      const snapshot: MusicDetailState = {
        item,
        tracks: item.kind === "track" ? [item] : [],
        rows: [],
        loading: item.kind !== "track",
        error: "",
        rowsLoading: item.kind === "artist" || item.kind === "track",
        rowsError: "",
        view,
      };
      const commit = (resolved: MusicDetailState) => {
        if (generation !== resolveGeneration.current) return;
        if (remember) detailTrail.current.push({ detail: detailRef.current, label, text });
        leaveSource();
        setDetail(resolved);
        loadPendingDetail(resolved, generation);
      };
      if (item.kind === "artist" && item.connectorId !== "local") {
        // Keep the current page intact until identity is settled. Painting the raw provider
        // record first briefly mixes two artist heroes and their local component state.
        setOpeningDetail(generation);
        void identityForRef(item)
          .then((artist) => {
            commit({ ...snapshot, item: { ...artist, kind: "artist" as const } });
          })
          .catch(() => commit(snapshot));
      } else commit(snapshot);
    },
    [loadPendingDetail],
  );

  const loadMoreArtistTracks = useCallback(async () => {
    const current = detailRef.current;
    if (
      !current ||
      current.item.kind !== "artist" ||
      (current.nextOffset == null && !current.trackCursor) ||
      current.loadingMore
    )
      return;
    const generation = resolveGeneration.current;
    setDetail((value) => (value ? { ...value, loadingMore: true, moreError: "" } : value));
    try {
      const local = current.item.connectorId === "local";
      const page = local
        ? await localCollection("tracks", "", current.nextOffset ?? 0, current.item.id)
        : await artistCatalog(current.item, "tracks", current.trackCursor);
      if (generation !== resolveGeneration.current) return;
      const tracks = page.items.filter(
        (entry): entry is Extract<MusicCatalogItem, { kind: "track" }> => entry.kind === "track",
      );
      setDetail((value) =>
        value
          ? {
              ...value,
              tracks: [
                ...value.tracks,
                ...tracks.filter(
                  (track) => !value.tracks.some((existing) => existing.id === track.id),
                ),
              ],
              nextOffset: "nextOffset" in page ? page.nextOffset : undefined,
              trackCursor:
                "nextCursor" in page && page.nextCursor !== current.trackCursor
                  ? page.nextCursor
                  : null,
              loadingMore: false,
            }
          : value,
      );
    } catch (cause) {
      if (generation === resolveGeneration.current)
        setDetail((value) =>
          value ? { ...value, loadingMore: false, moreError: errorText(cause) } : value,
        );
    }
  }, []);

  const loadMoreArtistReleases = useCallback(async () => {
    const current = detailRef.current;
    if (
      !current ||
      current.item.kind !== "artist" ||
      !current.releaseCursor ||
      current.releasesLoadingMore
    )
      return;
    const generation = resolveGeneration.current;
    setDetail((value) =>
      value ? { ...value, releasesLoadingMore: true, releasesMoreError: "" } : value,
    );
    try {
      const page = await artistCatalog(current.item, "albums", current.releaseCursor);
      if (generation !== resolveGeneration.current) return;
      setDetail((value) =>
        value
          ? {
              ...value,
              rows: value.rows.map((row) =>
                row.id === "artist:releases"
                  ? {
                      ...row,
                      items: [
                        ...row.items,
                        ...page.items.filter(
                          (item) => !row.items.some((existing) => existing.id === item.id),
                        ),
                      ],
                    }
                  : row,
              ),
              releaseCursor: page.nextCursor === current.releaseCursor ? null : page.nextCursor,
              releasesLoadingMore: false,
            }
          : value,
      );
    } catch (cause) {
      if (generation === resolveGeneration.current)
        setDetail((value) =>
          value
            ? { ...value, releasesLoadingMore: false, releasesMoreError: errorText(cause) }
            : value,
        );
    }
  }, []);

  const [libraryTarget, setLibraryTarget] = useState<{ view?: string; playlistId?: string; spotifyKind?: "playlists" | "liked" } | null>(
    null,
  );
  // Clicking a playlist has to land on that playlist, not on whatever tab the library
  // happened to open on last time.
  const openLibrary = useCallback((target?: { view?: string; playlistId?: string; spotifyKind?: "playlists" | "liked" }) => {
    similarRun.current += 1;
    setLibraryTarget(target ?? null);
    setCollectionPage(target?.playlistId
      ? { kind: "playlist", id: target.playlistId }
      : target?.view === "saved" || target?.view === "liked"
        ? { kind: "liked", id: "liked" }
        : target?.view === "recent"
          ? { kind: "recent", id: "recent" }
          : null);
    setTab("library");
    setDetail(null);
    setSearch(null);
    setSimilar(null);
    setWatch(null);
    setYtm(false);
    setDiscoveryPage(null);
    searchOrigin.current = null;
    scrollRef.current?.scrollTo({ top: 0 });
  }, []);

  const showSearch = useCallback(
    (query: string, results: MusicSearchResults | null, error = "", retry?: () => void) => {
      searchGeneration.current += 1;
      if (detailRef.current) searchOrigin.current = detailRef.current;
      setDetail(null);
      setSimilar(null);
      setSearching(false);
      setSearch({ query, connector: null, results, error, retry });
    },
    [],
  );

  // A song that is audibly playing must never dead-end on a compilation album name no source
  // carries, so navigation climbs from the exact phrase down to the artist alone, and says so.
  const ladderSearch = useCallback(
    async function climb(
      intent: MusicQueryIntent,
      typed: string,
      claim?: (results: MusicSearchResults, rung: QueryRung) => boolean,
    ): Promise<void> {
      const rungs = queryLadder(intent);
      if (!rungs.length) {
        runSearch(typed, null);
        return;
      }
      const generation = ++resolveGeneration.current;
      setNotice({ kind: "busy", text: t("music.loading") });
      const outcome = await runQueryLadder(
        rungs.map((rung) => rung.query),
        (query) => searchTyped(query, 48),
        { cancelled: () => generation !== resolveGeneration.current },
      );
      if (generation !== resolveGeneration.current) return;
      setNotice(null);
      if (!outcome.results || !outcome.query) {
        const alternatives = outcome.tried.filter((query) => query !== typed).join(" · ");
        showSearch(
          typed,
          null,
          outcome.errors.length
            ? t("Harbor could not reach your music sources while searching for {query}.", {
                query: typed,
              })
            : alternatives
              ? t(
                  "No connected music source has {query}. Harbor also searched {alternatives} and found nothing.",
                  { query: typed, alternatives },
                )
              : t("No connected music source has {query}.", { query: typed }),
          () => {
            void climb(intent, typed, claim);
          },
        );
        return;
      }
      if (claim?.(outcome.results, rungs[outcome.index])) return;
      // Only the rungs below the first are a fallback; rung zero is what the caller asked for.
      if (outcome.index > 0 && outcome.query !== typed)
        setNotice({
          kind: "info",
          text: t("No source has {query}. Showing results for {fallback}.", {
            query: typed,
            fallback: outcome.query,
          }),
        });
      showSearch(outcome.query, outcome.results);
    },
    [runSearch, showSearch, t],
  );

  // The menu entries navigate by searching, which is the view that already exists for
  // showing everything the connected sources hold for a name.
  const navigate = useMemo(
    () => ({
      goToArtist: (name: string, track?: MusicTrack) => {
        const generation = ++resolveGeneration.current;
        setNotice({ kind: "busy", text: t("music.loading") });
        void resolveArtist(name, { track })
          .then((ranking) => {
            if (generation !== resolveGeneration.current) return;
            setWatch(null);
            setYtm(false);
            setSimilar(null);
            setDiscoveryPage(null);
            setNotice(null);
            if (ranking.canonical && !(ranking.ambiguous && ranking.clusters.length > 1))
              openItem({ ...ranking.canonical, kind: "artist" }, []);
            else if (ranking.clusters.length)
              showSearch(name, {
                artists: displayClusters(ranking).map((cluster) => cluster.lead),
                tracks: [],
                albums: [],
                playlists: [],
              });
            // No exact credit anywhere is the same dead end as a missing album, so it climbs too.
            else void ladderSearch({ artist: name }, name);
          })
          .catch(() => {
            if (generation !== resolveGeneration.current) return;
            setNotice(null);
            setWatch(null);
            setSimilar(null);
            setDiscoveryPage(null);
            void ladderSearch({ artist: name }, name);
          });
      },
      goToAlbum: (album: string, artist: string, track?: MusicTrack) => {
        setWatch(null);
        setYtm(false);
        setSimilar(null);
        setDiscoveryPage(null);
        const typed = `${album} ${artist}`.trim();
        void ladderSearch({ title: track?.title, artist, album }, typed, (results, rung) => {
          if (rung.kind !== "album") return false;
          const exact = results.albums.filter(
            (item) =>
              artistNameKey(item.title) === artistNameKey(album) &&
              artistNameKey(item.artist) === artistNameKey(artist),
          );
          const catalog = exact.filter((item) => item.id.startsWith("deezer:album:"));
          const matches = catalog.length === 1 ? catalog : exact;
          if (matches.length === 1) {
            openItem({ ...matches[0], kind: "album" }, []);
            return true;
          }
          if (!matches.length) return false;
          showSearch(typed, { artists: [], albums: matches, tracks: [], playlists: [] });
          return true;
        });
      },
    }),
    [ladderSearch, openItem, showSearch, t],
  );
  useEffect(() => {
    const receive = () => {
      const request = takeMusicPlaylistRequest();
      if (request) openLibrary({ view: "playlists", playlistId: request.id });
    };
    window.addEventListener(MUSIC_PLAYLIST_EVENT, receive);
    receive();
    return () => window.removeEventListener(MUSIC_PLAYLIST_EVENT, receive);
  }, [openLibrary]);
  useEffect(() => {
    const receive = () => {
      const request = takeMusicLibraryRequest();
      if (request) openLibrary(request);
    };
    window.addEventListener(MUSIC_LIBRARY_EVENT, receive);
    receive();
    return () => window.removeEventListener(MUSIC_LIBRARY_EVENT, receive);
  }, [openLibrary]);
  useEffect(() => {
    const receive = () => {
      const request = takeMusicPlayRequest();
      if (request) playTrack(request.track, request.queue);
    };
    window.addEventListener(MUSIC_PLAY_EVENT, receive);
    receive();
    return () => window.removeEventListener(MUSIC_PLAY_EVENT, receive);
  }, [playTrack]);

  useEffect(() => {
    const receive = () => {
      const request = takeMusicExploreRequest();
      if (!request) return;
      if (request.kind === "home") {
        setNotice(null);
        connectionOrigin.current = null;
        discoveryOrigin.current = null;
        detailTrail.current = [];
        searchOrigin.current = null;
        searchGeneration.current += 1;
        resolveGeneration.current += 1;
        watchFromVideos.current = false;
        closeConnections();
        setDiscoveryPage(null);
        setDetail(null);
        setSearch(null);
        setSearching(false);
        setWatch(null);
        setYtm(false);
        setGenre(null);
        setTab("forYou");
        resetMusicScroll();
        requestAnimationFrame(() => {
          scrollRef.current
            ?.querySelector<HTMLHeadingElement>("h1")
            ?.focus({ preventScroll: true });
        });
        return;
      }
      closeConnections();
      if (request.kind === "similar") {
        setWatch(null);
        setYtm(false);
        setDiscoveryPage(null);
        const run = ++similarRun.current;
        if (request.queue?.length) {
          setSimilar({
            seed: request.track,
            tracks: request.queue,
            state: "ready",
            label: request.label,
            contextId: request.contextId,
          });
          return;
        }
        setSimilar({ seed: request.track, tracks: [], state: "loading" });
        void musicSimilarTracks(request.track)
          .then((mix) => {
            if (run !== similarRun.current) return;
            setSimilar({
              seed: request.track,
              tracks: mix.length ? mix : [request.track],
              state: mix.length ? "ready" : "error",
            });
          })
          .catch(() => {
            if (run !== similarRun.current) return;
            setSimilar({ seed: request.track, tracks: [], state: "error" });
          });
        return;
      }
      if (request.kind === "watch") {
        watchFromVideos.current = false;
        setDiscoveryPage(null);
        setWatch({
          track: request.track,
          queue: request.queue?.length ? request.queue : [request.track],
        });
      } else if (request.kind === "artist") {
        if (request.artist) {
          setWatch(null);
          setYtm(false);
          setSimilar(null);
          setDiscoveryPage(null);
          openItem({ ...request.artist, kind: "artist" }, []);
        } else navigate.goToArtist(request.track.artist, request.track);
      } else if (request.kind === "album") {
        if (request.album) {
          setWatch(null);
          setYtm(false);
          setDiscoveryPage(null);
          openItem({ ...request.album, kind: "album" }, []);
        } else
          navigate.goToAlbum(
            request.track.album ?? request.track.title,
            request.track.artist,
            request.track,
          );
      } else {
        setVideoQuery(`${request.track.artist} ${request.track.title}`);
        discoveryOrigin.current = { text: null };
        setDiscoveryPage("videos");
      }
    };
    window.addEventListener(MUSIC_EXPLORE_EVENT, receive);
    receive();
    return () => window.removeEventListener(MUSIC_EXPLORE_EVENT, receive);
  }, [navigate, closeConnections]);

  useEffect(() => {
    const receive = () => {
      const query = takeMusicSearchRequest();
      if (query === null) return;
      closeConnections();
      setDiscoveryPage(null);
      setWatch(null);
      setYtm(false);
      setNotice(null);
      setTab("forYou");
      // An empty request is the quick dock asking for the search page itself, not for a search.
      if (query.trim()) {
        runSearch(query, null);
        return;
      }
      showSearch("", null);
      requestAnimationFrame(() =>
        document.querySelector<HTMLInputElement>("[data-music-mast-search]")?.focus({ preventScroll: true }),
      );
    };
    window.addEventListener(MUSIC_SEARCH_EVENT, receive);
    receive();
    return () => window.removeEventListener(MUSIC_SEARCH_EVENT, receive);
  }, [runSearch, showSearch, closeConnections]);

  useEffect(() => {
    const receive = () => {
      const name = takeMusicGenreRequest();
      if (name) openGenre(name);
    };
    window.addEventListener(MUSIC_GENRE_EVENT, receive);
    receive();
    return () => window.removeEventListener(MUSIC_GENRE_EVENT, receive);
  }, [openGenre]);

  useEffect(() => {
    const receive = () => {
      const label = takeMusicLabelRequest();
      if (label) openLabel(label.id, label.name);
    };
    window.addEventListener(MUSIC_LABEL_EVENT, receive);
    receive();
    return () => window.removeEventListener(MUSIC_LABEL_EVENT, receive);
  }, [openLabel]);

  const slots = useMemo(
    () => splitHomeRows(data.homeRows, connections),
    [data.homeRows, connections],
  );

  const chartsTracks = tracksOf(slots.charts[0]?.items ?? []).length;
  const context: MusicBandContext = {
    t,
    data,
    player,
    connections,
    connectionsStatus,
    connectionsError,
    reloadConnections,
    slots,
    chartsInFresh: player.recents.length === 0 && chartsTracks > 0,
    playTrack,
    openItem,
    openLibrary,
    openMix: async (recent, load) => {
      if (!recent.seed) return;
      const run = ++similarRun.current;
      setDetail(null);
      setSearch(null);
      setCollectionPage(null);
      setDiscoveryPage(null);
      setWatch(null);
      setYtm(false);
      setSimilar({ seed: recent.seed, tracks: [], state: "loading", label: recent.name, contextId: recent.id });
      try {
        if (load) {
          const tracks = await load();
          if (!tracks.length) throw new Error("Music mix unavailable");
          if (similarRun.current === run) setSimilar({ seed: recent.seed, tracks, state: "ready", label: recent.name, contextId: recent.id });
          return;
        }
        await reopenMusicMix(recent, (request) => {
          if (similarRun.current !== run) return;
          setSimilar({ seed: request.track, tracks: request.queue ?? [], state: "ready", label: request.label, contextId: request.contextId });
        });
      } catch {
        if (similarRun.current === run)
          setSimilar({ seed: recent.seed, tracks: [], state: "error", label: recent.name, contextId: recent.id });
      }
    },
    searchArtist: (name) => navigate.goToArtist(name),
    openConnections,
  };

  const personal = personalBands(context);
  const spotifyRows = spotifyBands(context);
  const catalog = catalogBands(context);
  const bands: MusicBand[] = [];
  const jumpBackIn = jumpBackInBand(context);
  if (jumpBackIn) bands.push(jumpBackIn);
  if (tasteRows.loading && !tasteRows.rows.length)
    bands.push({
      key: "music:taste-loading",
      title: t("music.taste.choose"),
      catalog: true,
      render: () => (
        <p role="status" className="flex items-center gap-3 py-6 text-sm text-ink-muted">
          <LoaderCircle size={19} className="animate-spin motion-reduce:animate-none" />
          {t("music.loading")}
        </p>
      ),
    });
  for (const row of tasteRows.rows)
    bands.push({
      key: row.id,
      title: row.title,
      catalog: true,
      render: (title) => (
        <MusicCatalogRow
          row={{ ...row, title, subtitle: t("music.taste.basedOn") }}
          onOpen={(item) => openItem(item, row.items)}
        />
      ),
    });
  if (tasteRows.error)
    bands.push({
      key: "music:taste-error",
      title: t("music.taste.choose"),
      catalog: true,
      render: () => <MusicSectionError onRetry={tasteRows.retry} />,
    });
  bands.push(...spotifyRows);
  if (data.library?.playlists.length) bands.push(personal.playlists);
  const madeForYou = madeForYouBand(context);
  if (madeForYou) bands.push(madeForYou);
  if (personal.recents) bands.push(personal.recents);
  if (personal.recentContexts) bands.push(personal.recentContexts);
  if (slots.server.length) bands.push(...catalog.server);
  if (data.homeStatus !== "ready" || slots.newReleases.length) bands.push(catalog.newReleases);
  if (personal.fresh) bands.push(personal.fresh);
  if (player.recents.length || data.library?.artists.length) bands.push(personal.artists);
  if (catalog.charts && (data.homeStatus !== "ready" || slots.charts.length))
    bands.push(catalog.charts);
  bands.push({
    key: "music:billboard",
    title: "Billboard Hot 100",
    catalog: true,
    render: (title) => (
      <MusicBillboardCharts title={title} onOpen={openItem} onBrowse={openBillboard} />
    ),
  });
  const newReleaseCtas = newReleaseCtaBand(context);
  if (newReleaseCtas) bands.push(newReleaseCtas);
  bands.push({
    key: "music:videos",
    title: t("music.now.videos"),
    catalog: true,
    render: () => (
      <MusicVideoDiscovery
        controlsInHeader
        active={active}
        query={
          player.recents[0]?.artist ? `${player.recents[0].artist} music videos` : "music videos"
        }
        onWatch={openVideo}
      />
    ),
  });
  if (player.likedTracks.length || player.queue.length) bands.push(personal.queue);
  if (data.homeStatus !== "ready" || slots.stations.length) bands.push(...catalog.stations);
  bands.push({
    key: "rolling-stone",
    title: `${RS_SOURCE} · ${t(RS_500_TITLE)}`,
    catalog: true,
    render: (title) => (
      <MusicRollingStoneRow
        title={title}
        onOpen={(item, siblings) => openItem(item, siblings)}
        onViewAll={() => openDiscovery("rollingStone")}
      />
    ),
  });
  bands.push(...catalog.extras);
  const scrobble = scrobbleShelf(context, catalog.scrobble);
  if (scrobble) bands.push(scrobble);

  const gated = bands.map((band) => gateBand(band, context));
  const visible = gated;
  const stalled =
    data.homeStatus === "error" &&
    data.libraryStatus === "error" &&
    player.recents.length === 0 &&
    player.likedTracks.length === 0;

  return (
    <MusicNavigateProvider value={navigate}>
      <main
        ref={scrollCb}
        data-music-view
        data-music-opening={openingDetail === resolveGeneration.current || undefined}
        aria-busy={openingDetail === resolveGeneration.current || undefined}
        // A WS_CHILD webview is not clipped by a scrolling ancestor, so while YouTube Music is
        // mounted the page must not scroll: otherwise the child slides out over the sidebar
        // and title bar.
        // The shared video surface cuts its native aperture through this painted page.
        className={`min-h-0 min-w-0 w-full flex-1 overflow-x-hidden px-5 pt-28 pb-14 text-ink bg-canvas sm:px-8 lg:px-12 ${ytm && discoveryPage !== "videos" ? "overflow-y-hidden" : "overflow-y-auto"}`}
      >
        <ScrollRootContext.Provider value={scrollEl}>
          <div
            data-music-consolidated-back
            className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 pb-24 [&_[data-music-inner-back]]:hidden"
          >
            <section data-scroll-anchor="mast">
              <MusicMast
                initialQuery={search && search.mode !== "genre" ? search.query : ""}
                onSubmit={runSearch}
                onClear={clearSearch}
                onPick={(item) => openItem(item, [item])}
                searching={searching}
              />
            </section>

            {notice && <MusicNotice notice={notice} onDismiss={() => setNotice(null)} />}

            {connectionsPage ? (
              connectionsPage.focusId === "__audio" ? (
                <MusicAudioSettings connectorId={player.current?.connectorId} />
              ) : connectionsPage.focusId === "__speakers" ? (
                <MusicSpeakers
                  track={player.current}
                  onLoad={playMusicOnSpeaker}
                  onStop={stopMusicCasting}
                  onReturn={returnMusicToComputer}
                  onClose={closeConnections}
                />
              ) : (
                <MusicConnections
                  key={connectionsPage.focusId ?? "all"}
                  focusId={connectionsPage.focusId}
                  onClose={closeConnections}
                />
              )
            ) : discoveryPage === "videos" ? (
              <section>
                <button
                  type="button"
                  data-music-inner-back
                  onClick={closeDiscovery}
                  className="mb-6 flex min-h-11 items-center gap-2 text-sm text-ink-muted hover:text-ink"
                >
                  <ChevronLeft size={17} />
                  {t("music.watch.back")}
                </button>
                <MusicVideoDiscovery active={active} query={videoQuery} onWatch={openVideo} />
              </section>
            ) : ytm ? (
              <section className="flex flex-col gap-3">
                <button
                  type="button"
                  data-music-inner-back
                  onClick={closeYtm}
                  className="inline-flex w-fit items-center gap-1 text-[13px] text-ink-muted transition-colors hover:text-ink"
                >
                  <ChevronLeft className="size-4" aria-hidden />
                  {t("music.watch.back")}
                </button>
                <MusicYouTube active={active} onFellBack={closeYtm} />
              </section>
            ) : watch ? (
              <MusicWatch
                active={active}
                track={watch.track}
                queue={watch.queue}
                onClose={closeWatch}
              />
            ) : similar ? (
              <MusicSimilarPage
                seed={similar.seed}
                tracks={similar.tracks}
                state={similar.state}
                label={similar.label}
                contextId={similar.contextId}
                onBack={closeSimilar}
              />
            ) : detail ? (
              <MusicDetail
                key={layerKey}
                onVideo={openVideo}
                onViewChange={(view) =>
                  setDetail((current) => (current ? { ...current, view } : current))
                }
                onArtistSearch={navigate.goToArtist}
                onWatch={(track) => {
                  setVideoQuery(`${track.artist} ${track.title}`);
                  openDiscovery("videos");
                }}
                onLoadMore={loadMoreArtistTracks}
                onLoadMoreReleases={loadMoreArtistReleases}
                detail={detail}
                onBack={closeDetail}
                onPlay={(track, queue) => {
                  registerMusicCatalogOrigin(detail.item, queue);
                  playTrack(track, queue);
                }}
                onOpen={openItem}
                onRetry={() => openItem(detail.item, [], false)}
              />
            ) : search ? (
              <MusicSearchPanel
                variant={search.mode ?? "search"}
                labelId={search.labelId}
                query={search.query}
                results={search.results}
                error={search.error}
                searching={searching}
                onRetry={search.retry ?? (() => runSearch(search.query, search.connector))}
                onClear={clearSearch}
                onOpenItem={(item, siblings) => { rememberMusicSearchItem(item); openItem(item, siblings); }}
                onPlayTrack={(track, queue) => { rememberMusicSearchItem({ ...track, kind: "track" }); playTrack(track, queue); }}
              />
            ) : discoveryPage === "tastes" ? (
              <MusicTastes
                selected={tastes}
                onSave={(ids) => {
                  setTastes(ids);
                  closeDiscovery();
                  if (tab === "library") {
                    setTab("forYou");
                    scrollRef.current?.scrollTo({ top: 0 });
                  }
                }}
                onBack={closeDiscovery}
              />
            ) : discoveryPage === "playlists" ? (
              <MusicTopPlaylists onBack={closeDiscovery} onOpen={openItem} />
            ) : discoveryPage === "rollingStone" ? (
              <MusicRollingStonePage onBack={closeDiscovery} onOpen={openItem} />
            ) : discoveryPage === "billboard" ? (
              <MusicBillboardPage
                onBack={closeDiscovery}
                onOpen={openItem}
                initialChart={billboardChart}
                onChartChange={setBillboardChart}
              />
            ) : collectionPage?.kind === "playlist" ? (
              <MusicPlaylistPage
                key={collectionPage.id}
                playlistId={collectionPage.id}
                active={active}
                onBack={closeCollectionPage}
              />
            ) : collectionPage ? (
              <MusicTrackCollectionPage
                key={collectionPage.kind}
                kind={collectionPage.kind}
                active={active}
                onBack={closeCollectionPage}
              />
            ) : null}
            {(!(
              connectionsPage ||
              ytm ||
              watch ||
              similar ||
              detail ||
              search ||
              discoveryPage ||
              collectionPage
            ) ||
              tab === "library") && (
              <div
                style={{
                  display:
                    connectionsPage ||
                    ytm ||
                    watch ||
                    similar ||
                    detail ||
                    search ||
                    discoveryPage ||
                    collectionPage
                      ? "none"
                      : "contents",
                }}
              >
                <section
                  data-scroll-anchor="tabs"
                  className="music-navigation flex flex-wrap items-center justify-between gap-3"
                >
                  <MusicTabs className="min-w-0 flex-1" value={tab} onChange={setTab} />
                  {tab === "forYou" && <HoverTooltip label={t("music.quickListen.title")}>
                    <button type="button" className="music-quick-entry" aria-label={t("music.quickListen.title")} onClick={() => setQuickListen([
                      ...(player.current ? [player.current] : []), ...player.recents, ...player.likedTracks,
                      ...data.homeRows.flatMap(row => row.items.filter((item): item is MusicCatalogItem & MusicTrack => item.kind === "track")),
                    ])}><MusicQuickListenIcon /></button>
                  </HoverTooltip>}
                  {tab === "forYou" && <MusicSurpriseButton genres={tastes} homeRows={data.homeRows} spotifyConnected={connections.some(connection => connection.id === "spotify" && connection.status === "connected")} onChooseTastes={() => openDiscovery("tastes")} />}
                  {tab === "forYou" && (
                    <CatalogCustomizeBar
                      editMode={pageRows.editMode}
                      hasChanges={hasPageRowChanges(pageRows.custom)}
                      onToggleEdit={() => pageRows.setEditMode((value) => !value)}
                      onReset={() => pageRows.persist(resetPageRows())}
                    />
                  )}
                </section>

                <div
                  id={musicTabPanelId(tab)}
                  role="tabpanel"
                  aria-labelledby={musicTabButtonId(tab)}
                  tabIndex={0}
                  className="flex flex-col gap-8 outline-none"
                >
                  {tab === "forYou" && (
                    <section data-scroll-anchor="hero">
                      <MusicHomeHero
                        rows={data.homeRows}
                        recent={player.recents}
                        loading={data.homeStatus === "loading"}
                        active={active}
                        onOpen={openItem}
                        onLibrary={openLibrary}
                        onConnect={openConnections}
                        onYouTube={() => setYtm(true)}
                        onPlaylists={() => openDiscovery("playlists")}
                        onTastes={() => openDiscovery("tastes")}
                      />
                    </section>
                  )}
                  {tab === "explore" && (
                    <>
                      <MusicGenres
                        genre={genre}
                        onGenre={setGenre}
                        onOpen={openItem}
                        onBillboard={openBillboard}
                        onTastes={() => openDiscovery("tastes")}
                        onWatch={openVideo}
                        onPlay={playTrack}
                        active={active}
                      />
                      <MusicExploreBands
                        recents={player.recents}
                        liked={player.likedTracks}
                        active={active}
                        genre={genre}
                        onPlay={playTrack}
                        onOpen={openItem}
                      />
                    </>
                  )}
                  {tab === "library" ? (
                    <MusicLibrary
                      active={
                        active &&
                        !(
                          connectionsPage ||
                          ytm ||
                          watch ||
                          similar ||
                          detail ||
                          search ||
                          discoveryPage ||
                          collectionPage
                        )
                      }
                      onOpen={openItem}
                      onCollection={openCollection}
                      onTastes={() => openDiscovery("tastes")}
                      initialView={libraryTarget?.view}
                      initialSpotifyKind={libraryTarget?.spotifyKind}
                    />
                  ) : tab === "explore" ? null : stalled ? (
                    <MusicStalled message={data.homeError} onRetry={retry} />
                  ) : (
                    <MusicBandStack
                      bands={visible}
                      custom={pageRows.custom}
                      editMode={pageRows.editMode}
                      onPersist={pageRows.persist}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
          <BackToTop
            scrollRef={scrollRef}
            icon={<MusicGlyph name="expand" size={14} />}
          />
        </ScrollRootContext.Provider>
      </main>
      {active && quickListen && <Suspense fallback={null}><MusicQuickListen seeds={quickListen} onClose={() => setQuickListen(null)} /></Suspense>}
    </MusicNavigateProvider>
  );
}

function MusicNotice({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const t = useT();
  const error = notice.kind === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
      className={`flex items-center gap-3 rounded-md border px-4 py-2.5 text-[13px] ${
        error
          ? "border-danger/40 bg-danger/5 text-danger"
          : "border-edge-soft bg-surface text-ink-muted"
      }`}
    >
      <span className="min-w-0 flex-1" title={notice.text}>
        {notice.text}
      </span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("music.error.dismiss")}
        className="grid size-11 shrink-0 place-items-center rounded-full text-ink-subtle transition-colors duration-200 ease-out hover:bg-elevated hover:text-ink"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}

function MusicStalled({ message, onRetry }: { message: string; onRetry: () => void }) {
  const t = useT();
  return (
    <section className="grid min-h-64 place-items-center rounded-xl border border-edge-soft bg-surface px-6 py-10 text-center">
      <div className="max-w-md">
        <Music2 size={26} className="mx-auto text-ink-muted" aria-hidden="true" />
        <h2 className="mt-4 font-display text-2xl text-ink">{t("music.offline.title")}</h2>
        <p className="mt-2 text-[13px] leading-5 text-ink-muted">
          {message || t("music.error.load")}
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 inline-flex h-11 items-center rounded-full bg-ink px-5 text-[12px] font-semibold text-canvas transition-transform duration-200 ease-out hover:scale-[1.02] active:scale-[0.99]"
        >
          {t("music.offline.retry")}
        </button>
      </div>
    </section>
  );
}

function useMusicPageEscape(onBack: () => void, active: boolean) {
  useSectionBack(onBack, active);
  useEffect(() => {
    if (!active) return;
    const handle = (event: KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        document.querySelector(
          '[role="dialog"], [role="menu"], [role="listbox"], [data-dropdown-menu]',
        ) ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onBack();
    };
    window.addEventListener("keydown", handle, true);
    return () => window.removeEventListener("keydown", handle, true);
  }, [onBack, active]);
}
