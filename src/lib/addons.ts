import { safeFetch as fetch } from "@/lib/safe-fetch";
import type { Meta } from "./cinemeta";
import { fetchManifestAt, filterEnabled, loadInstalled } from "./addon-store";

const STREMIO_API = "https://api.strem.io/api";
const MAX_ROWS = 24;

export type CatalogDef = {
  id: string;
  type: string;
  name: string;
  extra?: Array<{ name: string; isRequired?: boolean; options?: string[] }>;
};

export type AddonResource = string | { name: string; types?: string[]; idPrefixes?: string[] };

export type Addon = {
  manifest: {
    id: string;
    name: string;
    version?: string;
    description?: string;
    logo?: string;
    background?: string;
    contactEmail?: string;
    catalogs?: CatalogDef[];
    resources?: AddonResource[];
    types?: string[];
    idPrefixes?: string[];
    behaviorHints?: {
      adult?: boolean;
      p2p?: boolean;
      configurable?: boolean;
      configurationRequired?: boolean;
    };
  };
  transportUrl: string;
};

export type CatalogExtra = { name: string; value: string };

export type AddonCatalogCursor = {
  base: string;
  type: string;
  id: string;
  extras?: CatalogExtra[];
};

export type AddonRow = {
  key: string;
  type: string;
  name: string;
  metas: Meta[];
  more?: AddonCatalogCursor;
};

export function addonAccepts(addon: Addon, resource: string, type: string, id: string): boolean {
  const m = addon.manifest;
  const resources = m.resources ?? [];
  const specific = resources.filter(
    (r): r is { name: string; types?: string[]; idPrefixes?: string[] } =>
      typeof r === "object" && r.name === resource,
  );
  if (specific.length > 0) {
    return specific.some((r) => {
      const typeOk = Array.isArray(r.types) && r.types.includes(type);
      const idOk =
        !r.idPrefixes || r.idPrefixes.length === 0 || r.idPrefixes.some((p) => id.startsWith(p));
      return typeOk && idOk;
    });
  }
  if (!resources.some((r) => r === resource)) return false;
  if (!m.types || !m.types.includes(type)) return false;
  if (m.idPrefixes && m.idPrefixes.length > 0 && !m.idPrefixes.some((p) => id.startsWith(p))) {
    return false;
  }
  return true;
}

async function call<T>(path: string, body: object): Promise<T | null> {
  try {
    const res = await fetch(`${STREMIO_API}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return (json.result ?? null) as T | null;
  } catch {
    return null;
  }
}

export async function userAddons(authKey: string): Promise<Addon[]> {
  const result = await call<{ addons: Addon[] }>("addonCollectionGet", {
    authKey,
    type: "user",
    update: false,
  });
  return result?.addons ?? [];
}

export async function setUserAddons(authKey: string, addons: Addon[]): Promise<boolean> {
  const result = await call<{ success?: boolean }>("addonCollectionSet", {
    authKey,
    type: "user",
    addons: addons.map((a) => {
      const raw = a as Record<string, unknown>;
      return {
        transportUrl: a.transportUrl,
        transportName: typeof raw.transportName === "string" ? raw.transportName : "",
        manifest: a.manifest,
        flags: (raw.flags as { official?: boolean; protected?: boolean } | undefined) ?? {
          official: false,
          protected: false,
        },
      };
    }),
  });
  return result != null;
}

export async function getUserAddonsRaw(authKey: string): Promise<Addon[] | null> {
  const result = await call<{ addons: Addon[] }>("addonCollectionGet", {
    authKey,
    type: "user",
    update: false,
  });
  if (!result || !Array.isArray(result.addons)) return null;
  return result.addons;
}

export async function setUserAddonsRaw(authKey: string, addons: Addon[]): Promise<boolean> {
  if (addons.length === 0) return false;
  const result = await call<{ success?: boolean }>("addonCollectionSet", {
    authKey,
    type: "user",
    addons,
  });
  return result != null;
}

const STRIP_WORDS = ["movies", "movie", "series", "shows", "show", "tv shows", "tv"];

export function normalizeName(name: string, type: string): string {
  let n = (name ?? "").toLowerCase();
  for (const w of STRIP_WORDS) {
    n = n.replace(new RegExp(`\\b${w}\\b`, "g"), "");
  }
  n = n.replace(/[^a-z0-9]+/g, " ").trim();
  return `${n}::${type ?? ""}`;
}

async function fetchWithTimeout(url: string, timeoutMs = 8000): Promise<Response | null> {
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ac.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export type DebridKeySet = {
  rdKey?: string;
  tbKey?: string;
  adKey?: string;
  pmKey?: string;
  dlKey?: string;
};

export function torrentioConfigFor(keys: DebridKeySet): string {
  const parts: string[] = [];
  if (keys.tbKey) parts.push(`torbox=${keys.tbKey.trim()}`);
  if (keys.rdKey) parts.push(`realdebrid=${keys.rdKey.trim()}`);
  if (keys.adKey) parts.push(`alldebrid=${keys.adKey.trim()}`);
  if (keys.pmKey) parts.push(`premiumize=${keys.pmKey.trim()}`);
  if (keys.dlKey) parts.push(`debridlink=${keys.dlKey.trim()}`);
  return parts.join("|");
}

export function torrentioAddonFor(keys: DebridKeySet): Addon {
  const config = torrentioConfigFor(keys);
  const transport = config
    ? `https://torrentio.strem.fun/${config}/manifest.json`
    : "https://torrentio.strem.fun/manifest.json";
  return {
    transportUrl: transport,
    manifest: {
      id: "com.stremio.torrentio.addon",
      name: "Torrentio",
      logo: "https://torrentio.strem.fun/images/logo_v1.png",
      resources: ["stream"],
      types: ["movie", "series"],
      idPrefixes: ["tt", "kitsu"],
    },
  };
}

export function torrentioBareAddon(): Addon {
  return {
    transportUrl: "https://torrentio.strem.fun/manifest.json",
    manifest: {
      id: "com.stremio.torrentio.bare",
      name: "Torrentio",
      logo: "https://torrentio.strem.fun/images/logo_v1.png",
      resources: ["stream"],
      types: ["movie", "series"],
      idPrefixes: ["tt", "kitsu"],
    },
  };
}

export function torboxAddonFor(tbKey: string): Addon | null {
  const k = tbKey.trim();
  if (!k) return null;
  return {
    transportUrl: `https://stremio.torbox.app/${k}/manifest.json`,
    manifest: {
      id: "app.torbox.stremio",
      name: "TorBox",
      logo: "https://torbox.app/android-chrome-512x512.png",
      resources: ["stream"],
      types: ["movie", "series", "anime"],
      idPrefixes: ["tt", "kitsu", "mal", "tmdb", "anidb", "anilist", "anime-planet"],
    },
  };
}

export function withDebridKeys(addons: Addon[], keys: DebridKeySet): Addon[] {
  const config = torrentioConfigFor(keys);
  const torrentioCount = addons.filter(
    (a) => a.manifest.id === "com.stremio.torrentio.addon",
  ).length;
  return addons.map((a) => {
    if (a.manifest.id !== "com.stremio.torrentio.addon") return a;
    if (torrentioCount > 1) return a;
    if (!/torrentio\.strem\.fun\/manifest\.json$/.test(a.transportUrl)) return a;
    return {
      ...a,
      transportUrl: config
        ? `https://torrentio.strem.fun/${config}/manifest.json`
        : "https://torrentio.strem.fun/manifest.json",
    };
  });
}

export async function gatherCatalogAddons(authKey: string | null): Promise<Addon[]> {
  const stremioRaw = authKey ? await userAddons(authKey).catch(() => [] as Addon[]) : [];
  const stremio = filterEnabled(stremioRaw);
  const seen = new Set(stremio.map((a) => a.transportUrl));
  const localOnly = filterEnabled(loadInstalled()).filter((l) => !seen.has(l.transportUrl));
  const localFull = await Promise.all(
    localOnly.map(async (l): Promise<Addon | null> => {
      if (l.manifest?.catalogs?.length)
        return { manifest: l.manifest, transportUrl: l.transportUrl };
      const manifest = await fetchManifestAt(l.transportUrl).catch(() => l.manifest ?? null);
      return manifest ? { manifest, transportUrl: l.transportUrl } : null;
    }),
  );
  return [...stremio, ...localFull.filter((a): a is Addon => a != null)];
}

const NON_CONTENT_TYPES = new Set(["addon_catalog"]);

function requiredCatalogExtras(cat: CatalogDef): Array<{ name: string; value: string }> | null {
  const required = (cat.extra ?? []).filter((e) => e.isRequired);
  const out: Array<{ name: string; value: string }> = [];
  for (const e of required) {
    if (e.name === "search") return null;
    const opt = e.options?.[0];
    if (!opt) return null;
    out.push({ name: e.name, value: opt });
  }
  return out;
}

function catalogRequestUrl(base: string, cat: CatalogDef): string | null {
  const extras = requiredCatalogExtras(cat);
  if (extras === null) return null;
  if (extras.length === 0) return `${base}/catalog/${cat.type}/${cat.id}.json`;
  const parts = extras.map((e) => `${encodeURIComponent(e.name)}=${encodeURIComponent(e.value)}`);
  return `${base}/catalog/${cat.type}/${cat.id}/${parts.join("&")}.json`;
}

export async function loadAddonRows(
  authKey: string | null,
  opts: { dedup?: boolean; cap?: number } = {},
): Promise<AddonRow[]> {
  const dedup = opts.dedup ?? true;
  const cap = opts.cap ?? (dedup ? MAX_ROWS : 200);
  const addons = await gatherCatalogAddons(authKey);
  const tasks = addons.flatMap((addon) =>
    (addon.manifest.catalogs ?? [])
      .filter((c) => c && c.name && c.type && c.id && !NON_CONTENT_TYPES.has(c.type.toLowerCase()))
      .map(async (cat): Promise<AddonRow | null> => {
        const base = addon.transportUrl.replace(/\/manifest\.json$/, "");
        const url = catalogRequestUrl(base, cat);
        if (!url) return null;
        const res = await fetchWithTimeout(url);
        if (!res || !res.ok) return null;
        try {
          const json = await res.json();
          const raw: Meta[] = json.metas ?? [];
          if (raw.length === 0) return null;
          const origin = {
            id: addon.manifest.id,
            name: addon.manifest.name,
            logo: addon.manifest.logo,
            base,
          };
          const metas: Meta[] = raw.map((m) => ({ ...m, addonOrigin: origin }));
          return {
            key: `${addon.manifest.id}-${cat.type}-${cat.id}`,
            type: cat.type,
            name: cat.name,
            metas,
            more: {
              base,
              type: cat.type,
              id: cat.id,
              extras: requiredCatalogExtras(cat) ?? undefined,
            },
          };
        } catch {
          return null;
        }
      }),
  );
  const results = await Promise.all(tasks);
  if (!dedup) {
    const out: AddonRow[] = [];
    for (const r of results) {
      if (r) out.push(r);
    }
    return out.slice(0, cap);
  }
  const seen = new Set<string>();
  const deduped: AddonRow[] = [];
  for (const r of results) {
    if (!r) continue;
    const key = normalizeName(r.name, r.type);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }
  return deduped.slice(0, cap);
}

export async function fetchAddonMeta(base: string, type: string, id: string): Promise<Meta | null> {
  const res = await fetchWithTimeout(`${base}/meta/${type}/${encodeURIComponent(id)}.json`);
  if (!res || !res.ok) return null;
  try {
    const json = await res.json();
    return (json.meta ?? null) as Meta | null;
  } catch {
    return null;
  }
}

export async function fetchAddonCatalogPage(
  base: string,
  type: string,
  id: string,
  skip: number,
  extras?: Array<{ name: string; value: string }>,
): Promise<Meta[]> {
  const parts: string[] = [];
  for (const e of extras ?? [])
    parts.push(`${encodeURIComponent(e.name)}=${encodeURIComponent(e.value)}`);
  if (skip > 0) parts.push(`skip=${skip}`);
  const seg = parts.length ? `/${parts.join("&")}` : "";
  const res = await fetchWithTimeout(`${base}/catalog/${type}/${id}${seg}.json`);
  if (!res || !res.ok) return [];
  try {
    const json = await res.json();
    return (json.metas ?? []) as Meta[];
  } catch {
    return [];
  }
}

const DEFAULT_CATALOG_PAGE_SIZE = 20;

export function createAddonCatalogFetcher(
  cursor: AddonCatalogCursor,
  opts: { initialPageSize?: number; mapMeta?: (meta: Meta) => Meta } = {},
): (page: number) => Promise<Meta[]> {
  let pageSize = opts.initialPageSize && opts.initialPageSize > 0 ? opts.initialPageSize : null;
  return async (page: number): Promise<Meta[]> => {
    const step = pageSize ?? DEFAULT_CATALOG_PAGE_SIZE;
    const skip = page <= 1 ? 0 : (page - 1) * step;
    const metas = await fetchAddonCatalogPage(
      cursor.base,
      cursor.type,
      cursor.id,
      skip,
      cursor.extras,
    );
    if (metas.length > 0 && pageSize == null) pageSize = metas.length;
    return opts.mapMeta ? metas.map(opts.mapMeta) : metas;
  };
}

const TMDB_PROVIDER_ID_PATTERNS: RegExp[] = [
  /^com\.aio\.metadata$/i,
  /tmdb/i,
  /^com\.stremio\.streaming-catalogs$/i,
];

export function hasTmdbProviderAddon(addons: Addon[]): boolean {
  return addons.some((a) => {
    const id = a.manifest?.id ?? "";
    const name = a.manifest?.name ?? "";
    return TMDB_PROVIDER_ID_PATTERNS.some((re) => re.test(id) || re.test(name));
  });
}
