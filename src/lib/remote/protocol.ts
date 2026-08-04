export const REMOTE_PROTO = 1;
export const REMOTE_WS_PATH = "/api/remote";
export const WEB_PORT = 11471;

export type RemoteEpisodeRef = {
  season: number;
  episode: number;
  name?: string;
};

export type RemoteCastDevice = {
  id: string;
  name: string;
  kind: "chromecast" | "dlna" | "roku" | "airplay";
  host: string;
  port: number;
  model?: string | null;
  controlUrl?: string | null;
  audioOnly?: boolean;
};

export type RemoteTarget =
  | { kind: "local"; label: string }
  | { kind: "cast"; deviceId: string; label: string; castKind: RemoteCastDevice["kind"] };

export type RemoteSourceInfo = {
  label: string | null;
  resolution: string | null;
  quality: string | null;
  releaseGroup: string | null;
};

/** Host has a text field ready for phone typing. */
export type RemoteTextEntry = {
  value: string;
  placeholder: string;
};

export type RemoteProfile = {
  id?: string;
  name: string;
  avatar: string | null;
  color: string;
};

export type RemoteLibraryItem = {
  id: string;
  type: string;
  name?: string;
  poster?: string;
  background?: string;
};

export type RemoteLibrary = {
  watchlist: RemoteLibraryItem[];
  history: RemoteLibraryItem[];
  favorites: RemoteLibraryItem[];
};

export type RemoteTrackers = {
  trakt: boolean;
  simkl: boolean;
  stremio: boolean;
  anilist: boolean;
  mal: boolean;
};

export type SimklWatchStatus = "watching" | "plantowatch" | "hold" | "completed" | "dropped";
export type AnilistWatchStatus =
  | "CURRENT"
  | "PLANNING"
  | "COMPLETED"
  | "REPEATING"
  | "PAUSED"
  | "DROPPED";
export type MalWatchStatus = "watching" | "plan_to_watch" | "completed" | "on_hold" | "dropped";

export type RemoteLibraryAction =
  | { kind: "watchlist"; on: boolean }
  | { kind: "watched"; on: boolean }
  | { kind: "favorite"; on: boolean }
  | { kind: "simkl"; status: SimklWatchStatus | null }
  | { kind: "anilist"; status: AnilistWatchStatus | null }
  | { kind: "mal"; status: MalWatchStatus | null };

export type RemoteMangaChapter = {
  id: string;
  index: number;
  label: string;
  chapter: string | null;
  title?: string;
  group?: string;
  sourceId?: string;
  sourceName?: string;
  downloaded?: boolean;
};

export type RemoteMangaBookmark = {
  id: string;
  chapterId: string;
  chapterLabel: string;
  page: number;
  totalPages: number;
  name: string;
  createdAt: number;
};

export type RemoteMangaState = {
  open: boolean;
  seq: number;
  mangaId: string;
  title: string;
  cover: string | null;
  chapterId: string;
  chapterIndex: number;
  chapterLabel: string;
  pageIndex: number;
  pageCount: number;
  spread?: number[];
  pageUrls?: string[];
  zoom: number;
  canZoom: boolean;
  rtl: boolean;
  mode: "long" | "paged" | "double" | "book";
  hasPrev: boolean;
  hasNext: boolean;
  chapters: RemoteMangaChapter[];
  bookmarks: RemoteMangaBookmark[];
};

export type RemoteSnapshot = {
  proto: number;
  idle: boolean;
  mediaId: string | null;
  mediaTitle: string | null;
  posterUrl: string | null;
  episode: RemoteEpisodeRef | null;
  source: RemoteSourceInfo | null;
  positionSec: number;
  durationSec: number;
  playing: boolean;
  volume: number;
  muted: boolean;
  target: RemoteTarget;
  castDevices: RemoteCastDevice[];
  castDiscovering: boolean;
  hasPrevEpisode: boolean;
  hasNextEpisode: boolean;
  /** True when a subtitle track is selected on the local player. */
  subtitlesOn: boolean;
  /** Local player has ≥1 subtitle track and isn't casting. */
  canToggleSubtitles: boolean;
  /** Non-null when the host focus is in a text field. */
  textEntry: RemoteTextEntry | null;
  /** Active profile identity on the host (name/avatar/color). */
  profile: RemoteProfile | null;
  /** All profiles on the host, for the phone's who's-watching switcher. */
  profiles: RemoteProfile[];
  /** Host metadata keys piped to a keyless phone so it can browse (tmdb, rpdb). */
  tmdbKey?: string;
  rpdbKey?: string;
  tvdbKey?: string;
  hostVersion?: string;
  library?: RemoteLibrary;
  trackers?: RemoteTrackers;
  manga?: RemoteMangaState | null;
  updatedAt: number;
};

/** Host UI navigation (library browse via phone touchpad). */
export type RemoteNavKey = "up" | "down" | "left" | "right" | "select" | "back";

export type RemoteCommand =
  | { action: "play" }
  | { action: "pause" }
  | { action: "seek"; positionSec: number }
  | { action: "setVolume"; volume: number }
  | { action: "setMuted"; muted: boolean }
  | { action: "setTarget"; target: "local" | { castDeviceId: string } }
  | { action: "castDiscover" }
  | { action: "castStop" }
  | { action: "prevEpisode" }
  | { action: "nextEpisode" }
  /** Toggle subtitles on/off. Local player only. */
  | { action: "toggleSubtitles" }
  /** Drive host keyboard/TV focus navigation (swipe/tap on touchpad / now-playing poster). */
  | { action: "nav"; key: RemoteNavKey }
  /** Replace value of the focused host text field. */
  | { action: "setText"; value: string }
  /** Submit the focused host text field (Enter). Optional value flushes text first. */
  | { action: "submitText"; value?: string }
  /** Blur the focused host text field (phone dismissed the typing UI). */
  | { action: "blurText" }
  /** Open host search (same as the "/" hotkey). */
  | { action: "openSearch" }
  /** Tell the host to open a title's detail page. */
  | { action: "openMeta"; metaId: string; metaType: string; name?: string; poster?: string }
  /** Tell the host to open a streaming service catalog. */
  | { action: "openService"; service: string }
  /** Tell the host to jump to a root view (home, discover, etc.). */
  | { action: "goView"; view: string }
  /** Set the host player's playback speed. */
  | { action: "setSpeed"; speed: number }
  /** Set (or clear) the host sleep timer, in minutes. 0 clears it. */
  | { action: "setSleep"; minutes: number }
  /** Switch the host's active profile (phone who's-watching). */
  | { action: "setProfile"; id: string }
  /** Tell the host to play a title (opens the picker / auto-plays on the host). */
  | {
      action: "playMeta";
      metaId: string;
      metaType: string;
      name?: string;
      poster?: string;
      season?: number;
      episode?: number;
      resume?: boolean;
    }
  | {
      action: "libraryAction";
      metaId: string;
      metaType: string;
      name?: string;
      poster?: string;
      imdbId?: string | null;
      op: RemoteLibraryAction;
    }
  | { action: "mangaTurnPage"; dir: "next" | "prev" }
  | { action: "mangaSetPage"; page: number }
  | { action: "mangaJumpChapter"; index: number }
  | { action: "mangaZoomIn" }
  | { action: "mangaZoomOut" }
  | { action: "mangaSetZoom"; zoom: number }
  | { action: "mangaPan"; dx: number; dy: number }
  | { action: "mangaFlipProgress"; p: number }
  | { action: "mangaFlipEnd"; commit: boolean; dir: "next" | "prev" }
  | { action: "mangaSetRtl"; rtl: boolean }
  | { action: "mangaBookmark"; page?: number }
  | { action: "mangaJumpBookmark"; id: string }
  | { action: "mangaBookmarkRemove"; id: string }
  | { action: "mangaCloseReader" }
  | { action: "ping" };

export type RemoteServerMessage =
  | { t: "snapshot"; snapshot: RemoteSnapshot }
  | { t: "hello"; proto: number; server: "harbor-remote" }
  | { t: "pong"; at: number }
  | { t: "error"; message: string };

export type RemoteClientMessage =
  | { t: "cmd"; command: RemoteCommand }
  | { t: "hello"; client: "harbor-remote"; proto: number };

export function idleSnapshot(partial?: Partial<RemoteSnapshot>): RemoteSnapshot {
  return {
    proto: REMOTE_PROTO,
    idle: true,
    mediaId: null,
    mediaTitle: null,
    posterUrl: null,
    episode: null,
    source: null,
    positionSec: 0,
    durationSec: 0,
    playing: false,
    volume: 1,
    muted: false,
    target: { kind: "local", label: "This PC" },
    castDevices: [],
    castDiscovering: false,
    hasPrevEpisode: false,
    hasNextEpisode: false,
    subtitlesOn: false,
    canToggleSubtitles: false,
    textEntry: null,
    profile: null,
    profiles: [],
    updatedAt: Date.now(),
    ...partial,
  };
}

export function parseClientMessage(raw: string): RemoteClientMessage | null {
  try {
    const parsed = JSON.parse(raw) as RemoteClientMessage;
    if (!parsed || typeof parsed !== "object" || !("t" in parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function remoteWsUrl(host: string, port = WEB_PORT): string {
  const proto = typeof location !== "undefined" && location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${host}:${port}${REMOTE_WS_PATH}`;
}

export function remoteUiUrl(host: string, port = WEB_PORT): string {
  return `http://${host}:${port}/remote`;
}

export function mangaRemoteUiUrl(host: string, port = WEB_PORT): string {
  return `http://${host}:${port}/reader`;
}
