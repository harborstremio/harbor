import { registerEvictable } from "@/lib/maintenance";
import { safeFetch } from "@/lib/safe-fetch";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";
import type { FavoriteMedia, FavoriteSearchResult } from "./favorites-types";

export type GameSource = "igdb" | "steam";

export type ShowcaseGame = {
  id: string;
  name: string;
  image: string | null;
  images: string[];
  url: string | null;
  releaseYear: number | null;
  platforms: string[];
  genres: string[];
  source: GameSource;
};

export type GameSearchResult =
  | { kind: "ok"; items: ShowcaseGame[]; source: GameSource; degraded: boolean }
  | { kind: "empty"; query: string }
  | { kind: "needs-key"; message: string }
  | { kind: "failed"; message: string };

export type GameSearchOptions = {
  clientId?: string;
  token?: string;
  signal?: AbortSignal;
  limit?: number;
};

const IGDB_API = "https://api.igdb.com/v4/games";
const IGDB_PROXY = `${HARBOR_API_BASE}/api/igdb/games`;
const IGDB_IMAGE = "https://images.igdb.com/igdb/image/upload";
const STEAM_SEARCH = "https://store.steampowered.com/api/storesearch/";
const STEAM_CDN = "https://cdn.cloudflare.steamstatic.com/steam/apps";
const STEAM_STORE = "https://store.steampowered.com/app";

const TTL_MS = 30 * 60 * 1000;
const MAX_ENTRIES = 80;
const DEFAULT_LIMIT = 24;
const IGDB_COOLDOWN_MS = 5 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;

const EXCLUDED =
  /\b(soundtrack|ost|original score|demo|art\s?book|wallpaper|dedicated server|trailer)\b/i;

const cache = new Map<string, { v: GameSearchResult; t: number }>();
const inflight = new Map<string, Promise<GameSearchResult>>();

let igdbDownUntil = 0;

registerEvictable("games-search", (aggressive) => {
  if (aggressive) return cache.clear();
  const now = Date.now();
  for (const [k, e] of cache) if (now - e.t > TTL_MS) cache.delete(k);
});

function trim() {
  if (cache.size <= MAX_ENTRIES) return;
  const oldest = [...cache.entries()].sort((a, b) => a[1].t - b[1].t);
  for (const [k] of oldest.slice(0, cache.size - MAX_ENTRIES)) cache.delete(k);
}

function withTimeout(signal?: AbortSignal): { signal: AbortSignal; done: () => void } {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => ac.abort();
  if (signal?.aborted) ac.abort();
  signal?.addEventListener("abort", onAbort);
  return {
    signal: ac.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    },
  };
}

type IgdbNamed = { name?: string; abbreviation?: string };
type IgdbExternal = { category?: number; uid?: string };

type IgdbGame = {
  id: number;
  name?: string;
  slug?: string;
  first_release_date?: number;
  cover?: { image_id?: string };
  platforms?: IgdbNamed[];
  genres?: IgdbNamed[];
  external_games?: IgdbExternal[];
};

function igdbBody(query: string, limit: number): string {
  const escaped = query.replace(/["\\]/g, " ").trim();
  const fields = [
    "name",
    "slug",
    "first_release_date",
    "cover.image_id",
    "platforms.abbreviation",
    "platforms.name",
    "genres.name",
    "external_games.category",
    "external_games.uid",
  ].join(",");
  return `search "${escaped}"; fields ${fields}; where version_parent = null; limit ${limit};`;
}

function steamAppId(g: IgdbGame): string | null {
  const hit = g.external_games?.find((e) => e.category === 1 && /^\d+$/.test(e.uid ?? ""));
  return hit?.uid ?? null;
}

function steamCapsule(appId: string): string {
  return `${STEAM_CDN}/${appId}/library_600x900_2x.jpg`;
}

function normaliseIgdb(g: IgdbGame): ShowcaseGame | null {
  if (!g.name || EXCLUDED.test(g.name)) return null;
  const appId = steamAppId(g);
  const cover = g.cover?.image_id ? `${IGDB_IMAGE}/t_cover_big_2x/${g.cover.image_id}.jpg` : null;
  const images = [appId ? steamCapsule(appId) : null, cover].filter((u): u is string => u !== null);
  const platforms = (g.platforms ?? [])
    .map((p) => p.abbreviation || p.name || "")
    .filter(Boolean)
    .slice(0, 4);
  return {
    id: `igdb:${g.id}`,
    name: g.name,
    image: images[0] ?? null,
    images,
    url: g.slug ? `https://www.igdb.com/games/${g.slug}` : null,
    releaseYear: g.first_release_date
      ? new Date(g.first_release_date * 1000).getUTCFullYear()
      : null,
    platforms,
    genres: (g.genres ?? [])
      .map((x) => x.name ?? "")
      .filter(Boolean)
      .slice(0, 3),
    source: "igdb",
  };
}

async function searchIgdb(
  query: string,
  opts: GameSearchOptions,
  limit: number,
): Promise<GameSearchResult> {
  const { clientId, token } = opts;
  const direct = Boolean(clientId && token);
  if (!direct && Date.now() < igdbDownUntil) {
    return { kind: "needs-key", message: "IGDB is not configured." };
  }
  const headers: Record<string, string> = { "content-type": "text/plain" };
  if (clientId && token) {
    headers["client-id"] = clientId;
    headers.authorization = `Bearer ${token}`;
  }
  const { signal, done } = withTimeout(opts.signal);
  try {
    const res = await safeFetch(direct ? IGDB_API : IGDB_PROXY, {
      method: "POST",
      headers,
      body: igdbBody(query, limit),
      signal,
    });
    if (res.status === 401 || res.status === 403) {
      if (!direct) igdbDownUntil = Date.now() + IGDB_COOLDOWN_MS;
      return { kind: "needs-key", message: "IGDB rejected the credentials." };
    }
    if (res.status === 404 || res.status === 501) {
      igdbDownUntil = Date.now() + IGDB_COOLDOWN_MS;
      return { kind: "needs-key", message: "IGDB is not configured." };
    }
    if (!res.ok) return { kind: "failed", message: `IGDB returned ${res.status}.` };
    const rows = (await res.json()) as IgdbGame[];
    if (!Array.isArray(rows))
      return { kind: "failed", message: "IGDB sent an unexpected response." };
    const items = rows.map(normaliseIgdb).filter((g): g is ShowcaseGame => g !== null);
    if (!items.length) return { kind: "empty", query };
    return { kind: "ok", items, source: "igdb", degraded: false };
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw e;
    if (!direct) igdbDownUntil = Date.now() + IGDB_COOLDOWN_MS;
    return { kind: "failed", message: "Couldn't reach IGDB." };
  } finally {
    done();
  }
}

type SteamItem = {
  type?: string;
  id?: number;
  name?: string;
  tiny_image?: string;
  metascore?: string;
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
};

function steamPlatforms(p: SteamItem["platforms"]): string[] {
  const out: string[] = [];
  if (p?.windows) out.push("PC");
  if (p?.mac) out.push("Mac");
  if (p?.linux) out.push("Linux");
  return out;
}

function normaliseSteam(item: SteamItem): ShowcaseGame | null {
  if (item.type !== "app" || !item.id || !item.name) return null;
  if (EXCLUDED.test(item.name)) return null;
  const score = Number(item.metascore);
  const capsule = steamCapsule(String(item.id));
  const tiny = typeof item.tiny_image === "string" && item.tiny_image.startsWith("https://")
    ? item.tiny_image
    : null;
  const images = tiny ? [capsule, tiny] : [capsule];
  return {
    id: `steam:${item.id}`,
    name: item.name,
    image: capsule,
    images,
    url: `${STEAM_STORE}/${item.id}`,
    releaseYear: null,
    platforms: steamPlatforms(item.platforms),
    genres: Number.isFinite(score) && score > 0 ? [`Metascore ${score}`] : [],
    source: "steam",
  };
}

async function searchSteam(query: string, opts: GameSearchOptions): Promise<GameSearchResult> {
  const { signal, done } = withTimeout(opts.signal);
  try {
    const url = `${STEAM_SEARCH}?term=${encodeURIComponent(query)}&cc=us&l=en`;
    const res = await safeFetch(url, { signal });
    if (!res.ok) return { kind: "failed", message: `Steam returned ${res.status}.` };
    const json = (await res.json()) as { items?: SteamItem[] };
    const items = (json.items ?? [])
      .map(normaliseSteam)
      .filter((g): g is ShowcaseGame => g !== null);
    if (!items.length) return { kind: "empty", query };
    return { kind: "ok", items, source: "steam", degraded: true };
  } catch (e) {
    if ((e as { name?: string })?.name === "AbortError") throw e;
    return { kind: "failed", message: "Couldn't reach Steam." };
  } finally {
    done();
  }
}

async function run(
  query: string,
  opts: GameSearchOptions,
  limit: number,
): Promise<GameSearchResult> {
  const primary = await searchIgdb(query, opts, limit);
  if (primary.kind === "ok" || primary.kind === "empty") return primary;
  const fallback = await searchSteam(query, opts);
  if (fallback.kind === "ok") return { ...fallback, items: fallback.items.slice(0, limit) };
  return primary.kind === "needs-key" ? primary : fallback;
}

function toFavorite(g: ShowcaseGame): FavoriteMedia {
  return {
    kind: "game",
    id: g.id,
    name: g.name,
    image: g.image,
    imageFallback: g.images.find((u) => u !== g.image) ?? null,
    sub: g.releaseYear != null ? String(g.releaseYear) : null,
    url: g.url,
    source: g.source,
  };
}

function toFavoriteResult(r: GameSearchResult): FavoriteSearchResult {
  if (r.kind === "ok") return { status: "ok", items: r.items.map(toFavorite) };
  if (r.kind === "empty") return { status: "empty" };
  if (r.kind === "needs-key") return { status: "needs-key" };
  return { status: "failed", reason: r.message };
}

async function searchGamesRaw(
  query: string,
  opts: GameSearchOptions = {},
): Promise<GameSearchResult> {
  const q = query.trim();
  if (q.length < 2) return { kind: "empty", query: q };
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const key = `${limit}:${opts.clientId ? "direct" : "proxy"}:${q.toLowerCase()}`;

  const hit = cache.get(key);
  if (hit && Date.now() - hit.t < TTL_MS) return hit.v;

  const existing = inflight.get(key);
  if (existing) return existing;

  const p = run(q, opts, limit)
    .then((r) => {
      if (r.kind === "ok" || r.kind === "empty") {
        cache.set(key, { v: r, t: Date.now() });
        trim();
      }
      return r;
    })
    .finally(() => inflight.delete(key));

  inflight.set(key, p);
  return p;
}

export async function searchGames(
  query: string,
  opts: GameSearchOptions = {},
): Promise<FavoriteSearchResult> {
  return toFavoriteResult(await searchGamesRaw(query, opts));
}

export function clearGameSearchCache(): void {
  cache.clear();
  igdbDownUntil = 0;
}
