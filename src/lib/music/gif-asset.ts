import { useEffect, useState } from "react";
import type { MusicGifFrames } from "./gif-frames";
export type StoredMusicGif = { id: string; name: string; blob: Blob };
const cache = new Map<string, Promise<MusicGifFrames>>();

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open("harbor-music-gifs", 1);
      let failed = false;
      request.onupgradeneeded = () => request.result.createObjectStore("gifs", { keyPath: "id" });
      request.onsuccess = () => { if (failed) request.result.close(); else resolve(request.result); };
      request.onerror = request.onblocked = () => { failed = true; reject(new Error("storage")); };
    } catch { reject(new Error("storage")); }
  });
}
async function operation<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction("gifs", mode), request = work(transaction.objectStore("gifs"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () => reject(new Error("storage"));
    });
  } catch { throw new Error("storage"); }
  finally { db.close(); }
}
export const saveMusicGif = (asset: StoredMusicGif) => operation("readwrite", store => store.put(asset));
export async function deleteMusicGif(id: string) {
  await operation("readwrite", store => store.delete(id)); cache.delete(id);
}
export async function readMusicGif(id: string): Promise<StoredMusicGif | undefined> {
  return operation("readonly", store => store.get(id));
}
export function decodeGifFile(blob: Blob): Promise<MusicGifFrames> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./gif-decoder.worker.ts", import.meta.url), { type: "module" });
    const finish = () => { clearTimeout(timer); worker.terminate(); };
    const timer = setTimeout(() => { finish(); reject(new Error("large")); }, 20000);
    worker.onmessage = (event: MessageEvent<{ animation?: MusicGifFrames; error?: string }>) => {
      finish(); event.data.animation ? resolve(event.data.animation) : reject(new Error(event.data.error ?? "invalid"));
    };
    worker.onerror = () => { finish(); reject(new Error("invalid")); };
    void blob.arrayBuffer().then(bytes => worker.postMessage(bytes, [bytes])).catch(() => { finish(); reject(new Error("invalid")); });
  });
}
export function rememberMusicGif(id: string, frames: MusicGifFrames) {
  cache.clear(); cache.set(id, Promise.resolve(frames));
}
function load(id: string) {
  let pending = cache.get(id);
  if (!pending) {
    pending = readMusicGif(id).then(asset => {
      if (!asset) throw new Error("missing");
      return decodeGifFile(asset.blob);
    });
    cache.clear(); cache.set(id, pending);
    void pending.catch(() => { if (cache.get(id) === pending) cache.delete(id); });
  }
  return pending;
}
export function useMusicGif(id: string | null) {
  const [state, setState] = useState<{ id: string; frames?: MusicGifFrames; error?: boolean } | null>(null);
  useEffect(() => {
    if (!id) return;
    let live = true;
    void load(id).then(frames => { if (live) setState({ id, frames }); }, () => { if (live) setState({ id, error: true }); });
    return () => { live = false; };
  }, [id]);
  return state?.id === id ? state : null;
}
