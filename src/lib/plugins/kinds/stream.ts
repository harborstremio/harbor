import { adultContentHidden } from "@/lib/addons-store/adult-filter";
import {
  addStreamRepo,
  checkStreamPlugin,
  installEntry,
  installedStreamPluginsSync,
  loadStreamPlugins,
  pluginHealth,
  pluginLog,
  refreshStreamRepo,
  removeStreamRepo,
  revertPlugin,
  saveStreamPluginSettings,
  setStreamPluginEnabled,
  settingsValuesFor,
  streamPluginById,
  streamPluginSettingsFields,
  streamRepoByUrl,
  streamReposSync,
  subscribeStreamPlugins,
  uninstallStreamPlugin,
  type InstalledStreamPlugin,
  type StreamRepoRecord,
} from "@/lib/streams/plugins";
import { pluginIdFor } from "@/lib/streams/plugins/manifest";
import { PluginError } from "@/lib/streams/plugins/types";
import { repoHost, type EntryView, type KindAdapter, type PluginState, type PluginView, type RepoView } from "../types";

const SAMPLE = {
  type: "movie" as const,
  id: "tt0137523",
  ids: ["tt0137523"],
  imdbId: "tt0137523",
  tmdb: { id: 550, kind: "movie" as const },
  title: "Fight Club",
  year: 1999,
  season: null,
  episode: null,
  absoluteEpisode: null,
};

function stateOf(p: InstalledStreamPlugin): PluginState {
  if (p.incompatible) return "incompatible";
  if (p.repoDisabled) return "repo-disabled";
  if (!p.listed) return "unlisted";
  if (p.filesChanged) return "files-changed";
  if (p.nsfw && adultContentHidden()) return "hidden-adult";
  if (!p.enabled) return "off";
  if (p.autoPaused) return "auto-paused";
  const h = pluginHealth(p.id);
  if (h?.lastError) return "error";
  if (p.updateVersion) return "update";
  return "ok";
}

function toView(p: InstalledStreamPlugin): PluginView {
  const h = pluginHealth(p.id);
  return {
    kind: "stream",
    id: p.id,
    name: p.name,
    version: p.version,
    description: p.description,
    author: p.author,
    lang: p.lang,
    types: p.types,
    nsfw: p.nsfw,
    icon: p.icon,
    repoUrl: p.repoUrl,
    repoName: p.repoName,
    format: p.format,
    enabled: p.enabled,
    hasSettings: p.settings,
    state: stateOf(p),
    error: h?.lastError ?? null,
    updateVersion: p.updateVersion,
    canRevert: !!p.previous,
    previousVersion: p.previous?.version ?? null,
    hosts: p.hosts,
    learnedHosts: h?.seenHosts ?? p.learnedHosts,
    verified: p.verified,
    installedAt: p.installedAt,
    checkable: true,
  };
}

function repoView(r: StreamRepoRecord): RepoView {
  const installed = new Map(installedStreamPluginsSync().filter((p) => p.repoUrl === r.url).map((p) => [p.id, p]));
  const entries: EntryView[] = r.entries.map((e) => {
    const cur = installed.get(pluginIdFor(r.url, e.id));
    return {
      id: e.id,
      name: e.name,
      version: e.version,
      description: e.description,
      lang: e.lang,
      nsfw: e.nsfw,
      icon: cur?.icon ?? e.icon,
      format: e.format,
      installed: !!cur,
      installedId: cur?.id ?? null,
      installedVersion: cur?.version ?? null,
      updateAvailable: !!cur && cur.version !== e.version,
      repoDisabled: !e.enabled,
      note: e.note,
    };
  });
  return {
    kind: "stream",
    url: r.url,
    name: r.name,
    host: repoHost(r.url),
    format: r.format,
    homepage: r.homepage,
    entries,
    installedCount: entries.filter((e) => e.installed).length,
    updates: entries.filter((e) => e.updateAvailable).length,
    checkedAt: r.checkedAt,
    error: r.error ?? null,
    loading: false,
    foreign: null,
  };
}

async function entryFor(repoUrl: string, entryId: string) {
  let record = streamRepoByUrl(repoUrl);
  let entry = record?.entries.find((e) => e.id === entryId);
  if (!entry) {
    record = await refreshStreamRepo(repoUrl);
    entry = record.entries.find((e) => e.id === entryId);
  }
  if (!record || !entry) throw new PluginError("no-answer");
  return { record, entry };
}

export const streamKind: KindAdapter = {
  kind: "stream",
  label: "Streams",
  load: () => loadStreamPlugins(),
  subscribe: subscribeStreamPlugins,
  repos: () => streamReposSync().map(repoView),
  plugins: () => installedStreamPluginsSync().map(toView),
  addRepo: async (url) => repoView(await addStreamRepo(url)),
  refreshRepo: async (url) => {
    await refreshStreamRepo(url);
  },
  removeRepo: removeStreamRepo,
  install: async (repoUrl, entryId) => {
    const { record, entry } = await entryFor(repoUrl, entryId);
    await installEntry(record, entry);
  },
  uninstall: uninstallStreamPlugin,
  setEnabled: setStreamPluginEnabled,
  update: async (id) => {
    const p = streamPluginById(id);
    if (!p) return;
    const { record, entry } = await entryFor(p.repoUrl, p.entryId);
    await installEntry(record, entry);
  },
  revert: revertPlugin,
  settingsFields: async (id) => {
    const p = streamPluginById(id);
    return p ? streamPluginSettingsFields(p) : [];
  },
  settingsValues: (id) => {
    const p = streamPluginById(id);
    return p ? settingsValuesFor(p) : {};
  },
  saveSettings: saveStreamPluginSettings,
  check: async (id, timeoutMs) => {
    const p = streamPluginById(id);
    if (!p) return { count: 0, ms: 0, requests: 0, error: "missing" };
    const h = pluginHealth(id);
    const title = h?.lastTitle;
    const req = { ...SAMPLE, settings: settingsValuesFor(p) };
    if (title) req.title = title;
    return checkStreamPlugin(p, req, timeoutMs);
  },
  health: pluginHealth,
  log: pluginLog,
};
