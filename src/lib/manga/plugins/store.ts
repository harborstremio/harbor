import type { InstalledPlugin } from "./types";
import { createPluginStore } from "./store-factory";

const store = createPluginStore<InstalledPlugin>("harbor-manga-plugins");

export const subscribePlugins = store.subscribe;
export const installedPluginsSync = store.pluginsSync;
export const loadInstalledPlugins = store.loadPlugins;
export const savePlugin = store.savePlugin;
export const deletePlugin = store.deletePlugin;

export async function loadRepoUrls(): Promise<string[]> {
  const rows = await store.loadRepos();
  return rows.map((r) => String(r.url)).filter(Boolean);
}

export function saveRepoUrl(url: string): Promise<void> {
  return store.saveRepo({ url });
}

export const deleteRepoUrl = store.deleteRepo;
