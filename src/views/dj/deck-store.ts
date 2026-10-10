const DB_NAME = "harbor-dj";
const VERSION = 1;
const CUES = "cues";
const SAMPLES = "samples";

let handle: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (handle) return handle;
  handle = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CUES)) db.createObjectStore(CUES);
      if (!db.objectStoreNames.contains(SAMPLES)) db.createObjectStore(SAMPLES);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  handle.catch(() => {
    handle = null;
  });
  return handle;
}

async function run<T>(store: string, mode: IDBTransactionMode, act: (s: IDBObjectStore) => IDBRequest): Promise<T | null> {
  try {
    const db = await open();
    return await new Promise<T | null>((resolve) => {
      const request = act(db.transaction(store, mode).objectStore(store));
      request.onsuccess = () => resolve((request.result as T) ?? null);
      request.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export type DeckSample = { name: string; blob: Blob };

export const MAX_SAMPLE_BYTES = 6 * 1024 * 1024;

const sampleWatchers = new Set<(pads: Record<string, DeckSample>) => void>();

export function subscribeSamples(watch: (pads: Record<string, DeckSample>) => void): () => void {
  sampleWatchers.add(watch);
  return () => {
    sampleWatchers.delete(watch);
  };
}

export function readCues(trackId: string): Promise<number[] | null> {
  return run<number[]>(CUES, "readonly", (store) => store.get(trackId));
}

export function writeCues(trackId: string, cues: number[]): void {
  void run(CUES, "readwrite", (store) => store.put(cues, trackId));
}

export function readSamples(): Promise<Record<string, DeckSample> | null> {
  return run<Record<string, DeckSample>>(SAMPLES, "readonly", (store) => store.get("pads"));
}

export function writeSamples(pads: Record<string, DeckSample>): void {
  void run(SAMPLES, "readwrite", (store) => store.put(pads, "pads"));
  for (const watch of sampleWatchers) watch(pads);
}

export function readBrowser(): Promise<boolean | null> {
  return run<boolean>(SAMPLES, "readonly", (store) => store.get("browser"));
}

export function writeBrowser(open: boolean): void {
  void run(SAMPLES, "readwrite", (store) => store.put(open, "browser"));
}

export function readMode(): Promise<string | null> {
  return run<string>(SAMPLES, "readonly", (store) => store.get("mode"));
}

export function writeMode(mode: string): void {
  void run(SAMPLES, "readwrite", (store) => store.put(mode, "mode"));
}

export function readWave(): Promise<string | null> {
  return run<string>(SAMPLES, "readonly", (store) => store.get("wave"));
}

export function writeWave(open: boolean): void {
  void run(SAMPLES, "readwrite", (store) => store.put(open ? "on" : "off", "wave"));
}
