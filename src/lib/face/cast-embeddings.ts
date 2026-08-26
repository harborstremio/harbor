import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import type { CastEntry } from "@/lib/providers/tmdb";
import { embedLargestFace } from "./face-engine";
import type { GalleryEntry } from "./match";


const MODEL_VERSION = "sface-int8-v2";
const CACHE_DIR = "xray/face-gallery";
const TMDB_IMG = "https://image.tmdb.org/t/p/w185";
const MAX_CAST = 24;
const CONCURRENCY = 1;

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
    const raw = JSON.parse(await readTextFile(path, { baseDir: BaseDirectory.AppData })) as CacheShape;
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

async function runPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const idx = cursor++;
      await fn(items[idx]);
    }
  });
  await Promise.all(workers);
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 0));
}

export async function buildGallery(
  key: string,
  cast: CastEntry[],
  loadBitmap: (url: string) => Promise<ImageBitmap>,
  onEntry?: (entry: GalleryEntry) => void,
): Promise<GalleryEntry[]> {
  const cached = await readCache(key);
  if (cached) {
    if (onEntry) for (const e of cached) onEntry(e);
    return cached;
  }
  const pool = cast.filter((c) => c.profilePath).slice(0, MAX_CAST);
  const entries: GalleryEntry[] = [];
  await runPool(pool, CONCURRENCY, async (c) => {
    try {
      const bmp = await loadBitmap(castImageUrl(c.profilePath as string));
      let emb: number[] | null;
      try {
        emb = await embedLargestFace(bmp);
      } finally {
        bmp.close();
      }
      if (!emb) return;
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
    } finally {
      // Face detection is CPU-bound and runs on the renderer thread. Yield
      // between portraits so opening X-Ray cannot starve player controls.
      await yieldToBrowser();
    }
  });
  if (entries.length) {
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
