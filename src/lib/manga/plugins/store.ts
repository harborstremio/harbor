import type { InstalledPlugin } from "./types";

const DB_NAME = "harbor-manga-plugins";
const PLUGIN_STORE = "plugins";
const REPO_STORE = "repos";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PLUGIN_STORE))
        db.createObjectStore(PLUGIN_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(REPO_STORE))
        db.createObjectStore(REPO_STORE, { keyPath: "url" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

let cache: InstalledPlugin[] | null = null;
const listeners = new Set<() => void>();

export function subscribePlugins(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify(): void {
  for (const l of listeners) l();
}

export function installedPluginsSync(): InstalledPlugin[] {
  return cache ?? [];
}

export async function loadInstalledPlugins(): Promise<InstalledPlugin[]> {
  try {
    const db = await openDb();
    const list = await new Promise<InstalledPlugin[]>((resolve) => {
      const tx = db.transaction(PLUGIN_STORE, "readonly");
      const req = tx.objectStore(PLUGIN_STORE).getAll();
      req.onsuccess = () =>
        resolve(Array.isArray(req.result) ? (req.result as InstalledPlugin[]) : []);
      req.onerror = () => resolve([]);
    });
    cache = list;
    notify();
    return list;
  } catch {
    cache = [];
    return [];
  }
}

export async function savePlugin(p: InstalledPlugin): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PLUGIN_STORE, "readwrite");
    tx.objectStore(PLUGIN_STORE).put(p);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  cache = [...installedPluginsSync().filter((x) => x.id !== p.id), p];
  notify();
}

export async function deletePlugin(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(PLUGIN_STORE, "readwrite");
      tx.objectStore(PLUGIN_STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
  cache = installedPluginsSync().filter((x) => x.id !== id);
  notify();
}

export async function loadRepoUrls(): Promise<string[]> {
  try {
    const db = await openDb();
    return await new Promise<string[]>((resolve) => {
      const tx = db.transaction(REPO_STORE, "readonly");
      const req = tx.objectStore(REPO_STORE).getAll();
      req.onsuccess = () => {
        const rows = Array.isArray(req.result) ? req.result : [];
        resolve(rows.map((r) => String((r as { url: string }).url)).filter(Boolean));
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

export async function saveRepoUrl(url: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(REPO_STORE, "readwrite");
    tx.objectStore(REPO_STORE).put({ url });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteRepoUrl(url: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(REPO_STORE, "readwrite");
      tx.objectStore(REPO_STORE).delete(url);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
}
