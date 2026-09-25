import type {
  PluginHealth,
  PluginLogLine,
  StreamPluginSettingsField,
} from "@/lib/streams/plugins/types";

export type PluginKind = "stream" | "manga" | "ebook";

export type PluginState =
  | "ok"
  | "off"
  | "update"
  | "error"
  | "auto-paused"
  | "incompatible"
  | "repo-disabled"
  | "files-changed"
  | "unlisted"
  | "hidden-adult";

export type EntryView = {
  id: string;
  name: string;
  version: string;
  description?: string;
  lang: string[];
  nsfw: boolean;
  icon?: string;
  format: string;
  installed: boolean;
  installedId: string | null;
  installedVersion: string | null;
  updateAvailable: boolean;
  repoDisabled: boolean;
  note?: string;
};

export type RepoView = {
  kind: PluginKind;
  url: string;
  name: string;
  host: string;
  format: string;
  homepage?: string;
  entries: EntryView[];
  installedCount: number;
  updates: number;
  checkedAt: number | null;
  error: string | null;
  loading: boolean;
  foreign: "tachiyomi" | "paperback" | "unknown" | null;
};

export type PluginView = {
  kind: PluginKind;
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  lang: string[];
  types: string[];
  nsfw: boolean;
  icon?: string;
  repoUrl: string;
  repoName: string;
  format: string;
  enabled: boolean;
  hasSettings: boolean;
  state: PluginState;
  error: string | null;
  updateVersion: string | null;
  canRevert: boolean;
  previousVersion: string | null;
  hosts: string[];
  learnedHosts: string[];
  verified: boolean;
  installedAt: number | null;
  checkable: boolean;
};

export type CheckResult = { count: number; ms: number; requests: number; error: string | null };
export type SettingsField = StreamPluginSettingsField;
export type HealthView = PluginHealth;
export type LogLine = PluginLogLine;

export type KindAdapter = {
  kind: PluginKind;
  label: string;
  load: () => Promise<void>;
  subscribe: (cb: () => void) => () => void;
  repos: () => RepoView[];
  plugins: () => PluginView[];
  addRepo: (url: string) => Promise<RepoView>;
  refreshRepo: (url: string) => Promise<void>;
  removeRepo: (url: string) => Promise<void>;
  install: (repoUrl: string, entryId: string) => Promise<void>;
  installAll?: (
    repoUrl: string,
    onProgress?: (done: number, total: number) => void,
  ) => Promise<{ installed: number; failed: number }>;
  uninstall: (id: string) => Promise<void>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
  update?: (id: string) => Promise<void>;
  revert?: (id: string) => Promise<void>;
  settingsFields?: (id: string) => Promise<SettingsField[]>;
  settingsValues?: (id: string) => Record<string, string | boolean>;
  saveSettings?: (
    id: string,
    values: Record<string, string | boolean>,
    fields: SettingsField[],
  ) => Promise<void>;
  /** [timeoutMs] lets a caller give the check the same budget playback gets, so that what it
   * answers is what pressing Play would do rather than a ceiling of the check's own. */
  check?: (id: string, timeoutMs?: number) => Promise<CheckResult>;
  health?: (id: string) => HealthView | null;
  log?: (id: string) => LogLine[];
};

export function repoHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
