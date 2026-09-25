export type StreamPluginFormat = "harbor" | "provider-script" | "android-extension";

export type NativeExtensionRef = {
  extensionId: string;
  providerIds: string[];
  file: string;
};

export type StreamRepoEntry = {
  id: string;
  name: string;
  version: string;
  entry: string;
  sha256?: string;
  icon?: string;
  description?: string;
  author?: string;
  lang: string[];
  types: string[];
  idPrefixes: string[];
  hosts: string[];
  settings: boolean;
  nsfw: boolean;
  enabled: boolean;
  platforms?: string[];
  minHarbor?: string;
  timeoutMs?: number;
  format: StreamPluginFormat;
  note?: string;
};

export type StreamRepoRecord = {
  url: string;
  name: string;
  homepage?: string;
  format: StreamPluginFormat;
  entries: StreamRepoEntry[];
  checkedAt: number;
  error?: string | null;
};

export type PluginPrevious = {
  version: string;
  code: string;
  hash: string;
  etag?: string;
};

export type InstalledStreamPlugin = {
  id: string;
  entryId: string;
  repoUrl: string;
  repoName: string;
  name: string;
  version: string;
  format: StreamPluginFormat;
  code: string;
  hash: string;
  etag?: string;
  native: NativeExtensionRef | null;
  icon?: string;
  description?: string;
  author?: string;
  lang: string[];
  types: string[];
  idPrefixes: string[];
  hosts: string[];
  learnedHosts: string[];
  limitHosts: boolean;
  settings: boolean;
  nsfw: boolean;
  enabled: boolean;
  repoDisabled: boolean;
  verified: boolean;
  incompatible: string | null;
  installedAt: number;
  updatedAt: number;
  timeoutMs?: number;
  previous: PluginPrevious | null;
  settingsValues: Record<string, string | boolean>;
  secretKeys: string[];
  autoPaused: boolean;
  failures: number;
  listed: boolean;
  filesChanged: boolean;
  updateVersion: string | null;
};

export type StreamPluginSettingsField =
  | { type: "header"; label: string }
  | { type: "info"; label: string }
  | {
      type: "text";
      key: string;
      label: string;
      placeholder?: string;
      description?: string;
      isPassword?: boolean;
      defaultValue?: string;
    }
  | {
      type: "select";
      key: string;
      label: string;
      options: Array<{ label: string; value: string }>;
      defaultValue?: string;
      description?: string;
    }
  | { type: "toggle"; key: string; label: string; defaultValue?: boolean; description?: string };

export type StreamRequestContext = {
  imdbId: string | null;
  title: string;
  year: number | null;
  season: number | null;
  episode: number | null;
  absoluteEpisode: number | null;
};

export type StreamPluginRequest = {
  type: "movie" | "series";
  id: string;
  ids: string[];
  imdbId: string | null;
  tmdb: { id: number; kind: "movie" | "tv" } | null;
  title: string;
  year: number | null;
  season: number | null;
  episode: number | null;
  absoluteEpisode: number | null;
  settings: Record<string, string | boolean>;
};

export type PluginStream = {
  url?: string;
  infoHash?: string;
  fileIdx?: number;
  sources?: string[];
  externalUrl?: string;
  ytId?: string;
  name?: string;
  title?: string;
  description?: string;
  filename?: string;
  size?: number | string;
  seeders?: number;
  quality?: string;
  language?: string | string[];
  provider?: string;
  headers?: Record<string, string>;
  subtitles?: Array<{ url: string; lang?: string; language?: string; id?: string }>;
  bingeGroup?: string;
  expiresAt?: number;
};

export type PluginHealth = {
  lastAt: number | null;
  lastMs: number | null;
  lastCount: number | null;
  lastError: string | null;
  lastSkip: string | null;
  lastTitle: string | null;
  seenHosts: string[];
};

export type PluginLogLine = { at: number; level: string; text: string };

export type PluginCheckResult = {
  count: number;
  ms: number;
  requests: number;
  error: string | null;
};

export class PluginError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "PluginError";
    this.code = code;
  }
}

export function pluginErrorCode(e: unknown): string {
  return e instanceof PluginError ? e.code : "";
}
