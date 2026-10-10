export type MediaServerProvider = "jellyfin" | "emby" | "plex";
export type MediaServerQuality =
  | "original"
  | "4k-40"
  | "1080p-20"
  | "1080p-12"
  | "720p-4"
  | "480p-2"
  | "360p-0.7";
export type MediaKind = "movie" | "series" | "season" | "episode";

export type MediaIdentity = {
  tmdbId?: number;
  imdbId?: string;
  tvdbId?: number;
  season?: number;
  episode?: number;
  episodeEnd?: number;
};

export type MediaServerConnection = {
  id: string;
  profileId: string;
  provider: MediaServerProvider;
  name: string;
  origin: string;
  userId: string;
  enabled: boolean;
  readProgress: boolean;
  writeProgress: boolean;
  fanOut: boolean;
  includeContinueWatching: boolean;
  directPlay: boolean;
  transcodeFallback: boolean;
  remoteBitrateKbps?: number;
  preferredQuality: MediaServerQuality;
  priority: number;
  createdAt: number;
  refreshInterval: MediaServerRefreshInterval;
  refreshEveryDays?: number;
  lastSyncAt?: number;
  lastSyncResult?: { ok: boolean; message: string; at: number };
  enabledLibraryIds?: string[];
};

export type MediaServerRefreshInterval =
  | "launch"
  | "daily"
  | "three-days"
  | "weekly"
  | "custom"
  | "manual";

export type MediaServerLibrary = {
  id: string;
  connectionId: string;
  name: string;
  kind: MediaKind | "mixed";
  enabled: boolean;
};

export type MediaServerVersion = {
  id: string;
  name?: string;
  filename?: string;
  season?: number;
  episode?: number;
  episodeEnd?: number;
  container?: string;
  videoCodec?: string;
  audioCodec?: string;
  resolution?: string;
  width?: number;
  height?: number;
  videoProfile?: string;
  hdr?: string;
  dolbyVisionProfile?: string;
  audioProfile?: string;
  atmos?: boolean;
  channels?: number;
  bitrateKbps?: number;
  sizeBytes?: number;
  edition?: string;
  runtimeMs?: number;
  directPlayable: boolean;
  subtitles?: MediaServerSubtitle[];
};

export type MediaServerSubtitle = {
  id: string;
  language?: string;
  title?: string;
  url?: string;
  index?: number;
  codec?: string;
};

export type MediaServerSyncSummary = {
  connectionId: string;
  at: number;
  movies: number;
  shows: number;
  episodes: number;
  versions: number;
  duplicates: number;
  unmatchedTitles: number;
  removedItems: number;
};

export type MediaServerTitle = {
  key: string;
  kind: "movie" | "series";
  identity: MediaIdentity;
  fallbackTitle: string;
  year?: number;
  itemKeys: string[];
  connectionIds: string[];
  libraryIds: string[];
  episodeCount: number;
  versionCount: number;
  addedAt?: number;
  progress?: MediaServerProgress;
};

export type PlayableCopy = {
  key: string;
  category: "device" | "home-server";
  label: string;
  sourceLabel: string;
  version: MediaServerVersion;
  progress?: MediaServerProgress;
  connectionId?: string;
  itemId?: string;
};

export type MediaServerProgress = {
  positionMs: number;
  durationMs?: number;
  played: boolean;
  updatedAt: number;
};

export type MediaServerItem = {
  id: string;
  connectionId: string;
  libraryId: string;
  libraryName?: string;
  parentId?: string;
  kind: MediaKind;
  title: string;
  year?: number;
  identity: MediaIdentity;
  versions: MediaServerVersion[];
  progress?: MediaServerProgress;
  addedAt?: number;
  updatedAt: number;
};

export type MediaServerPlayback = {
  url: string;
  protocol: "file" | "http" | "hls";
  direct: boolean;
  versionId: string;
  headers?: Record<string, string>;
  subtitles?: Array<{ id: string; url: string; language?: string; title?: string }>;
  effectiveQuality: MediaServerQuality;
  playbackSessionId?: string;
  decision: "direct-play" | "transcode";
  transcodeReason?: string;
};

export type MediaServerPlaybackRequest = {
  versionId?: string;
  quality: MediaServerQuality;
  startPositionMs?: number;
  playbackSessionId?: string;
};

export type SyncPage = {
  items: MediaServerItem[];
  cursor?: string;
  deletedIds?: string[];
  processed?: number;
  total?: number;
};
export type AuthResult = { userId: string; userName: string; token: string };

export interface MediaServerAdapter {
  readonly provider: MediaServerProvider;
  authenticate(input: Record<string, string>): Promise<AuthResult>;
  libraries(connection: MediaServerConnection): Promise<MediaServerLibrary[]>;
  synchronize(
    connection: MediaServerConnection,
    library: MediaServerLibrary,
    cursor?: string,
  ): Promise<SyncPage>;
  lookup(connection: MediaServerConnection, identity: MediaIdentity): Promise<MediaServerItem[]>;
  playback(
    connection: MediaServerConnection,
    item: MediaServerItem,
    request: MediaServerPlaybackRequest,
  ): Promise<MediaServerPlayback>;
  stopPlayback?(
    connection: MediaServerConnection,
    item: MediaServerItem,
    playbackSessionId: string,
    positionMs?: number,
  ): Promise<void>;
  reportProgress(
    connection: MediaServerConnection,
    item: MediaServerItem,
    progress: MediaServerProgress,
  ): Promise<void>;
  setWatched(
    connection: MediaServerConnection,
    item: MediaServerItem,
    watched: boolean,
  ): Promise<void>;
}
