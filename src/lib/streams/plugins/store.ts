import { createPluginStore } from "@/lib/manga/plugins/store-factory";
import type { InstalledStreamPlugin, StreamRepoRecord } from "./types";

const store = createPluginStore<InstalledStreamPlugin, StreamRepoRecord>("harbor-stream-plugins");

export const subscribeStreamPluginStore = store.subscribe;
export const installedStreamPluginsSync = store.pluginsSync;
export const loadInstalledStreamPlugins = store.loadPlugins;
export const saveStreamPlugin = store.savePlugin;
export const deleteStreamPlugin = store.deletePlugin;
export const loadStreamRepoRecords = store.loadRepos;
export const saveStreamRepoRecord = store.saveRepo;
export const deleteStreamRepoRecord = store.deleteRepo;

export function streamPluginById(id: string): InstalledStreamPlugin | undefined {
  return installedStreamPluginsSync().find((p) => p.id === id);
}
