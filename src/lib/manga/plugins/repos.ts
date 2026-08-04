import { fetchRepo } from "./repo";
import { loadRepoUrls, saveRepoUrl, deleteRepoUrl, installedPluginsSync } from "./store";
import { uninstallPlugin } from "./lifecycle";
import { removeMangayomiRecordsByRepo } from "../sources/mangayomi";
import type { PluginRepo } from "./types";

let urls: string[] | null = null;
const listeners = new Set<() => void>();

export function subscribeRepos(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify(): void {
  for (const l of listeners) l();
}

export function repoUrlsSync(): string[] {
  return urls ?? [];
}

export async function loadRepos(): Promise<string[]> {
  urls = await loadRepoUrls();
  notify();
  return urls;
}

export function browseRepo(url: string): Promise<PluginRepo> {
  return fetchRepo(url);
}

export async function addRepo(url: string): Promise<PluginRepo> {
  const repo = await fetchRepo(url);
  await saveRepoUrl(repo.url);
  urls = await loadRepoUrls();
  notify();
  return repo;
}

export async function removeRepo(url: string): Promise<void> {
  await deleteRepoUrl(url);
  for (const p of installedPluginsSync().filter((x) => x.repoUrl === url)) {
    await uninstallPlugin(p.id);
  }
  await removeMangayomiRecordsByRepo(url);
  urls = await loadRepoUrls();
  notify();
}
