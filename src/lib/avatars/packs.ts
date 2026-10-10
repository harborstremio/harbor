import { useEffect, useSyncExternalStore } from "react";

export type AvatarPackItem = { id: string; name: string; data: string };
export type AvatarPack = { id: string; name: string; createdAt: number; items: AvatarPackItem[] };

export const UPLOADS_ID = "uploads";

const DB_NAME = "harbor-avatar-packs";
const STORE = "packs";
const VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function readAll(): Promise<AvatarPack[]> {
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve((req.result as AvatarPack[]).sort((a, b) => a.createdAt - b.createdAt));
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

const EMPTY: AvatarPack[] = [];
let cache: AvatarPack[] | null = null;
const listeners = new Set<() => void>();

async function refresh() {
  cache = await readAll();
  listeners.forEach((l) => l());
}

export async function saveAvatarPack(pack: AvatarPack): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(pack, pack.id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  await refresh();
}

export async function appendToAvatarPack(id: string, name: string, add: AvatarPackItem[]): Promise<number> {
  if (!add.length) return 0;
  const existing = (cache ?? (await readAll())).find((p) => p.id === id);
  const stamp = Date.now().toString(36);
  const stamped = add.map((it, i) => ({ ...it, id: `${id}_${stamp}_${i}` }));
  const pack: AvatarPack = existing
    ? { ...existing, name: existing.name || name, items: [...existing.items, ...stamped] }
    : { id, name, createdAt: Date.now(), items: stamped };
  await saveAvatarPack(pack);
  return stamped.length;
}

export async function removeFromAvatarPack(packId: string, itemId: string): Promise<void> {
  const existing = (cache ?? (await readAll())).find((p) => p.id === packId);
  if (!existing) return;
  const items = existing.items.filter((it) => it.id !== itemId);
  if (items.length === existing.items.length) return;
  if (items.length === 0) {
    await deleteAvatarPack(packId);
    return;
  }
  await saveAvatarPack({ ...existing, items });
}

export async function deleteAvatarPack(id: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    /* ignore */
  }
  await refresh();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useAvatarPacks(): AvatarPack[] {
  useEffect(() => {
    if (cache === null) void refresh();
  }, []);
  return useSyncExternalStore(subscribe, () => cache ?? EMPTY);
}
