import { cinemetaEnabled, meta as cinemetaMeta, type Meta } from "./cinemeta";
import { safeFetch as fetch } from "./safe-fetch";
import { addonAccepts, userAddons, type Addon } from "./addons";
import { loadInstalled } from "./addon-store";
import { readActiveStremioAuthKey } from "./auth";
import { lruSet } from "./cache";

const ADDON_TIMEOUT_MS = 4000;
const PREFERRED_CACHE_MAX = 500;

export const PREFERRED_TEXT_SCORE = 1000;

export type PreferredVideo = NonNullable<Meta["videos"]>[number];

const preferredCache = new Map<string, Promise<Meta | null>>();

export function preferCustomMeta(): boolean {
  try {
    const raw = localStorage.getItem("harbor.settings");
    return raw ? JSON.parse(raw).preferCustomMetaAddon === true : false;
  } catch {
    return false;
  }
}

function localAddons(): Addon[] {
  return loadInstalled()
    .filter((a) => !!a.manifest)
    .map((a) => ({ manifest: a.manifest!, transportUrl: a.transportUrl }));
}

export async function resolveMeta(
  authKey: string | null,
  type: "movie" | "series",
  id: string,
): Promise<Meta | null> {
  const cinemetaPromise = cinemetaMeta(type, id).catch(() => null);
  const cinemetaOff = !cinemetaEnabled();

  if (!cinemetaOff && !preferCustomMeta()) {
    const early = await cinemetaPromise;
    if (early?.poster) return early;
  }

  const user = authKey ? await userAddons(authKey).catch(() => [] as Addon[]) : [];
  const seen = new Set<string>();
  const candidates: Addon[] = [];
  for (const a of [...user, ...localAddons()]) {
    const key = a.transportUrl || a.manifest.id;
    if (seen.has(key)) continue;
    seen.add(key);
    if (addonAccepts(a, "meta", type, id) && !isCinemeta(a)) candidates.push(a);
  }

  if (candidates.length === 0) {
    return cinemetaOff ? cinemetaMeta(type, id, true).catch(() => null) : cinemetaPromise;
  }

  const addonRaces = candidates.map((a) => ({ a, p: fetchAddonMeta(a, type, id) }));

  if (cinemetaOff) {
    let firstAny: Meta | null = null;
    let firstAddon: Addon | null = null;
    for (const { a, p } of addonRaces) {
      const result = await p;
      if (!result) continue;
      if (result.poster) return withOrigin(result, a);
      if (!firstAny) {
        firstAny = result;
        firstAddon = a;
      }
    }
    if (firstAny && firstAddon) return withOrigin(firstAny, firstAddon);
    return cinemetaMeta(type, id, true).catch(() => null);
  }

  if (preferCustomMeta()) {
    let firstAny: Meta | null = null;
    let firstAddon: Addon | null = null;
    for (const { a, p } of addonRaces) {
      const result = await p;
      if (!result) continue;
      if (result.poster) return withOrigin(result, a);
      if (!firstAny) {
        firstAny = result;
        firstAddon = a;
      }
    }
    if (firstAny && firstAddon) {
      return fillArtwork(withOrigin(firstAny, firstAddon), cinemetaPromise);
    }
    return (await cinemetaPromise) ?? null;
  }

  const cinemeta = await cinemetaPromise;
  if (cinemeta && cinemeta.poster) return cinemeta;

  for (const { a, p } of addonRaces) {
    const result = await p;
    if (result && result.poster) return withOrigin(result, a);
  }

  return cinemeta ?? null;
}

async function fillArtwork(preferred: Meta, fallback: Promise<Meta | null>): Promise<Meta> {
  const base = await fallback;
  if (!base) return preferred;
  return {
    ...preferred,
    poster: preferred.poster || base.poster,
    background: preferred.background || base.background,
    logo: preferred.logo || base.logo,
  };
}

export function preferredMeta(type: "movie" | "series", id: string): Promise<Meta | null> {
  if (!preferCustomMeta()) return Promise.resolve(null);
  const key = `${type}:${id}`;
  const cached = preferredCache.get(key);
  if (cached) return cached;
  let authKey: string | null = null;
  try {
    authKey = readActiveStremioAuthKey();
  } catch {
    authKey = null;
  }
  const pending = resolveMeta(authKey, type, id)
    .then((full) => (full?.addonOrigin ? full : null))
    .catch(() => null);
  lruSet(preferredCache, key, pending, PREFERRED_CACHE_MAX);
  return pending;
}

export function preferredVideoMap(videos: Meta["videos"]): Map<string, PreferredVideo> {
  const out = new Map<string, PreferredVideo>();
  for (const v of videos ?? []) {
    const season = typeof v.season === "number" ? v.season : null;
    const episode =
      typeof v.episode === "number" ? v.episode : typeof v.number === "number" ? v.number : null;
    if (season == null || episode == null) continue;
    out.set(`${season}:${episode}`, v);
  }
  return out;
}

export function preferredVideoName(v: PreferredVideo | undefined): string {
  return v?.title || v?.name || "";
}

export function preferredVideoOverview(v: PreferredVideo | undefined): string {
  return v?.overview || v?.description || "";
}

function withOrigin(meta: Meta, addon: Addon): Meta {
  if (meta.addonOrigin?.base) return meta;
  const base = addon.transportUrl.replace(/\/manifest\.json$/, "");
  return {
    ...meta,
    addonOrigin: {
      id: addon.manifest.id,
      name: addon.manifest.name ?? addon.manifest.id,
      logo: addon.manifest.logo,
      base,
    },
  };
}

export function hasCustomMetaAddon(): boolean {
  return localAddons().some(
    (a) =>
      !isCinemeta(a) &&
      (addonAccepts(a, "meta", "movie", "tt0000000") ||
        addonAccepts(a, "meta", "series", "tt0000000")),
  );
}

function isCinemeta(addon: Addon): boolean {
  const id = (addon.manifest.id ?? "").toLowerCase();
  const url = (addon.transportUrl ?? "").toLowerCase();
  return id.includes("cinemeta") || url.includes("v3-cinemeta") || url.includes("cinemeta.strem");
}

async function fetchAddonMeta(addon: Addon, type: string, id: string): Promise<Meta | null> {
  const base = addon.transportUrl.replace(/\/manifest\.json$/, "");
  const url = `${base}/meta/${type}/${id}.json`;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ADDON_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as { meta?: Meta };
    return json.meta ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
