import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { safeFetch } from "@/lib/safe-fetch";
import {
  ALLSPORTS_BASE,
  ALLSPORTS_KEY_HEADER,
  createRateGate,
  imagePath,
  type AsGet,
  type AsImageKind,
} from "./as-core";

/**
 * The one AllSports client. The viewer's own key (settings.allsportsKey) is passed in by the
 * caller and sent only as a request header, never in a URL, never stored or logged here.
 * Requests go from the device: natively on desktop (no CORS), straight from the browser on web.
 * Answers are cached in memory for the TTL each caller asks for; failures are never cached.
 */

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** The key was refused (401/403) or the plan's limit is used up (429). */
export class AllSportsError extends Error {
  constructor(readonly status: number) {
    super(status === 429 ? "AllSports limit reached" : "AllSports key rejected");
  }
}

const gate = createRateGate();
const MAX_CACHE = 300;
const cache = new Map<string, { at: number; ttl: number; value: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

// Cache entries are scoped to the key that fetched them, without keeping the key itself around.
function keyTag(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (Math.imul(h, 31) + key.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function remember(id: string, value: unknown, ttl: number) {
  cache.delete(id);
  cache.set(id, { at: Date.now(), ttl, value });
  while (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string);
}

async function request(key: string, path: string): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await gate();
    const res = await safeFetch(`${ALLSPORTS_BASE}${path}`, {
      headers: { [ALLSPORTS_KEY_HEADER]: key, Accept: "application/json" },
    }).catch(() => null);
    if (!res) return null;
    if (res.status === 429 && attempt === 0) {
      await new Promise((r) => setTimeout(r, 1100));
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 429)
      throw new AllSportsError(res.status);
    // 204 = nothing for this game yet (no lineups, no graph): normal, not a failure.
    if (!res.ok || res.status === 204) return null;
    return res.json().catch(() => null);
  }
  return null;
}

/** GET an AllSports path with the viewer's key. Null when there's no key, no data or a failure. */
export async function allsportsGet<T = unknown>(
  key: string,
  path: string,
  ttlMs = 60_000,
): Promise<T | null> {
  const k = key.trim();
  if (!k) return null;
  const id = `${keyTag(k)}:${path}`;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < Math.min(hit.ttl, ttlMs)) return hit.value as T;
  const running = inflight.get(id);
  if (running) return (await running) as T | null;
  const p = request(k, path)
    .then((value) => {
      if (value != null && ttlMs > 0) remember(id, value, ttlMs);
      return value;
    })
    .finally(() => inflight.delete(id));
  inflight.set(id, p);
  return (await p) as T | null;
}

/** A getter bound to one key, for the loaders in match-center.ts and as-world.ts. */
export function allsportsGetter(key: string): AsGet {
  return <T>(path: string, ttlMs?: number) => allsportsGet<T>(key, path, ttlMs);
}

// ---- Images ------------------------------------------------------------------------------------

// AllSports images need the key too, so they're fetched as blobs and shown from object URLs.
// Each image costs one request against the plan: kept for the session, misses remembered as well.
const MAX_IMAGES = 400;
const images = new Map<string, string | null>();
const imageInflight = new Map<string, Promise<string | null>>();

async function fetchImage(key: string, path: string): Promise<string | null> {
  await gate();
  const init = { headers: { [ALLSPORTS_KEY_HEADER]: key } };
  // On web, through the app's proxy (the key stays in a header) so the browser's CORS rules don't apply.
  const res = await (
    isTauri
      ? tauriFetch(`${ALLSPORTS_BASE}${path}`, init)
      : fetch(`/api-proxy/${new URL(ALLSPORTS_BASE).host}${new URL(ALLSPORTS_BASE).pathname}${path}`, init)
  ).catch(() => null);
  if (!res?.ok || !/^image\//.test(res.headers.get("content-type") ?? "")) return null;
  const blob = await res.blob().catch(() => null);
  if (!blob || blob.size > 1_000_000) return null;
  return URL.createObjectURL(blob);
}

/** An object URL for a team logo, player photo, coach photo or league logo; null when there is none. */
export function allsportsImage(
  key: string,
  slug: string,
  kind: AsImageKind,
  id: number | string,
): Promise<string | null> {
  const k = key.trim();
  if (!k || !/^[0-9]{1,10}$/.test(String(id))) return Promise.resolve(null);
  const path = imagePath(slug, kind, id);
  const cacheId = `${keyTag(k)}:${path}`;
  if (images.has(cacheId)) return Promise.resolve(images.get(cacheId) ?? null);
  const running = imageInflight.get(cacheId);
  if (running) return running;
  const p = fetchImage(k, path)
    .then((url) => {
      images.set(cacheId, url);
      while (images.size > MAX_IMAGES) {
        const first = images.keys().next().value as string;
        const old = images.get(first);
        if (old) URL.revokeObjectURL(old);
        images.delete(first);
      }
      return url;
    })
    .finally(() => imageInflight.delete(cacheId));
  imageInflight.set(cacheId, p);
  return p;
}

/** A cached image URL without fetching (for a first render without flicker). */
export function cachedAllsportsImage(
  key: string,
  slug: string,
  kind: AsImageKind,
  id: number | string,
) {
  return images.get(`${keyTag(key.trim())}:${imagePath(slug, kind, id)}`) ?? null;
}
