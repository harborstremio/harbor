import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import type { Meta } from "./cinemeta";
import { profileFromMeta, trackEvent } from "./discover";
import type { StreamingService } from "./settings";
import { useTogether } from "./together/provider";
import type { SportsGame } from "./sports/espn";
import { beginMarathonAdvance } from "./fullscreen-state";
import { armRemoteStickyHop } from "./remote/session";
import { franchiseRoot, franchiseRootSync } from "./providers/anime-franchise-root";

const isAnimeMetaId = (id: string) => /^(kitsu|mal|anilist|anidb):/.test(id);
export type View =
  | "home"
  | "settings"
  | "anime"
  | "discover"
  | "catalogs"
  | "addons"
  | "calendar"
  | "movies"
  | "shows"
  | "kids"
  | "library"
  | "live"
  | "vod"
  | "downloads"
  | "wrapped";

export type PlayEpisode = {
  season: number;
  episode: number;
  name?: string;
  imdbId?: string;
  imdbSeason?: number;
  imdbEpisode?: number;
  kitsuStreamId?: string;
  videoId?: string;
  still?: string;
  overview?: string;
  rating?: number;
  airDate?: string;
  runtime?: number;
};

export type PlayerSrc = {
  meta: Meta;
  imdbId?: string;
  imdbIdVerified?: boolean;
  episode?: PlayEpisode;
  url: string;
  title: string;
  subtitle?: string;
  notWebReady?: boolean;
  subtitles?: Array<{ url: string; lang?: string; id?: string }>;
  subtitlePreselect?: { off: boolean; url?: string; lang?: string; title?: string };
  attempt?: number;
  autoFired?: boolean;
  resume?: boolean;
  startFromZero?: boolean;
  streamRef?: PlayerStreamRef;
  liveProgram?: string;
  isLive?: boolean;
  headers?: Record<string, string>;
};

export type PlayerStreamRef = {
  infoHash?: string | null;
  fileIdx?: number | null;
  addonId?: string | null;
  title?: string | null;
  parsedTitle?: string | null;
  resolution?: string | null;
  quality?: string | null;
  releaseGroup?: string | null;
  source?: string | null;
  size?: number | null;
  bingeGroup?: string | null;
  cachedSlugs?: string[];
};

export type GridSpec = {
  title: string;
  fetcher: (page: number) => Promise<Meta[]>;
  initial?: Meta[];
  kidsHero?: { grad: string; art: string; name: string };
};

export type MetaFilter =
  | { kind: "year"; mediaType: "movie" | "tv"; value: number }
  | { kind: "runtime"; mediaType: "movie" | "tv"; value: number }
  | { kind: "genre"; mediaType: "movie" | "tv"; name: string; id: number }
  | { kind: "studio"; mediaType: "movie" | "tv"; name: string; id: number }
  | { kind: "country"; mediaType: "movie" | "tv"; name: string; iso: string }
  | { kind: "language"; mediaType: "movie" | "tv"; name: string; iso: string }
  | { kind: "network"; mediaType: "movie" | "tv"; name: string; id: number };

export type Frame =
  | { kind: "home" }
  | { kind: "settings" }
  | { kind: "anime" }
  | { kind: "discover" }
  | { kind: "catalogs" }
  | { kind: "addons" }
  | { kind: "addon-detail"; id: string }
  | { kind: "calendar" }
  | { kind: "wrapped" }
  | { kind: "queue" }
  | { kind: "movies" }
  | { kind: "shows" }
  | { kind: "kids" }
  | { kind: "library" }
  | { kind: "live" }
  | { kind: "vod" }
  | { kind: "downloads" }
  | { kind: "service"; service: StreamingService }
  | {
      kind: "meta";
      meta: Meta;
      liveContext?: boolean;
      episodeHint?: { season: number; episode: number };
      seasonEntryId?: string;
    }
  | { kind: "episode-detail"; seriesId: string; season: number; episode: number; seriesMeta?: Meta }
  | { kind: "person"; id: number }
  | { kind: "collection"; id: number }
  | { kind: "collections" }
  | { kind: "filter"; filter: MetaFilter }
  | { kind: "grid"; grid: GridSpec }
  | { kind: "award"; awardType: import("./providers/wikidata").AwardType }
  | { kind: "anime-award"; sourceId: import("./anime-awards").AwardSourceId }
  | {
      kind: "picker";
      meta: Meta;
      episode?: PlayEpisode;
      autoPlay?: boolean;
      attempt?: number;
      intent?: "play" | "download";
      resume?: boolean;
    }
  | { kind: "player"; src: PlayerSrc }
  | { kind: "match-detail"; game: SportsGame };

const ROOT_VIEW_BY_KIND: Record<Frame["kind"], View | null> = {
  home: "home",
  settings: "settings",
  anime: "anime",
  discover: "discover",
  catalogs: "catalogs",
  addons: "addons",
  "addon-detail": "addons",
  calendar: "calendar",
  wrapped: "wrapped",
  queue: "discover",
  movies: "movies",
  shows: "shows",
  kids: "kids",
  library: "library",
  live: "live",
  vod: "vod",
  downloads: "downloads",
  service: null,
  meta: null,
  "episode-detail": null,
  person: null,
  collection: null,
  collections: null,
  filter: null,
  grid: null,
  award: null,
  "anime-award": null,
  picker: null,
  player: null,
  "match-detail": null,
};

function rootViewFromStack(stack: Frame[]): View {
  for (let i = stack.length - 1; i >= 0; i--) {
    const candidate = ROOT_VIEW_BY_KIND[stack[i].kind];
    if (candidate) return candidate;
  }
  return "home";
}

export type ScrollSnapshot = {
  anchor?: string;
  delta: number;
  fallback: number;
};

export type SettingsSection =
  | "account"
  | "library"
  | "trakt"
  | "anilist"
  | "simkl"
  | "parental"
  | "relay"
  | "streaming"
  | "language"
  | "player"
  | "advanced";

type ViewValue = {
  view: View;
  setView: (v: View) => void;
  openSettings: (section?: SettingsSection) => void;
  settingsSectionRequest: { section: SettingsSection | null; nonce: number };
  topKind: Frame["kind"];
  topPath: string;
  service: StreamingService | null;
  openService: (s: StreamingService | null) => void;
  meta: Meta | null;
  metaLiveContext: boolean;
  metaEpisodeHint: { season: number; episode: number } | null;
  metaSeasonEntryId: string | null;
  openMeta: (
    m: Meta | null,
    opts?: {
      liveContext?: boolean;
      episodeHint?: { season: number; episode: number };
      seasonEntryId?: string;
      exact?: boolean;
    },
  ) => void;
  episodeDetail: { seriesId: string; season: number; episode: number; seriesMeta?: Meta } | null;
  openEpisodeDetail: (seriesId: string, season: number, episode: number, seriesMeta?: Meta) => void;
  matchDetailGame: SportsGame | null;
  openMatchDetail: (game: SportsGame) => void;
  promoteMetaToRoot: () => void;
  personId: number | null;
  openPerson: (id: number | null) => void;
  collectionId: number | null;
  openCollection: (id: number) => void;
  openQueue: () => void;
  filter: MetaFilter | null;
  openFilter: (f: MetaFilter) => void;
  grid: GridSpec | null;
  openGrid: (g: GridSpec) => void;
  openCollections: () => void;
  stackKinds: Frame["kind"][];
  awardType: import("./providers/wikidata").AwardType | null;
  openAward: (t: import("./providers/wikidata").AwardType) => void;
  animeAwardSource: import("./anime-awards").AwardSourceId | null;
  openAnimeAward: (s: import("./anime-awards").AwardSourceId) => void;
  homeResetTick: number;
  picker: {
    meta: Meta;
    episode?: PlayEpisode;
    autoPlay?: boolean;
    attempt?: number;
    intent?: "play" | "download";
    resume?: boolean;
  } | null;
  openPicker: (
    meta: Meta,
    episode?: PlayEpisode,
    opts?: { autoPlay?: boolean; attempt?: number; intent?: "play" | "download"; resume?: boolean },
  ) => void;
  player: PlayerSrc | null;
  openPlayer: (src: PlayerSrc) => void;
  replacePlayerSrc: (src: PlayerSrc) => void;
  pendingLiveSrc: PlayerSrc | null;
  confirmLeavePartyForLive: () => void;
  cancelLeavePartyForLive: () => void;
  addonDetailId: string | null;
  openAddonDetail: (id: string) => void;
  canGoBack: boolean;
  goBack: () => void;
  canGoForward: boolean;
  goForward: () => void;
  exitPlayback: () => void;
  exitPickerToDetail: (m: Meta) => void;
  exitPlayer: () => void;
  rememberScroll: (key: string, snap: ScrollSnapshot) => void;
  recallScroll: (key: string) => ScrollSnapshot | null;
  rememberRowScroll: (key: string, scrollLeft: number) => void;
  recallRowScroll: (key: string) => number | null;
  chromeHidden: boolean;
  setChromeHidden: (b: boolean) => void;
  setNavStack: (updater: (s: Frame[]) => Frame[]) => void;
};

const Ctx = createContext<ViewValue | null>(null);

const STACK_MAX = 30;
const SCROLL_MEM_MAX = 200;

function pushFrame(cur: Frame[], next: Frame): Frame[] {
  const out = [...cur, next];
  if (out.length <= STACK_MAX) return out;
  return [out[0], ...out.slice(out.length - STACK_MAX + 1)];
}

/** Drop trailing player/picker frames (used by exitPlayback and next-episode autoplay). */
function stripPlaybackFrames(cur: Frame[]): Frame[] {
  let i = cur.length - 1;
  while (i > 0 && (cur[i].kind === "player" || cur[i].kind === "picker")) i--;
  return cur.slice(0, i + 1);
}

function frameKey(f: Frame): string {
  switch (f.kind) {
    case "home":
      return "home";
    case "settings":
      return "settings";
    case "anime":
      return "anime";
    case "discover":
      return "discover";
    case "catalogs":
      return "catalogs";
    case "addons":
      return "addons";
    case "addon-detail":
      return `addon-detail:${f.id}`;
    case "calendar":
      return "calendar";
    case "wrapped":
      return "wrapped";
    case "queue":
      return "queue";
    case "movies":
      return "movies";
    case "shows":
      return "shows";
    case "kids":
      return "kids";
    case "library":
      return "library";
    case "live":
      return "live";
    case "vod":
      return "vod";
    case "downloads":
      return "downloads";
    case "service":
      return `service:${f.service}`;
    case "meta":
      return `meta:${f.meta.id}`;
    case "episode-detail":
      return `episode-detail:${f.seriesId}:${f.season}:${f.episode}`;
    case "person":
      return `person:${f.id}`;
    case "collection":
      return `collection:${f.id}`;
    case "collections":
      return "collections";
    case "filter":
      return `filter:${f.filter.kind}:${f.filter.mediaType}:${"name" in f.filter ? f.filter.name : f.filter.value}`;
    case "grid":
      return `grid:${f.grid.title}`;
    case "award":
      return `award:${f.awardType}`;
    case "anime-award":
      return `anime-award:${f.sourceId}`;
    case "picker": {
      const a = typeof f.attempt === "number" ? `:a${f.attempt}` : "";
      return f.episode
        ? `picker:${f.meta.id}:${f.episode.season}:${f.episode.episode}${a}`
        : `picker:${f.meta.id}${a}`;
    }
    case "player":
      return `player:${f.src.meta.id}:${f.src.url.slice(-32)}`;
    case "match-detail":
      return `match-detail:${f.game.id}`;
  }
}

function syncFrameKey(f: Frame): string {
  if (f.kind === "player") {
    const id = f.src.meta.id || `local:${f.src.url.slice(-32)}`;
    const ep = f.src.episode;
    return ep ? `player:${id}:${ep.season}:${ep.episode}` : `player:${id}`;
  }
  if (f.kind === "picker") {
    return f.episode
      ? `picker:${f.meta.id}:${f.episode.season}:${f.episode.episode}`
      : `picker:${f.meta.id}`;
  }
  return frameKey(f);
}

function lastOfKind<K extends Frame["kind"]>(
  frames: Frame[],
  kind: K,
): Extract<Frame, { kind: K }> | undefined {
  for (let i = frames.length - 1; i >= 0; i--) {
    const f = frames[i];
    if (f.kind === kind) return f as Extract<Frame, { kind: K }>;
  }
  return undefined;
}

export function ViewProvider({ children }: { children: ReactNode }) {
  const [stack, setStack] = useState<Frame[]>([{ kind: "home" }]);
  const [forwardStack, setForwardStack] = useState<Frame[]>([]);
  const stackRef = useRef(stack);
  const forwardStackRef = useRef(forwardStack);
  stackRef.current = stack;
  forwardStackRef.current = forwardStack;
  const [chromeHidden, setChromeHidden] = useState(false);
  const [homeResetTick, setHomeResetTick] = useState(0);
  const scrollMem = useRef<Map<string, ScrollSnapshot>>(new Map());
  const rowScrollMem = useRef<Map<string, number>>(new Map());
  const rememberRowScroll = useCallback((k: string, scrollLeft: number) => {
    rowScrollMem.current.set(k, scrollLeft);
  }, []);
  const recallRowScroll = useCallback((k: string): number | null => {
    const v = rowScrollMem.current.get(k);
    return typeof v === "number" ? v : null;
  }, []);
  const rememberScroll = useCallback((k: string, snap: ScrollSnapshot) => {
    const m = scrollMem.current;
    m.delete(k);
    m.set(k, snap);
    while (m.size > SCROLL_MEM_MAX) {
      const oldest = m.keys().next().value;
      if (oldest === undefined) break;
      m.delete(oldest);
    }
  }, []);
  const recallScroll = useCallback((k: string): ScrollSnapshot | null => {
    const m = scrollMem.current;
    const v = m.get(k);
    if (!v) return null;
    m.delete(k);
    m.set(k, v);
    return v;
  }, []);

  const top = stack[stack.length - 1];

  const view = rootViewFromStack(stack);
  const service = top.kind === "service" ? top.service : null;
  const metaFrame = stack
    .slice()
    .reverse()
    .find((f) => f.kind === "meta");
  const meta = metaFrame && metaFrame.kind === "meta" ? metaFrame.meta : null;
  const metaLiveContext =
    metaFrame && metaFrame.kind === "meta" ? metaFrame.liveContext === true : false;
  const metaEpisodeHint =
    metaFrame && metaFrame.kind === "meta" ? (metaFrame.episodeHint ?? null) : null;
  const metaSeasonEntryId =
    metaFrame && metaFrame.kind === "meta" ? (metaFrame.seasonEntryId ?? null) : null;
  const personFrame = lastOfKind(stack, "person");
  const personId = personFrame ? personFrame.id : null;
  const collectionFrame = lastOfKind(stack, "collection");
  const collectionId = collectionFrame ? collectionFrame.id : null;
  const episodeDetail = useMemo(
    () =>
      top.kind === "episode-detail"
        ? {
            seriesId: top.seriesId,
            season: top.season,
            episode: top.episode,
            seriesMeta: top.seriesMeta,
          }
        : null,
    [
      top.kind,
      top.kind === "episode-detail" ? top.seriesId : "",
      top.kind === "episode-detail" ? top.season : 0,
      top.kind === "episode-detail" ? top.episode : 0,
      top.kind === "episode-detail" && top.seriesMeta ? top.seriesMeta.id : "",
    ],
  );
  const filterFrame = lastOfKind(stack, "filter");
  const filter = filterFrame ? filterFrame.filter : null;
  const gridFrame = lastOfKind(stack, "grid");
  const grid = gridFrame ? gridFrame.grid : null;
  const awardType = top.kind === "award" ? top.awardType : null;
  const matchDetailGame = top.kind === "match-detail" ? top.game : null;
  const picker =
    top.kind === "picker"
      ? {
          meta: top.meta,
          episode: top.episode,
          autoPlay: top.autoPlay,
          attempt: top.attempt,
          intent: top.intent,
          resume: top.resume,
        }
      : null;
  const player = top.kind === "player" ? top.src : null;
  const canGoBack = stack.length > 1;
  const canGoForward = forwardStack.length > 0;

  const pop = useCallback(() => {
    const cur = stackRef.current;
    if (cur.length <= 1) return;
    const nextStack = cur.slice(0, -1);
    const nextForwardStack = pushFrame(forwardStackRef.current, cur[cur.length - 1]);
    stackRef.current = nextStack;
    forwardStackRef.current = nextForwardStack;
    setStack(nextStack);
    setForwardStack(nextForwardStack);
  }, []);

  const goForward = useCallback(() => {
    const curForward = forwardStackRef.current;
    const nextFrame = curForward[curForward.length - 1];
    if (!nextFrame) return;
    const nextForwardStack = curForward.slice(0, -1);
    const nextStack = pushFrame(stackRef.current, nextFrame);
    stackRef.current = nextStack;
    forwardStackRef.current = nextForwardStack;
    setStack(nextStack);
    setForwardStack(nextForwardStack);
  }, []);

  const clearForwardStack = useCallback(() => {
    if (forwardStackRef.current.length === 0) return;
    forwardStackRef.current = [];
    setForwardStack([]);
  }, []);

  const setNavStack = useCallback(
    (updater: (s: Frame[]) => Frame[]) => {
      clearForwardStack();
      setStack(updater);
    },
    [clearForwardStack],
  );

  const exitPlayback = useCallback(() => {
    setNavStack((s) => stripPlaybackFrames(s));
  }, [setNavStack]);

  const exitPickerToDetail = useCallback(
    (m: Meta) => {
      setNavStack((s) => {
        const base = stripPlaybackFrames(s);
        const top = base[base.length - 1];
        if (top && top.kind === "meta") return base;
        return [...base, { kind: "meta", meta: m }];
      });
    },
    [setNavStack],
  );

  const exitPlayer = useCallback(() => {
    setNavStack((s) => {
      let i = s.length - 1;
      while (i > 0 && s[i].kind === "player") i--;
      const next = s.slice(0, i + 1);
      const top = next[next.length - 1];
      if (top && top.kind === "picker" && top.autoPlay) {
        next[next.length - 1] = { ...top, autoPlay: false };
      }
      return next;
    });
  }, [setNavStack]);

  const [sectionReq, setSectionReq] = useState<{ section: SettingsSection | null; nonce: number }>({
    section: null,
    nonce: 0,
  });

  const setView = useCallback(
    (v: View) => {
      if (typeof window !== "undefined") {
        window.__harborProfiler?.recordNav(`view:${v}`);
      }
      if (v === "home") setHomeResetTick((n) => n + 1);
      // Always clear horizontal poster rails when changing root tabs — keep-alive
      // pages were leaving mid-scrolled rows everywhere.
      rowScrollMem.current.clear();
      if (typeof window !== "undefined" && v !== "settings") {
        window.dispatchEvent(new CustomEvent("harbor:reset-row-scrolls", { detail: {} }));
        const fireScrollTop = () =>
          window.dispatchEvent(new CustomEvent("harbor:scroll-top", { detail: { view: v } }));
        fireScrollTop();
        window.requestAnimationFrame(fireScrollTop);
        window.setTimeout(fireScrollTop, 60);
      }
      setNavStack((s) => {
        const t = s[s.length - 1];
        if (v === "home") {
          scrollMem.current.clear();
          rowScrollMem.current.clear();
          return [{ kind: "home" }];
        }
        if (v === "anime") {
          scrollMem.current.clear();
          rowScrollMem.current.clear();
          return [{ kind: "anime" }];
        }
        if (v === "discover") {
          scrollMem.current.clear();
          rowScrollMem.current.clear();
          return [{ kind: "discover" }];
        }
        if (v === "catalogs") {
          scrollMem.current.clear();
          rowScrollMem.current.clear();
          return [{ kind: "catalogs" }];
        }
        if (v === "addons") {
          scrollMem.current.clear();
          rowScrollMem.current.clear();
          return [{ kind: "addons" }];
        }
        if (v === "calendar") {
          scrollMem.current.clear();
          rowScrollMem.current.clear();
          return [{ kind: "calendar" }];
        }
        if (v === "wrapped") {
          scrollMem.current.clear();
          rowScrollMem.current.clear();
          return [{ kind: "wrapped" }];
        }
        if (v === "downloads") {
          scrollMem.current.clear();
          rowScrollMem.current.clear();
          return [{ kind: "downloads" }];
        }
        if (v === "movies") {
          scrollMem.current.clear();
          rowScrollMem.current.clear();
          return [{ kind: "movies" }];
        }
        if (v === "shows") {
          scrollMem.current.clear();
          rowScrollMem.current.clear();
          return [{ kind: "shows" }];
        }
        if (v === "kids") {
          scrollMem.current.clear();
          rowScrollMem.current.clear();
          return [{ kind: "kids" }];
        }
        if (v === "library") {
          scrollMem.current.clear();
          rowScrollMem.current.clear();
          return [{ kind: "library" }];
        }
        if (v === "live") {
          scrollMem.current.clear();
          rowScrollMem.current.clear();
          return [{ kind: "live" }];
        }
        if (v === "vod") {
          scrollMem.current.clear();
          rowScrollMem.current.clear();
          return [{ kind: "vod" }];
        }
        if (t.kind === "settings") return s;
        return pushFrame(s, { kind: "settings" });
      });
    },
    [setNavStack],
  );

  const openSettings = useCallback(
    (section?: SettingsSection) => {
      setSectionReq((r) => ({ section: section ?? null, nonce: r.nonce + 1 }));
      setNavStack((s) => {
        const t = s[s.length - 1];
        if (t.kind === "settings") return s;
        return pushFrame(s, { kind: "settings" });
      });
    },
    [setNavStack],
  );

  const openService = useCallback(
    (s: StreamingService | null) => {
      if (s === null) {
        setNavStack((cur) => {
          scrollMem.current.clear();
          rowScrollMem.current.clear();
          return cur.length === 1 && cur[0].kind === "home" ? cur : [{ kind: "home" }];
        });
        return;
      }
      setNavStack((cur) => {
        const t = cur[cur.length - 1];
        if (t.kind === "service" && t.service === s) return cur;
        return pushFrame(cur, { kind: "service", service: s });
      });
    },
    [setNavStack],
  );

  const promoteMetaToRoot = useCallback(() => {
    setNavStack((s) => {
      if (s.length === 0) return s;
      const top = s[s.length - 1];
      if (top.kind !== "meta") return s;
      const m = top.meta;
      let root: Frame;
      if (m.type === "series" || m.type === "tv") root = { kind: "shows" };
      else if (m.type === "anime") root = { kind: "anime" };
      else root = { kind: "movies" };
      return [root, { kind: "meta", meta: m }];
    });
  }, [setNavStack]);

  const openMeta = useCallback(
    (
      m: Meta | null,
      opts?: {
        liveContext?: boolean;
        episodeHint?: { season: number; episode: number };
        seasonEntryId?: string;
        exact?: boolean;
      },
    ) => {
      if (m === null) {
        setNavStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
        return;
      }
      const push = (target: Meta, seasonEntryId?: string) => {
        setNavStack((cur) => {
          const t = cur[cur.length - 1];
          if (t.kind === "meta" && t.meta.id === target.id) return cur;
          trackEvent(target.id, "open", profileFromMeta(target));
          return pushFrame(cur, {
            kind: "meta",
            meta: target,
            liveContext: opts?.liveContext,
            episodeHint: opts?.episodeHint,
            seasonEntryId: seasonEntryId ?? opts?.seasonEntryId,
          });
        });
      };
      if (!isAnimeMetaId(m.id) || opts?.exact) {
        push(m);
        return;
      }
      const warm = franchiseRootSync(m.id);
      if (warm != null) {
        if (warm === m.id) push(m);
        else push({ ...m, id: warm }, m.id);
        return;
      }
      void franchiseRoot(m.id)
        .then((root) => (root === m.id ? push(m) : push({ ...m, id: root }, m.id)))
        .catch(() => push(m));
    },
    [setNavStack],
  );

  const openPerson = useCallback(
    (id: number | null) => {
      if (id === null) {
        setNavStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
        return;
      }
      setNavStack((cur) => {
        const t = cur[cur.length - 1];
        if (t.kind === "person" && t.id === id) return cur;
        return pushFrame(cur, { kind: "person", id });
      });
    },
    [setNavStack],
  );

  const openQueue = useCallback(() => {
    setNavStack((cur) => {
      const t = cur[cur.length - 1];
      if (t.kind === "queue") return cur;
      return pushFrame(cur, { kind: "queue" });
    });
  }, [setNavStack]);

  const openCollection = useCallback(
    (id: number) => {
      setNavStack((cur) => {
        const t = cur[cur.length - 1];
        if (t.kind === "collection" && t.id === id) return cur;
        return pushFrame(cur, { kind: "collection", id });
      });
    },
    [setNavStack],
  );

  const openMatchDetail = useCallback(
    (game: SportsGame) => {
      setNavStack((cur) => {
        const t = cur[cur.length - 1];
        if (t.kind === "match-detail" && t.game.id === game.id) return cur;
        return pushFrame(cur, { kind: "match-detail", game });
      });
    },
    [setNavStack],
  );

  const openEpisodeDetail = useCallback(
    (seriesId: string, season: number, episode: number, seriesMeta?: Meta) => {
      setNavStack((cur) => {
        const t = cur[cur.length - 1];
        if (
          t.kind === "episode-detail" &&
          t.seriesId === seriesId &&
          t.season === season &&
          t.episode === episode
        ) {
          return cur;
        }
        return pushFrame(cur, { kind: "episode-detail", seriesId, season, episode, seriesMeta });
      });
    },
    [setNavStack],
  );

  const openAward = useCallback(
    (t: import("./providers/wikidata").AwardType) => {
      setNavStack((cur) => {
        const top = cur[cur.length - 1];
        if (top.kind === "award" && top.awardType === t) return cur;
        return pushFrame(cur, { kind: "award", awardType: t });
      });
    },
    [setNavStack],
  );

  const openAnimeAward = useCallback(
    (s: import("./anime-awards").AwardSourceId) => {
      setNavStack((cur) => {
        const top = cur[cur.length - 1];
        if (top.kind === "anime-award" && top.sourceId === s) return cur;
        return pushFrame(cur, { kind: "anime-award", sourceId: s });
      });
    },
    [setNavStack],
  );

  const openFilter = useCallback(
    (f: MetaFilter) => {
      setNavStack((cur) => {
        const t = cur[cur.length - 1];
        if (
          t.kind === "filter" &&
          t.filter.kind === f.kind &&
          t.filter.mediaType === f.mediaType &&
          ("name" in f && "name" in t.filter
            ? t.filter.name === f.name
            : (t.filter as any).value === (f as any).value)
        ) {
          return cur;
        }
        return pushFrame(cur, { kind: "filter", filter: f });
      });
    },
    [setNavStack],
  );

  const openGrid = useCallback(
    (g: GridSpec) => {
      setNavStack((cur) => {
        const t = cur[cur.length - 1];
        if (t.kind === "grid" && t.grid.title === g.title) return cur;
        return pushFrame(cur, { kind: "grid", grid: g });
      });
    },
    [setNavStack],
  );

  const openCollections = useCallback(() => {
    setNavStack((cur) => {
      const t = cur[cur.length - 1];
      if (t.kind === "collections") return cur;
      return pushFrame(cur, { kind: "collections" });
    });
  }, [setNavStack]);

  const openPicker = useCallback(
    (
      m: Meta,
      ep?: PlayEpisode,
      opts?: {
        autoPlay?: boolean;
        attempt?: number;
        intent?: "play" | "download";
        resume?: boolean;
      },
    ) => {
      if (opts?.autoPlay) {
        beginMarathonAdvance();
        armRemoteStickyHop();
      }
      setNavStack((cur) => {
        const t = cur[cur.length - 1];
        if (
          t.kind === "picker" &&
          t.meta.id === m.id &&
          (t.attempt ?? 0) === (opts?.attempt ?? 0) &&
          (t.intent ?? "play") === (opts?.intent ?? "play")
        ) {
          return cur;
        }
        // Next-episode / autoplay replaces in-flight player+picker frames so the
        // stack doesn't nest prior episodes under the new load.
        const base = opts?.autoPlay ? stripPlaybackFrames(cur) : cur;
        return pushFrame(base, {
          kind: "picker",
          meta: m,
          episode: ep,
          autoPlay: opts?.autoPlay,
          attempt: opts?.attempt,
          intent: opts?.intent,
          resume: opts?.resume,
        });
      });
    },
    [setNavStack],
  );

  const together = useTogether();
  const togetherRef = useRef(together);
  togetherRef.current = together;
  const [pendingLiveSrc, setPendingLiveSrc] = useState<PlayerSrc | null>(null);
  const pendingLiveSrcRef = useRef<PlayerSrc | null>(null);
  pendingLiveSrcRef.current = pendingLiveSrc;

  const openPlayer = useCallback(
    (src: PlayerSrc) => {
      if (src.meta.id?.startsWith("iptv:") && togetherRef.current.snapshot.state === "joined") {
        setPendingLiveSrc(src);
        return;
      }
      setNavStack((cur) => pushFrame(cur, { kind: "player", src }));
    },
    [setNavStack],
  );

  const confirmLeavePartyForLive = useCallback(() => {
    const src = pendingLiveSrcRef.current;
    setPendingLiveSrc(null);
    if (!src) return;
    togetherRef.current.leaveSession();
    setNavStack((cur) => pushFrame(cur, { kind: "player", src }));
  }, [setNavStack]);

  const cancelLeavePartyForLive = useCallback(() => setPendingLiveSrc(null), []);

  const replacePlayerSrc = useCallback(
    (src: PlayerSrc) => {
      setNavStack((cur) => {
        const top = cur[cur.length - 1];
        if (top.kind !== "player") return cur;
        return [...cur.slice(0, -1), { kind: "player", src }];
      });
    },
    [setNavStack],
  );

  const openAddonDetail = useCallback(
    (id: string) => {
      setNavStack((cur) => {
        const top = cur[cur.length - 1];
        if (top.kind === "addon-detail" && top.id === id) return cur;
        if (top.kind === "addon-detail") return [...cur.slice(0, -1), { kind: "addon-detail", id }];
        return pushFrame(cur, { kind: "addon-detail", id });
      });
    },
    [setNavStack],
  );

  const addonDetailId = top.kind === "addon-detail" ? top.id : null;

  const topPath = useMemo(() => syncFrameKey(top), [top]);

  const stackKinds = useMemo(() => stack.map((f) => f.kind), [stack]);

  const value = useMemo(
    () => ({
      view,
      setView,
      openSettings,
      settingsSectionRequest: sectionReq,
      topKind: top.kind,
      topPath,
      service,
      openService,
      meta,
      metaLiveContext,
      metaEpisodeHint,
      metaSeasonEntryId,
      openMeta,
      promoteMetaToRoot,
      personId,
      openPerson,
      collectionId,
      openCollection,
      episodeDetail,
      openEpisodeDetail,
      matchDetailGame,
      openMatchDetail,
      openQueue,
      filter,
      openFilter,
      grid,
      openGrid,
      openCollections,
      stackKinds,
      awardType,
      openAward,
      animeAwardSource: top.kind === "anime-award" ? top.sourceId : null,
      openAnimeAward,
      homeResetTick,
      picker,
      openPicker,
      player,
      openPlayer,
      replacePlayerSrc,
      pendingLiveSrc,
      confirmLeavePartyForLive,
      cancelLeavePartyForLive,
      addonDetailId,
      openAddonDetail,
      canGoBack,
      goBack: pop,
      canGoForward,
      goForward,
      exitPlayback,
      exitPickerToDetail,
      exitPlayer,
      rememberScroll,
      recallScroll,
      rememberRowScroll,
      recallRowScroll,
      chromeHidden,
      setChromeHidden,
      setNavStack,
    }),
    [
      view,
      top.kind,
      topPath,
      service,
      meta,
      metaLiveContext,
      metaEpisodeHint,
      metaSeasonEntryId,
      promoteMetaToRoot,
      personId,
      collectionId,
      openCollection,
      episodeDetail,
      openEpisodeDetail,
      matchDetailGame,
      openMatchDetail,
      filter,
      stackKinds,
      awardType,
      homeResetTick,
      picker,
      player,
      canGoBack,
      canGoForward,
      setView,
      openSettings,
      sectionReq,
      openService,
      openMeta,
      openPerson,
      openQueue,
      openFilter,
      grid,
      openGrid,
      openCollections,
      openAward,
      openAnimeAward,
      openPicker,
      openPlayer,
      replacePlayerSrc,
      pendingLiveSrc,
      confirmLeavePartyForLive,
      cancelLeavePartyForLive,
      pop,
      goForward,
      exitPlayback,
      exitPickerToDetail,
      exitPlayer,
      rememberScroll,
      recallScroll,
      chromeHidden,
      setNavStack,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useView() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useView outside ViewProvider");
  return v;
}

function anchorOffsetIn(scrollEl: HTMLElement, anchor: HTMLElement): number {
  return (
    anchor.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top + scrollEl.scrollTop
  );
}

function pickAnchor(el: HTMLElement, scrollTop: number): { key: string; delta: number } | null {
  const anchors = el.querySelectorAll<HTMLElement>("[data-scroll-anchor]");
  if (anchors.length === 0) return null;
  let best: { key: string; offset: number } | null = null;
  for (const a of anchors) {
    const k = a.dataset.scrollAnchor;
    if (!k) continue;
    const off = anchorOffsetIn(el, a);
    if (off > scrollTop + 1) continue;
    if (!best || off > best.offset) best = { key: k, offset: off };
  }
  if (!best) {
    const first = anchors[0];
    const k = first.dataset.scrollAnchor;
    if (!k) return null;
    return { key: k, delta: scrollTop - anchorOffsetIn(el, first) };
  }
  return { key: best.key, delta: scrollTop - best.offset };
}

function targetForSnap(el: HTMLElement, snap: ScrollSnapshot): number | null {
  if (snap.anchor) {
    const sel = `[data-scroll-anchor="${CSS.escape(snap.anchor)}"]`;
    const anchorEl = el.querySelector<HTMLElement>(sel);
    if (anchorEl) return Math.max(0, anchorOffsetIn(el, anchorEl) + snap.delta);
  }
  return snap.fallback >= 0 ? snap.fallback : null;
}

export function useScrollMemory(
  key: string,
  ref: RefObject<HTMLElement | null>,
  active: boolean = true,
) {
  const { rememberScroll, recallScroll } = useView();

  useEffect(() => {
    const onReset = (e: Event) => {
      const detail = (e as CustomEvent<{ view?: string }>).detail;
      if (!detail?.view) return;
      if (detail.view !== key) return;
      const el = ref.current;
      if (!el) return;
      el.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };
    window.addEventListener("harbor:scroll-top", onReset);
    return () => window.removeEventListener("harbor:scroll-top", onReset);
  }, [key, ref]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !active) return;

    let restoring = true;
    let settleId: number | null = null;
    let saveTimer: number | null = null;

    const cancelSettle = () => {
      if (settleId !== null) {
        clearTimeout(settleId);
        settleId = null;
      }
    };

    const tryRestore = () => {
      if (!restoring) return;
      const snap = recallScroll(key);
      if (!snap) {
        restoring = false;
        cancelSettle();
        return;
      }
      if (el.clientHeight === 0) return;
      const target = targetForSnap(el, snap);
      if (target === null) {
        restoring = false;
        cancelSettle();
        return;
      }
      const max = el.scrollHeight - el.clientHeight;
      if (max < target - 4) return;
      el.scrollTop = Math.min(target, max);
      restoring = false;
      cancelSettle();
    };

    settleId = window.setTimeout(() => {
      restoring = false;
      settleId = null;
    }, 30000);

    tryRestore();

    const ro = new ResizeObserver(tryRestore);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);

    const saveNow = () => {
      if (el.clientHeight === 0) return;
      const top = el.scrollTop;
      const found = pickAnchor(el, top);
      rememberScroll(key, {
        anchor: found?.key,
        delta: found?.delta ?? 0,
        fallback: top,
      });
    };

    const cancelSave = () => {
      if (saveTimer !== null) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
    };

    const onScroll = () => {
      if (restoring) return;
      if (el.clientHeight === 0) return;
      cancelSave();
      saveTimer = window.setTimeout(() => {
        saveTimer = null;
        saveNow();
      }, 200);
    };
    el.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      cancelSave();
      cancelSettle();
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      if (!restoring && el.clientHeight > 0 && el.scrollTop > 0) saveNow();
    };
  }, [active, key, ref, rememberScroll, recallScroll]);
}

export { frameKey };
