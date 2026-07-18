import { lruGet, lruSet } from "@/lib/cache";

type Entry = { value: unknown; expiresAt: number };

const TTL_MANIFEST = 24 * 60 * 60 * 1000;
const TTL_CATALOG = 15 * 60 * 1000;
const TTL_META = 60 * 60 * 1000;

const manifests = new Map<string, Entry>();
const catalogs = new Map<string, Entry>();
const metas = new Map<string, Entry>();

const MAX_MANIFESTS = 8;
const MAX_CATALOGS = 64;
const MAX_METAS = 512;

function read(map: Map<string, Entry>, key: string): unknown {
  const e = lruGet(map, key);
  if (!e) return undefined;
  if (Date.now() > e.expiresAt) {
    map.delete(key);
    return undefined;
  }
  return e.value;
}

function write(
  map: Map<string, Entry>,
  key: string,
  value: unknown,
  ttl: number,
  max: number,
): void {
  lruSet(map, key, { value, expiresAt: Date.now() + ttl }, max);
}

export function getCachedManifest<T>(key: string): T | undefined {
  const v = read(manifests, key);
  return v as T | undefined;
}
export function setCachedManifest<T>(key: string, value: T): void {
  write(manifests, key, value, TTL_MANIFEST, MAX_MANIFESTS);
}

export function getCachedCatalog<T>(key: string): T | undefined {
  const v = read(catalogs, key);
  return v as T | undefined;
}
export function setCachedCatalog<T>(key: string, value: T): void {
  write(catalogs, key, value, TTL_CATALOG, MAX_CATALOGS);
}

export function getCachedMeta<T>(key: string): T | undefined {
  const v = read(metas, key);
  return v as T | undefined;
}
export function setCachedMeta<T>(key: string, value: T): void {
  write(metas, key, value, TTL_META, MAX_METAS);
}

export function invalidateLetterboxdCache(): void {
  manifests.clear();
  catalogs.clear();
  metas.clear();
}
