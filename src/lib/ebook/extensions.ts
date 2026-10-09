import { safeFetch } from "@/lib/safe-fetch";
import { assertSafeUrl } from "@/lib/manga/plugins/host-http";
import { PluginWorker } from "@/lib/manga/plugins/worker-host";
import type { InstalledPlugin } from "@/lib/manga/plugins/types";

export type EBookPluginManifest = {
  id: string;
  name: string;
  version: string;
  lang: string;
  nsfw: boolean;
  icon?: string;
  entry: string;
};

export type EBookPluginRepo = { name: string; url: string; plugins: EBookPluginManifest[] };

const DB = "harbor-ebook-plugins";
const LEGACY_DB = "harbor-novel-plugins";
const REPOS = "repos";
const PLUGINS = "plugins";
const listeners = new Set<() => void>();
let dbPromise: Promise<IDBDatabase> | null = null;
let repos: string[] = [];
let plugins: InstalledPlugin[] = [];

function openDb(): Promise<IDBDatabase> {
  return (dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(REPOS))
        request.result.createObjectStore(REPOS, { keyPath: "url" });
      if (!request.result.objectStoreNames.contains(PLUGINS))
        request.result.createObjectStore(PLUGINS, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }));
}

function all<T>(store: string): Promise<T[]> {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        const request = db.transaction(store).objectStore(store).getAll();
        request.onsuccess = () => resolve((request.result ?? []) as T[]);
        request.onerror = () => resolve([]);
      }),
  );
}

function legacy<T>(store: string): Promise<T[]> {
  return new Promise((resolve) => {
    const request = indexedDB.open(LEGACY_DB);
    request.onerror = () => resolve([]);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(store)) {
        db.close();
        resolve([]);
        return;
      }
      const rows = db.transaction(store).objectStore(store).getAll();
      rows.onsuccess = () => {
        db.close();
        resolve((rows.result ?? []) as T[]);
      };
      rows.onerror = () => {
        db.close();
        resolve([]);
      };
    };
  });
}

function put(store: string, value: unknown): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(store, "readwrite");
        transaction.objectStore(store).put(value);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      }),
  );
}

function drop(store: string, key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve) => {
        const transaction = db.transaction(store, "readwrite");
        transaction.objectStore(store).delete(key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      }),
  );
}

function notify(): void {
  for (const listener of listeners) listener();
}

function manifest(value: unknown, ebookRepo: boolean): EBookPluginManifest | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    !ebookRepo &&
    row.type !== "ebook" &&
    row.mediaType !== "ebook" &&
    row.type !== "novel" &&
    row.mediaType !== "novel"
  )
    return null;
  if (typeof row.id !== "string" || typeof row.name !== "string" || typeof row.entry !== "string")
    return null;
  return {
    id: row.id,
    name: row.name,
    entry: row.entry,
    version: typeof row.version === "string" ? row.version : "0",
    lang: typeof row.lang === "string" ? row.lang : "en",
    nsfw: row.nsfw === true,
    icon: typeof row.icon === "string" ? row.icon : undefined,
  };
}

export async function browseEBookRepo(url: string): Promise<EBookPluginRepo> {
  const target = assertSafeUrl(url);
  const response = await safeFetch(target, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Repository HTTP ${response.status}`);
  const value = JSON.parse(await response.text()) as Record<string, unknown>;
  const isEBook =
    value.type === "ebook" ||
    value.mediaType === "ebook" ||
    value.type === "novel" ||
    value.mediaType === "novel";
  const rows = Array.isArray(value.plugins) ? value.plugins : [];
  return {
    name: typeof value.name === "string" ? value.name : "Repository",
    url: target,
    plugins: rows
      .map((row) => manifest(row, isEBook))
      .filter((row): row is EBookPluginManifest => !!row),
  };
}

export async function loadEBookExtensions(): Promise<void> {
  let [repoRows, pluginRows] = await Promise.all([
    all<{ url: string }>(REPOS),
    all<InstalledPlugin>(PLUGINS),
  ]);
  if (!repoRows.length) {
    repoRows = await legacy<{ url: string }>(REPOS);
    await Promise.all(repoRows.map((row) => put(REPOS, row)));
  }
  if (!pluginRows.length) {
    pluginRows = await legacy<InstalledPlugin>(PLUGINS);
    await Promise.all(pluginRows.map((plugin) => put(PLUGINS, plugin)));
  }
  repos = repoRows.map((row) => row.url);
  plugins = pluginRows;
  notify();
}

export function ebookRepoUrls(): string[] {
  return repos;
}

export function installedEBookPlugins(): InstalledPlugin[] {
  return plugins;
}

export function subscribeEBookExtensions(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function addEBookRepo(url: string): Promise<void> {
  const repo = await browseEBookRepo(url);
  await put(REPOS, { url: repo.url });
  repos = [...new Set([...repos, repo.url])];
  notify();
}

export async function removeEBookRepo(url: string): Promise<void> {
  await drop(REPOS, url);
  for (const plugin of plugins.filter((item) => item.repoUrl === url))
    await removeEBookPlugin(plugin.id);
  repos = repos.filter((item) => item !== url);
  notify();
}

export async function installEBookPlugin(
  item: EBookPluginManifest,
  repoUrl: string,
): Promise<void> {
  const target = assertSafeUrl(new URL(item.entry, repoUrl).href);
  const response = await safeFetch(target, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new Error(`Extension HTTP ${response.status}`);
  const source = await response.text();
  if (source.length > 2 * 1024 * 1024) throw new Error("Extension is too large");
  const hash = Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source))),
  )
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  const plugin: InstalledPlugin = {
    ...item,
    repoUrl,
    source,
    hash,
    enabled: true,
    hasTags: false,
  };
  const worker = new PluginWorker(plugin);
  try {
    const meta = await worker.meta();
    const methods = new Set(meta.methods ?? []);
    if (
      !["popular", "search", "detail", "chapters"].every((method) => methods.has(method)) ||
      (!methods.has("content") && !methods.has("pageUrls"))
    )
      throw new Error("Extension is missing required eBook methods");
  } finally {
    worker.dispose();
  }
  await put(PLUGINS, plugin);
  plugins = [...plugins.filter((current) => current.id !== plugin.id), plugin];
  notify();
}

export async function setEBookPluginEnabled(id: string, enabled: boolean): Promise<void> {
  const plugin = plugins.find((item) => item.id === id);
  if (!plugin) return;
  const next = { ...plugin, enabled };
  await put(PLUGINS, next);
  plugins = plugins.map((item) => (item.id === id ? next : item));
  notify();
}

export async function removeEBookPlugin(id: string): Promise<void> {
  await drop(PLUGINS, id);
  plugins = plugins.filter((item) => item.id !== id);
  notify();
}
