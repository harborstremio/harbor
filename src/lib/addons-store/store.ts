import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import type { Addon } from "@/lib/addons";
import { useAuth } from "@/lib/auth";
import { userAddons } from "@/lib/addons";
import { fetchInstalledAddons } from "@/lib/addon-store";
import { listAddons } from "@/lib/providers/stremio-addons";
import { queryKeys } from "@/lib/query/keys";
import { isAdultText } from "./adult-filter";
import { fetchCommunityAddons, fetchManifest } from "./community";
import { CURATED_ADDONS, type CuratedEntry } from "./curated";

const ALWAYS_HIDDEN_IDS = new Set<string>(["org.stremio.opensubtitles", "com.opensubtitles.v3"]);

function normalizeAddonName(name: string | undefined): string {
  if (!name) return "";
  return name
    .toLowerCase()
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\|.*$/g, "")
    .replace(
      /\b(rd|tb|ad|premiumize|debrid|elfhosted|community|official|free|paid|sponsored|by\s+\S+)\b/g,
      "",
    )
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

export type ResolvedAddon = {
  curated?: CuratedEntry;
  manifest: Addon["manifest"] | null;
  transportUrl: string;
  source: "curated" | "community" | "stremio-user" | "harbor-local";
  installed: boolean;
};

type BaseCatalog = {
  map: Map<string, ResolvedAddon>;
  installed: Set<string>;
  saManifestById: Map<string, Addon["manifest"]>;
  saIds: Set<string>;
  /** Curated transport URLs whose manifest the directory did not cover. */
  needingFetch: string[];
};

/** Merge installed + directory lists into the base catalog (pure, no manifest fetches). */
function mergeBaseCatalog(
  local: Addon[],
  stremio: Addon[],
  community: Addon[],
  saList: Addon[],
): BaseCatalog {
  const installed = new Set<string>([
    ...local.map((a) => a.manifest.id),
    ...stremio.map((a) => a.manifest.id),
  ]);

  const map = new Map<string, ResolvedAddon>();

  for (const e of CURATED_ADDONS) {
    map.set(e.id, {
      curated: e,
      manifest: null,
      transportUrl: e.transportUrl,
      source: "curated",
      installed: installed.has(e.id),
    });
  }

  for (const a of stremio) {
    const existing = map.get(a.manifest.id);
    map.set(a.manifest.id, {
      curated: existing?.curated,
      manifest: a.manifest,
      transportUrl: a.transportUrl,
      source: existing ? existing.source : "stremio-user",
      installed: true,
    });
  }
  for (const a of local) {
    const existing = map.get(a.manifest.id);
    map.set(a.manifest.id, {
      curated: existing?.curated,
      manifest: a.manifest,
      transportUrl: a.transportUrl,
      source: existing ? existing.source : "harbor-local",
      installed: true,
    });
  }

  const saIds = new Set<string>();
  const saManifestById = new Map<string, Addon["manifest"]>();
  for (const a of saList) {
    const id = a.manifest?.id;
    if (id) {
      saIds.add(id);
      saManifestById.set(id, a.manifest);
    }
  }
  const mergedCommunity: Addon[] = [];
  const seenCommunityIds = new Set<string>();
  for (const a of [...saList, ...community]) {
    const id = a.manifest?.id;
    if (!id || seenCommunityIds.has(id)) continue;
    seenCommunityIds.add(id);
    mergedCommunity.push(a);
  }
  const byTransportUrl = new Map<string, string>();
  for (const [id, r] of map) byTransportUrl.set(r.transportUrl.toLowerCase(), id);

  for (const a of mergedCommunity) {
    const realId = a.manifest.id;
    const url = a.transportUrl;
    const existingIdByUrl = byTransportUrl.get(url.toLowerCase());
    if (existingIdByUrl && existingIdByUrl !== realId) {
      const existing = map.get(existingIdByUrl)!;
      existing.manifest = a.manifest;
      map.delete(existingIdByUrl);
      map.set(realId, {
        ...existing,
        manifest: a.manifest,
        transportUrl: url,
        installed: existing.installed || installed.has(realId),
      });
      byTransportUrl.set(url.toLowerCase(), realId);
      continue;
    }
    if (!map.has(realId)) {
      map.set(realId, {
        manifest: a.manifest,
        transportUrl: url,
        source: "community",
        installed: installed.has(realId),
      });
      byTransportUrl.set(url.toLowerCase(), realId);
    } else {
      const existing = map.get(realId)!;
      if (!existing.manifest) existing.manifest = a.manifest;
    }
  }

  const needingFetch = [...map.values()]
    .filter((r) => !r.manifest && r.source === "curated")
    .map((r) => r.transportUrl);

  return { map, installed, saManifestById, saIds, needingFetch };
}

/** Apply fetched manifests, rekey by real ids, dedupe, and filter (idempotent). */
function finalizeCatalog(
  base: BaseCatalog,
  manifestByUrl: Map<string, Addon["manifest"]>,
  adultsAllowed: boolean,
): Map<string, ResolvedAddon> {
  const { installed, saManifestById, saIds } = base;
  const map = new Map(base.map);

  for (const [, r] of map) {
    if (!r.manifest && r.source === "curated") {
      const m = manifestByUrl.get(r.transportUrl);
      if (m) r.manifest = m;
    }
  }

  const reKeyed = new Map<string, ResolvedAddon>();
  for (const [oldKey, r] of map) {
    const realId = r.manifest?.id;
    if (!realId || realId === oldKey) {
      reKeyed.set(oldKey, r);
      continue;
    }
    const existing = reKeyed.get(realId);
    if (existing) {
      existing.curated = existing.curated ?? r.curated;
      existing.installed = existing.installed || r.installed || installed.has(realId);
      if (!existing.manifest) existing.manifest = r.manifest;
    } else {
      reKeyed.set(realId, { ...r, installed: r.installed || installed.has(realId) });
    }
  }
  map.clear();
  for (const [k, v] of reKeyed) map.set(k, v);

  for (const [id, r] of map) {
    const sa = saManifestById.get(id);
    if (!sa || !r.manifest) continue;
    r.manifest = {
      ...r.manifest,
      name: sa.name ?? r.manifest.name,
      logo: r.manifest.logo ?? sa.logo,
      description: sa.description ?? r.manifest.description,
      background: r.manifest.background ?? sa.background,
    };
  }

  const byNormalizedName = new Map<string, string[]>();
  for (const [id, r] of map) {
    const norm = normalizeAddonName(r.manifest?.name);
    if (!norm) continue;
    const bucket = byNormalizedName.get(norm) ?? [];
    bucket.push(id);
    byNormalizedName.set(norm, bucket);
  }
  for (const [, ids] of byNormalizedName) {
    if (ids.length <= 1) continue;
    const installedInBucket = ids.filter((id) => map.get(id)?.installed);
    if (installedInBucket.length > 0) {
      for (const id of ids) if (!map.get(id)?.installed) map.delete(id);
      continue;
    }
    const curatedIds = ids.filter((id) => map.get(id)?.curated);
    const saIdsHit = ids.filter((id) => saIds.has(id));
    const winner = curatedIds[0] ?? saIdsHit[0] ?? ids[0];
    for (const id of ids) if (id !== winner) map.delete(id);
  }

  for (const id of ALWAYS_HIDDEN_IDS) map.delete(id);

  if (!adultsAllowed) {
    for (const [id, r] of map) {
      if (isAdultAddon(r)) map.delete(id);
    }
  }

  return map;
}

/** Installed addons from both sources, in parallel. Shared by store + prefetch. */
export async function fetchInstalledAddonsPair(authKey: string | null) {
  const [local, stremio] = await Promise.all([
    fetchInstalledAddons().catch(() => [] as Addon[]),
    authKey ? userAddons(authKey).catch(() => [] as Addon[]) : Promise.resolve([] as Addon[]),
  ]);
  return { local, stremio };
}

/** Community + stremio-addons directories, in parallel. Shared by store + prefetch. */
export async function fetchAddonsDirectory() {
  const [community, saList] = await Promise.all([
    fetchCommunityAddons().catch(() => [] as Addon[]),
    listAddons({ limit: 200, sort_by: "stars", order: "desc" })
      .then((r) =>
        r.addons.map((a): Addon => ({ manifest: a.manifest, transportUrl: a.manifestUrl })),
      )
      .catch(() => [] as Addon[]),
  ]);
  return { community, saList };
}

/**
 * Addons catalog on TanStack Query: installed + directory are cached across
 * visits, curated manifests resolve as independent queries — first paint never
 * waits on 40+ manifest requests or one slow addon host.
 */
export function useAddonsCatalog(adultsAllowed: boolean): {
  loading: boolean;
  byId: Map<string, ResolvedAddon>;
  installedIds: Set<string>;
  refetch: () => void;
} {
  const { authKey } = useAuth();
  const queryClient = useQueryClient();

  const installedQuery = useQuery({
    queryKey: queryKeys.addons.installed(authKey),
    queryFn: () => fetchInstalledAddonsPair(authKey),
    staleTime: 60_000,
  });

  const directoryQuery = useQuery({
    queryKey: queryKeys.addons.directory(),
    queryFn: fetchAddonsDirectory,
    staleTime: 60 * 60_000,
  });

  const base = useMemo(
    () =>
      mergeBaseCatalog(
        installedQuery.data?.local ?? [],
        installedQuery.data?.stremio ?? [],
        directoryQuery.data?.community ?? [],
        directoryQuery.data?.saList ?? [],
      ),
    [installedQuery.data, directoryQuery.data],
  );

  const needingFetch = base.needingFetch;
  const manifestQueries = useQueries({
    queries: needingFetch.map((url) => ({
      queryKey: queryKeys.addons.manifest(url),
      queryFn: () => fetchManifest(url),
      staleTime: 24 * 60 * 60_000,
      retry: 1,
    })),
  });

  const byId = useMemo(() => {
    const manifestByUrl = new Map<string, Addon["manifest"]>();
    for (let i = 0; i < needingFetch.length; i++) {
      const m = manifestQueries[i]?.data;
      if (m) manifestByUrl.set(needingFetch[i], m);
    }
    return finalizeCatalog(base, manifestByUrl, adultsAllowed);
  }, [base, manifestQueries, needingFetch, adultsAllowed]);

  // Install/uninstall only affects the installed set — a cheap targeted
  // refetch, not the whole directory pipeline.
  useEffect(() => {
    const onChange = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.addons.installed(authKey) });
    };
    window.addEventListener("harbor:addons-changed", onChange);
    return () => window.removeEventListener("harbor:addons-changed", onChange);
  }, [queryClient, authKey]);

  return {
    loading: installedQuery.isPending || directoryQuery.isPending,
    byId,
    installedIds: base.installed,
    refetch: () =>
      void queryClient.invalidateQueries({ queryKey: queryKeys.addons.installed(authKey) }),
  };
}

export function isAdultAddon(r: ResolvedAddon): boolean {
  if (r.curated) return r.curated.nsfw === true;
  return r.manifest?.behaviorHints?.adult === true || isAdultText(r.manifest?.id, r.manifest?.name);
}

function manifestText(r: ResolvedAddon): string {
  const m = r.manifest;
  return [m?.name ?? "", m?.description ?? "", m?.id ?? "", r.transportUrl ?? ""]
    .join(" ")
    .toLowerCase();
}

function hasResource(r: ResolvedAddon, name: string): boolean {
  const rs = r.manifest?.resources ?? [];
  return rs.some((x) => (typeof x === "string" ? x === name : x.name === name));
}

const ANIME_RX =
  /\banime\b|\bkitsu\b|\bmal\b|\bjikan\b|\bmyanimelist\b|\banidb\b|\banilist\b|\bmanga\b/i;
const SPORTS_RX =
  /\bsports?\b|\bnfl\b|\bnba\b|\bnhl\b|\bmlb\b|\bsoccer\b|\bfootball\b|\bf1\b|\bformula\s*1\b|\bcricket\b|\bbasketball\b|\bufc\b|\bmma\b|\bwwe\b|\bdazn\b|\besports?\b|\bsporttv\b|\bdaddylive\b/i;
const LIVE_TV_RX =
  /\biptv\b|\blive\s*tv\b|\bchannel\b|\bm3u\b|\bplutotv\b|\bpluto\.tv\b|\busatv\b|\bota\b|\bbroadcast\b/i;
const DEBRID_RX =
  /\bdebrid\b|\brealdebrid\b|\breal-debrid\b|\btorbox\b|\balldebrid\b|\bpremiumize\b|\bdebridlink\b|\beasydebrid\b|\boffcloud\b|\bmediafusion\b|\bcomet\b|\btorrentio\b|\bjackettio\b|\bknightcrawler\b|\baiostreams\b|\bstreamfusion\b/i;
const USENET_RX = /\busenet\b|\bnzb\b|\beasynews\b|\bsabnzbd\b|\bnzbget\b/i;
const SUBS_FOREIGN_RX =
  /\bsubdl\b|\bsubscene\b|\bopensubtitles\b|\bsubtitle\b|\bsubtitles\b|\bcaption\b|\bwyzie\b/i;

export function categorizeAddon(r: ResolvedAddon): string {
  if (isAdultAddon(r)) return "adult";
  if (r.curated) return r.curated.category;
  const m = r.manifest;
  if (!m) return "tools";
  const text = manifestText(r);
  const types = m.types ?? [];
  const ids = m.idPrefixes ?? [];
  const hasStream = hasResource(r, "stream");
  const hasSub = hasResource(r, "subtitles");
  const hasCatalog = hasResource(r, "catalog");
  const hasMeta = hasResource(r, "meta");

  if (
    ids.some((i) => i.startsWith("kitsu") || i.startsWith("mal") || i.startsWith("anidb")) ||
    ANIME_RX.test(text)
  ) {
    if (hasStream || hasMeta || hasCatalog) return "anime";
  }
  if (LIVE_TV_RX.test(text) || types.includes("tv") || types.includes("channel")) return "live-tv";
  if (SPORTS_RX.test(text)) return "sports";
  if (hasSub) return "subtitles";
  if (hasStream) return "streams";
  if (hasCatalog || hasMeta) return "metadata";
  return "tools";
}

export function matchesRail(r: ResolvedAddon, railId: string): boolean {
  if (isAdultAddon(r)) return false;
  if (r.curated) return r.curated.rails.includes(railId);
  const m = r.manifest;
  if (!m) return false;
  const text = manifestText(r);
  const hasStream = hasResource(r, "stream");
  const hasSub = hasResource(r, "subtitles");
  const hasCatalog = hasResource(r, "catalog");
  const hasMeta = hasResource(r, "meta");
  const ids = m.idPrefixes ?? [];

  switch (railId) {
    case "essential":
      return false;
    case "streams-debrid":
      return hasStream && DEBRID_RX.test(text);
    case "streams-free":
      return (
        hasStream &&
        !DEBRID_RX.test(text) &&
        (USENET_RX.test(text) || /\btorrent\b|\bp2p\b/i.test(text))
      );
    case "anime":
      return (
        (hasStream || hasMeta || hasCatalog) &&
        (ids.some((i) => i.startsWith("kitsu") || i.startsWith("mal") || i.startsWith("anidb")) ||
          ANIME_RX.test(text))
      );
    case "subtitles":
      return hasSub || SUBS_FOREIGN_RX.test(text);
    case "metadata":
      return (hasCatalog || hasMeta) && !hasSub && !hasStream;
    case "sports":
      return (
        SPORTS_RX.test(text) ||
        LIVE_TV_RX.test(text) ||
        (m.types ?? []).some((t) => t === "tv" || t === "channel")
      );
    default:
      return false;
  }
}

function shuffled<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildRail(
  byId: Map<string, ResolvedAddon>,
  railId: string,
  hardCap = 16,
): ResolvedAddon[] {
  const all = [...byId.values()].filter((r) => matchesRail(r, railId));
  const tier = (r: ResolvedAddon) => {
    const rec = r.curated?.recommended ?? -1;
    if (rec >= 90) return 0;
    if (rec >= 80) return 1;
    if (rec >= 70) return 2;
    if (r.curated) return 3;
    if (r.installed) return 4;
    return 5;
  };
  const groups = new Map<number, ResolvedAddon[]>();
  for (const r of all) {
    const t = tier(r);
    if (!groups.has(t)) groups.set(t, []);
    groups.get(t)!.push(r);
  }
  const out: ResolvedAddon[] = [];
  for (const t of [...groups.keys()].sort((a, b) => a - b)) {
    out.push(...shuffled(groups.get(t)!));
  }
  return out.slice(0, hardCap);
}
