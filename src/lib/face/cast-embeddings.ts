import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { CastEntry } from "@/lib/providers/tmdb";
import { embedLargestFace } from "./face-engine";
import type { GalleryEntry } from "./match";

const MODEL_VERSION = "sface-int8-v3";
const CACHE_DIR = "xray/face-gallery";
const TMDB_IMG = "https://image.tmdb.org/t/p/w185";
const PRIMARY_CAST = 24;
const MAX_CAST = 80;
const PRIMARY_CONCURRENCY = 3;
const BACKGROUND_CONCURRENCY = 1;

type CacheShape = {
  version: string;
  entries: { id: number; name: string; character: string; profilePath: string; emb: number[] }[];
};

function castImageUrl(profilePath: string): string {
  return profilePath.startsWith("http") ? profilePath : TMDB_IMG + profilePath;
}

function cachePath(key: string): string {
  return `${CACHE_DIR}/${key.replace(/[^a-z0-9_-]/gi, "_")}.json`;
}

async function readCache(key: string): Promise<GalleryEntry[] | null> {
  const path = cachePath(key);
  if (!(await exists(path, { baseDir: BaseDirectory.AppData }))) return null;
  try {
    const raw = JSON.parse(
      await readTextFile(path, { baseDir: BaseDirectory.AppData }),
    ) as CacheShape;
    if (raw.version !== MODEL_VERSION) return null;
    return raw.entries.map((e) => ({ ...e, emb: Float32Array.from(e.emb) }));
  } catch {
    return null;
  }
}

async function writeCache(key: string, entries: GalleryEntry[]): Promise<void> {
  await mkdir(CACHE_DIR, { baseDir: BaseDirectory.AppData, recursive: true });
  const shape: CacheShape = {
    version: MODEL_VERSION,
    entries: entries.map((e) => ({
      id: e.id,
      name: e.name,
      character: e.character,
      profilePath: e.profilePath,
      emb: Array.from(e.emb),
    })),
  };
  await writeTextFile(cachePath(key), JSON.stringify(shape), { baseDir: BaseDirectory.AppData });
}

async function runPool<T>(
  items: T[],
  limit: number,
  signal: AbortSignal,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (!signal.aborted && cursor < items.length) {
      const idx = cursor++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

export async function buildGallery(
  key: string,
  cast: CastEntry[],
  loadBitmap: (url: string, signal?: AbortSignal) => Promise<ImageBitmap>,
  signal: AbortSignal,
  onEntry?: (entry: GalleryEntry) => void,
): Promise<GalleryEntry[]> {
  const cached = await readCache(key);
  if (signal.aborted) return [];
  if (cached) {
    if (onEntry) for (const e of cached) onEntry(e);
    return cached;
  }
  const pool = cast.filter((c) => c.profilePath).slice(0, MAX_CAST);
  const entries: GalleryEntry[] = [];
  const addEntry = async (c: CastEntry) => {
    if (signal.aborted) return;
    try {
      const bmp = await loadBitmap(castImageUrl(c.profilePath as string), signal);
      if (signal.aborted) {
        bmp.close();
        return;
      }
      const emb = await embedLargestFace(bmp);
      if (!emb || signal.aborted) return;
      const entry: GalleryEntry = {
        id: c.id,
        name: c.name,
        character: c.character ?? "",
        profilePath: c.profilePath as string,
        emb: Float32Array.from(emb),
      };
      entries.push(entry);
      onEntry?.(entry);
    } catch {
      /* skip this cast member */
    }
  };

  // Make the principal cast usable quickly, then broaden coverage at a lower
  // concurrency so background gallery work does not compete with playback.
  await runPool(pool.slice(0, PRIMARY_CAST), PRIMARY_CONCURRENCY, signal, addEntry);
  await runPool(pool.slice(PRIMARY_CAST), BACKGROUND_CONCURRENCY, signal, addEntry);
  if (entries.length && !signal.aborted) {
    try {
      await writeCache(key, entries);
    } catch {
      /* cache is best-effort */
    }
  }
  return entries;
}

export function galleryPoolSize(cast: CastEntry[]): number {
  return cast.filter((c) => c.profilePath).slice(0, MAX_CAST).length;
}
