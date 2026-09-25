import "./music/music-page-system.css";
import { MusicBillboardPage } from "@/components/music/music-billboard-page";
import { MusicGenres, type MusicGenreEntry } from "./music/music-genres";
import { MusicBillboardCharts } from "@/components/music/music-discovery-charts";
import { MusicAudioSettings } from "@/components/music/music-audio-settings";
import { MusicSpeakers } from "@/components/music/music-speakers";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, LoaderCircle, Music2, X } from "lucide-react";
import { BackToTop } from "@/components/back-to-top";
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
  MusicTopPlaylists,
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
import {
  MUSIC_EXPLORE_EVENT,
  MUSIC_GENRE_EVENT,
  MUSIC_PANEL_EVENT,
  MUSIC_PLAYLIST_EVENT,
  MUSIC_SEARCH_EVENT,
  takeMusicExploreRequest,
  takeMusicGenreRequest,
  takeMusicPanelRequest,
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
import {
  queryLadder,
  runQueryLadder,
  type MusicQueryIntent,
  type QueryRung,
} from "@/lib/music/search-fallback";
import {
  playMusicOnSpeaker,
  returnMusicToComputer,
  stopMusicCasting,
  useMusicPlayer,
} from "@/lib/music/player";
import type { MusicCatalogItem, MusicSearchResults, MusicTrack } from "@/lib/music/types";
import { hasPageRowChanges, resetPageRows, usePageRows } from "@/lib/page-rows";
import { useScrollMemory } from "@/lib/view";
import { resetMusicScroll, useMusicScrollContinuity } from "@/lib/music/scroll-continuity";
import { pushBackHandler } from "@/lib/back-intercept";
import { MusicBandStack } from "./music/music-band-stack";
import { gateBand, scrobbleShelf } from "./music/music-band-gates";
import { tracksOf, type MusicBand, type MusicBandContext } from "./music/music-band-types";
import { catalogBands } from "./music/music-catalog-bands";
import { splitHomeRows } from "./music/music-home-rows";
import { personalBands } from "./music/music-personal-bands";
import { MusicSearchPanel } from "./music/music-search-panel";
import { useMusicData } from "./music/use-music-data";

import { MusicDetail, type MusicDetailState } from "./music/music-detail";
import { loadDetailRows, loadDetailTracks } from "./music/music-detail-data";

type SearchState = {
  query: string;
  connector: string | null;
  results: MusicSearchResults | null;
  error: string;
  mode?: "search" | "genre";
  /** Retries the work that produced this state, so a climbed search does not retry as a flat one. */
  retry?: () => void;
};

type Notice = { kind: "busy" | "info" | "error"; text: string };

export function MusicView({
  active,
  shellBackAvailable = false,
}: {
  active: boolean;
  shellBackAvailable?: boolean;
}) {
  return (
    <MusicConnectionsProvider>
      <MusicSourcePickerProvider>
        <MusicPlaylistPickerProvider>
          <MusicViewContent active={active} shellBackAvailable={shellBackAvailable} />
        </MusicPlaylistPickerProvider>
      </MusicSourcePickerProvider>
    </MusicConnectionsProvider>
  );
}

function MusicViewContent({
  active,
  shellBackAvailable,
}: {
  active: boolean;
  shellBackAvailable: boolean;
}) {
  const t = useT();
  const player = useMusicPlayer();
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
    "tastes" | "playlists" | "videos" | "billboard" | null
  >(null);
  const [billboardChart, setBillboardChart] = useState("hot-100");
  const [videoQuery, setVideoQuery] = useState("music videos");
  const discoveryOrigin = useRef<{ text: string | null } | null>(null);
  const openDiscovery = (page: "tastes" | "playlists" | "videos" | "billboard") => {
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
  const [tab, setTab] = useState<MusicTabId>("forYou");
  const [search, setSearch] = useState<SearchState | null>(null);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [watch, setWatch] = useState<{ track: MusicTrack; queue: MusicTrack[] } | null>(null);
  const [similar, setSimilar] = useState<{ seed: MusicTrack; tracks: MusicTrack[] } | null>(null);
  const watchFromVideos = useRef(false);
  const openVideo = (track: MusicTrack, queue: MusicTrack[]) => {
    watchFromVideos.current = discoveryPage === "videos";
    if (watchFromVideos.current) setDiscoveryPage(null);
    setWatch({ track, queue });
  };
  const closeSimilar = useCallback(() => setSimilar(null), []);
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
    if (active) document.title = `${t("music.title")} | Harbor`;
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

  const openGenre = useCallback((name: string) => {
    const generation = ++searchGeneration.current;
    if (detailRef.current) searchOrigin.current = detailRef.current;
    setDetail(null);
    if (!searchOrigin.current) detailTrail.current = [];
    resolveGeneration.current += 1;
    setSimilar(null);
    setSearch({ query: name, connector: null, results: null, error: "", mode: "genre" });
    setSearching(true);
    searchTyped(name, 36, undefined)
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
      !search &&
      !detail &&
      !similar &&
      !watch &&
      !ytm,
  );
  const mastBack = connectionsPage
    ? closeConnections
    : discoveryPage === "videos"
      ? closeDiscovery
      : ytm
        ? closeYtm
        : watch
          ? closeWatch
          : similar
            ? closeSimilar
            : detail
              ? closeDetail
              : search
                ? clearSearch
                : discoveryPage
                  ? closeDiscovery
                  : tab === "explore" && genre !== null
                    ? () => setGenre(null)
                    : undefined;

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
              ? `detail:${detailTrail.current.length}|${detail.item.kind}:${detail.item.id}`
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
      setSimilar(null);
      if (item.kind === "track" && item.mediaKind === "video") {
        watchFromVideos.current = false;
        setDiscoveryPage(null);
        const queue = _siblings.filter(
          (entry): entry is Extract<MusicCatalogItem, { kind: "track" }> =>
            entry.kind === "track" && entry.mediaKind === "video",
        );
        setWatch({ track: item, queue: queue.length ? queue : [item] });
        return;
      }
      if (remember) {
        const trigger = document.activeElement;
        detailTrail.current.push({
          detail: detailRef.current,
          label: trigger?.getAttribute("aria-label") ?? null,
          text: trigger?.textContent ?? null,
        });
      }
      const generation = ++resolveGeneration.current;
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
      setDetail(snapshot);
      if (item.kind === "artist" && item.connectorId !== "local") {
        void identityForRef(item)
          .then((artist) => {
            if (generation !== resolveGeneration.current) return;
            const resolved = { ...snapshot, item: { ...artist, kind: "artist" as const } };
            setDetail(resolved);
            loadPendingDetail(resolved, generation);
          })
          .catch(() => loadPendingDetail(snapshot, generation));
      } else loadPendingDetail(snapshot, generation);
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

  const [libraryTarget, setLibraryTarget] = useState<{ view?: string; playlistId?: string } | null>(
    null,
  );
  // Clicking a playlist has to land on that playlist, not on whatever tab the library
  // happened to open on last time.
  const openLibrary = useCallback((target?: { view?: string; playlistId?: string }) => {
    setLibraryTarget(target ?? null);
    setTab("library");
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
        setSimilar({
          seed: request.track,
          tracks: request.queue?.length ? request.queue : [request.track],
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
      if (!query) return;
      closeConnections();
      setDiscoveryPage(null);
      setWatch(null);
      setYtm(false);
      setNotice(null);
      setTab("forYou");
      runSearch(query, null);
    };
    window.addEventListener(MUSIC_SEARCH_EVENT, receive);
    receive();
    return () => window.removeEventListener(MUSIC_SEARCH_EVENT, receive);
  }, [runSearch, closeConnections]);

  useEffect(() => {
    const receive = () => {
      const name = takeMusicGenreRequest();
      if (name) openGenre(name);
    };
    window.addEventListener(MUSIC_GENRE_EVENT, receive);
    receive();
    return () => window.removeEventListener(MUSIC_GENRE_EVENT, receive);
  }, [openGenre]);

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
    searchArtist: (name) => navigate.goToArtist(name),
    openConnections,
  };

  const personal = personalBands(context);
  const catalog = catalogBands(context);
  const bands: MusicBand[] = [];
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
  bands.push({
    key: "music:videos",
    title: t("music.now.videos"),
    catalog: true,
    render: () => (
      <MusicVideoDiscovery
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
  bands.push(...catalog.extras);
  if (data.library?.playlists.length) bands.push(personal.playlists);
  const scrobble = scrobbleShelf(context, catalog.scrobble);
  if (scrobble && data.lastfm?.connected) bands.push(scrobble);

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
                onBack={shellBackAvailable ? undefined : mastBack}
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
                  positionSec={player.currentTime}
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
              <MusicSimilarPage seed={similar.seed} tracks={similar.tracks} onBack={closeSimilar} />
            ) : detail ? (
              <MusicDetail
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
                onPlay={playTrack}
                onOpen={openItem}
                onRetry={() => openItem(detail.item, [], false)}
              />
            ) : search ? (
              <MusicSearchPanel
                variant={search.mode === "genre" ? "genre" : "search"}
                query={search.query}
                results={search.results}
                error={search.error}
                searching={searching}
                onRetry={search.retry ?? (() => runSearch(search.query, search.connector))}
                onClear={clearSearch}
                onOpenItem={openItem}
                onPlayTrack={playTrack}
              />
            ) : discoveryPage === "tastes" ? (
              <MusicTastes
                selected={tastes}
                onSave={(ids) => {
                  setTastes(ids);
                  closeDiscovery();
                }}
                onBack={closeDiscovery}
              />
            ) : discoveryPage === "playlists" ? (
              <MusicTopPlaylists onBack={closeDiscovery} onOpen={openItem} />
            ) : discoveryPage === "billboard" ? (
              <MusicBillboardPage
                onBack={closeDiscovery}
                onOpen={openItem}
                initialChart={billboardChart}
                onChartChange={setBillboardChart}
              />
            ) : null}
            {(!(connectionsPage || ytm || watch || similar || detail || search || discoveryPage) ||
              tab === "library") && (
              <div
                style={{
                  display:
                    connectionsPage || ytm || watch || similar || detail || search || discoveryPage
                      ? "none"
                      : "contents",
                }}
              >
                <section
                  data-scroll-anchor="tabs"
                  className="music-navigation flex flex-wrap items-center justify-between gap-3"
                >
                  <MusicTabs className="min-w-0 flex-1" value={tab} onChange={setTab} />
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
                      />
                      <MusicVideoDiscovery active={active} onWatch={openVideo} />
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
                          discoveryPage
                        )
                      }
                      onOpen={openItem}
                      initialView={libraryTarget?.view}
                      initialPlaylistId={libraryTarget?.playlistId}
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
          <BackToTop scrollRef={scrollRef} />
        </ScrollRootContext.Provider>
      </main>
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
  useEffect(() => {
    if (!active) return;
    const removeBack = pushBackHandler(() => {
      onBack();
      return true;
    });
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
    return () => {
      window.removeEventListener("keydown", handle, true);
      removeBack();
    };
  }, [onBack, active]);
}
