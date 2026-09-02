import { safeFetch as fetch } from "@/lib/safe-fetch";
import type { Addon } from "@/lib/addons";
import { dlog, dwarn } from "@/lib/debug";
import { isAddonRanked, isStatusOnlyAddon } from "./addon-detect";
import type { AddonRankFn } from "./addon-priority";
import { hasUncachedMarker } from "./cached";
import { infoHashFromSources, infoHashFromUrl } from "@/lib/torrent/magnet";
import type { Stream } from "./types";

const TIMEOUT_MS_FAST = 8000;
const TIMEOUT_MS_SLOW = 22000;
const SLOW_ADDON_PATTERNS = [
  /mediafusion/i,
  /comet/i,
  /torrentio/i,
  /knightcrawler/i,
  /aiostreams/i,
  /jackettio/i,
  /torbox/i,
];

function timeoutFor(addon: Addon, ceilingMs: number): number {
  const name = addon.manifest.name ?? "";
  const id = addon.manifest.id ?? "";
  const url = addon.transportUrl ?? "";
  const slow = SLOW_ADDON_PATTERNS.some((re) => re.test(name) || re.test(id) || re.test(url));
  const base = slow ? TIMEOUT_MS_SLOW : TIMEOUT_MS_FAST;
  return Math.max(base, ceilingMs);
}

export type StreamRequest = {
  type: string;
  ids: string[];
  animeIdUnverified?: boolean;
};

export type AddonProgress = {
  settled: number;
  total: number;
  queriedAddonIds: string[];
  settledAddonIds: string[];
};

export async function fetchAddonStreams(
  addons: Addon[],
  req: StreamRequest,
  signal: AbortSignal,
  onPartial?: (current: Stream[]) => void,
  onProgress?: (progress: AddonProgress) => void,
  timeoutMs = TIMEOUT_MS_SLOW,
  ranks?: AddonRankFn | null,
  forced?: Array<{ base: string; id: string }>,
): Promise<Stream[]> {
  const forcedBases = new Map((forced ?? []).map((f) => [f.base, f.id]));
  const namedTasks: Array<{ addonId: string; name: string; p: Promise<Stream[]> }> = [];
  const skipped: string[] = [];
  for (let i = 0; i < addons.length; i++) {
    const addon = addons[i];
    const priority = ranks ? ranks(i, addon) : i;
    if (isStatusOnlyAddon(addon)) {
      skipped.push(`${addon.manifest.name}(status-addon)`);
      continue;
    }
    const forcedId = forcedBases.get(addon.transportUrl.replace(/\/manifest\.json$/, ""));
    const ids =
      forcedId != null
        ? [forcedId]
        : pickIds(addon, req.type, req.ids, req.animeIdUnverified === true);
    if (ids.length > 0) {
      for (const id of ids) {
        // Local lists only persist movie/series, which can drop the type an addon's
        // catalog declared for non-standard id schemes. Retry the other declared
        // types when the primary query comes back empty.
        const altTypes =
          forcedId != null || !hasStandardIdScheme(id)
            ? alternateStreamTypes(addon, req.type, id)
            : [];
        const name =
          ids.length > 1 ? `${addon.manifest.name}[${idScheme(id)}]` : addon.manifest.name;
        namedTasks.push({
          addonId: addon.manifest.id,
          name,
          p: fetchOne(addon, req.type, id, signal, timeoutMs, altTypes).then((ss) =>
            ss.map((s, idx) => ({ ...s, addonPriority: priority, addonReturnIdx: idx })),
          ),
        });
      }
      continue;
    }

    // No (type, id) pair matched the request, but a non-standard id may still be
    // served under a type the catalog declared. Query those types directly.
    const anyType = pickIdByDeclaredTypes(addon, req.ids);
    if (anyType == null) {
      skipped.push(`${addon.manifest.name}(no-matching-id)`);
      continue;
    }
    const { id, types } = anyType;
    namedTasks.push({
      addonId: addon.manifest.id,
      name: `${addon.manifest.name}[${idScheme(id)}]`,
      p: fetchOne(addon, types[0], id, signal, timeoutMs, types.slice(1)).then((ss) =>
        ss.map((s, idx) => ({ ...s, addonPriority: priority, addonReturnIdx: idx })),
      ),
    });
  }
  if (skipped.length > 0) console.info(`[addons] skipped: ${skipped.join(", ")}`);
  console.info(
    `[addons] querying ${namedTasks.length}: ${namedTasks.map((t) => t.name).join(", ")}`,
  );

  const total = namedTasks.length;
  const pendingByAddon = new Map<string, number>();
  for (const task of namedTasks) {
    pendingByAddon.set(task.addonId, (pendingByAddon.get(task.addonId) ?? 0) + 1);
  }
  const queriedAddonIds = [...pendingByAddon.keys()];
  const settledAddonIds = new Set<string>();
  let settled = 0;
  const reportProgress = () =>
    onProgress?.({
      settled,
      total,
      queriedAddonIds,
      settledAddonIds: [...settledAddonIds],
    });
  reportProgress();
  const accumulated: Stream[] = [];
  const wrapped = namedTasks.map(({ addonId, name, p }) =>
    p
      .then((streams) => {
        console.info(`[addons] ${name}: ${streams.length} streams`);
        accumulated.push(...streams);
        if (onPartial) onPartial(accumulated.slice());
      })
      .catch((e) => {
        if (!signal.aborted) dwarn(`[addons] ${name} failed`, e);
      })
      .finally(() => {
        settled += 1;
        const remaining = (pendingByAddon.get(addonId) ?? 1) - 1;
        if (remaining <= 0) {
          pendingByAddon.delete(addonId);
          settledAddonIds.add(addonId);
        } else {
          pendingByAddon.set(addonId, remaining);
        }
        reportProgress();
      }),
  );

  await Promise.allSettled(wrapped);
  return dedupeStreams(accumulated);
}

export function addonSupportsStream(addon: Addon, req: StreamRequest): boolean {
  return pickId(addon, req.type, req.ids) != null;
}

const PREFIX_PRIORITY = ["kitsu", "mal", "anidb", "anilist", "tt", "tmdb"];

function idPriority(id: string): number {
  for (let i = 0; i < PREFIX_PRIORITY.length; i++) {
    if (id.startsWith(PREFIX_PRIORITY[i])) return i;
  }
  return 999;
}

function pickId(addon: Addon, type: string, ids: string[]): string | null {
  const sorted = [...ids].sort((a, b) => idPriority(a) - idPriority(b));
  for (const id of sorted) {
    if (addonAcceptsId(addon, type, id)) return id;
  }
  return null;
}

const ANIME_SCHEMES = ["kitsu", "mal", "anidb", "anilist"];

const STANDARD_ID_SCHEMES = [
  "tt",
  "tmdb:",
  "kitsu:",
  "mal:",
  "anidb:",
  "anilist:",
  "tvdb:",
  "simkl:",
];

function idScheme(id: string): string {
  return id.startsWith("tt") ? "imdb" : id.split(":")[0];
}

const SPECIALS_SCOPED_TT_RX = /^tt\d+:0:\d+$/;

function hasStandardIdScheme(id: string): boolean {
  return STANDARD_ID_SCHEMES.some((p) => id.startsWith(p));
}

function pickIds(
  addon: Addon,
  type: string,
  ids: string[],
  animeIdUnverified = false,
): string[] {
  const sorted = [...ids].sort((a, b) => idPriority(a) - idPriority(b));
  const accepted = sorted.filter((id) => addonAcceptsId(addon, type, id));
  if (accepted.length === 0) return [];
  const animeId = accepted.find((id) => ANIME_SCHEMES.some((s) => id.startsWith(s)));
  const ttId = accepted.find((id) => id.startsWith("tt"));
  if (!animeId || !ttId) return [accepted[0]];
  // Specials have no reliable kitsu numbering, so both identities stay.
  if (SPECIALS_SCOPED_TT_RX.test(ttId)) return [animeId, ttId];
  if (animeIdUnverified) return [ttId];
  return [animeId];
}

function pickIdByDeclaredTypes(
  addon: Addon,
  ids: string[],
): { id: string; types: string[] } | null {
  const sorted = [...ids].sort((a, b) => idPriority(a) - idPriority(b));
  for (const id of sorted) {
    const types = streamTypesAcceptingId(addon, id);
    if (types.length > 0) return { id, types };
  }
  return null;
}

function streamTypesAcceptingId(addon: Addon, id: string): string[] {
  const m = addon.manifest;
  const resources = m.resources ?? [];
  const streamResources = resources.filter(
    (r): r is { name: string; types?: string[]; idPrefixes?: string[] } =>
      typeof r === "object" && r.name === "stream",
  );
  const out = new Set<string>();
  if (streamResources.length > 0) {
    for (const r of streamResources) {
      const idOk =
        !r.idPrefixes || r.idPrefixes.length === 0 || r.idPrefixes.some((p) => id.startsWith(p));
      if (!idOk) continue;
      for (const t of r.types ?? []) out.add(t);
    }
    return Array.from(out);
  }
  if (!resources.some((r) => r === "stream")) return [];
  const idOk =
    !m.idPrefixes || m.idPrefixes.length === 0 || m.idPrefixes.some((p) => id.startsWith(p));
  if (!idOk) return [];
  return Array.from(m.types ?? []);
}

function addonAcceptsId(addon: Addon, type: string, id: string): boolean {
  const m = addon.manifest;
  const resources = m.resources ?? [];
  const streamResources = resources.filter(
    (r): r is { name: string; types?: string[]; idPrefixes?: string[] } =>
      typeof r === "object" && r.name === "stream",
  );
  if (streamResources.length > 0) {
    return streamResources.some((r) => {
      const typeOk = Array.isArray(r.types) && r.types.includes(type);
      const idOk =
        !r.idPrefixes || r.idPrefixes.length === 0 || r.idPrefixes.some((p) => id.startsWith(p));
      return typeOk && idOk;
    });
  }
  if (!resources.some((r) => r === "stream")) return false;
  if (!m.types || !m.types.includes(type)) return false;
  if (m.idPrefixes && m.idPrefixes.length > 0 && !m.idPrefixes.some((p) => id.startsWith(p))) {
    return false;
  }
  return true;
}

function alternateStreamTypes(addon: Addon, type: string, id: string): string[] {
  return streamTypesAcceptingId(addon, id).filter((t) => t !== type);
}

async function fetchOne(
  addon: Addon,
  type: string,
  id: string,
  signal: AbortSignal,
  timeoutMs: number,
  altTypes: string[] = [],
): Promise<Stream[]> {
  const base = addon.transportUrl.replace(/\/manifest\.json$/, "");
  const limit = timeoutFor(addon, timeoutMs);

  const queryOnce = async (t: string): Promise<Stream[] | null> => {
    const url = `${base}/stream/${t}/${id}.json`;
    const ac = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      ac.abort();
    }, limit);
    const onParentAbort = () => ac.abort();
    signal.addEventListener("abort", onParentAbort);
    const startedAt = performance.now();
    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json, text/plain, */*",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        },
        signal: ac.signal,
      });
      if (!res.ok) {
        dwarn(`[addons] ${addon.manifest.name} returned ${res.status} for ${t}/${id}`);
        return null;
      }
      const json = (await res.json()) as { streams?: RawStream[] };
      const list = json.streams ?? [];
      const ranked = isAddonRanked(addon);
      return list.map((s) => {
        const mapped = {
          ...s,
          infoHash: s.infoHash?.toLowerCase(),
          addonId: addon.manifest.id,
          addonName: addon.manifest.name,
          addonUrl: addon.transportUrl,
          addonRanked: ranked,
        };
        if (!mapped.infoHash && hasUncachedMarker(s)) {
          const fromUrl = s.url ? infoHashFromUrl(s.url) : null;
          const hash = fromUrl?.infoHash ?? infoHashFromSources(s.sources);
          if (hash) {
            mapped.infoHash = hash;
            if (mapped.fileIdx == null && fromUrl?.fileIdx != null)
              mapped.fileIdx = fromUrl.fileIdx;
          }
        }
        return mapped;
      });
    } catch (e) {
      if (timedOut) {
        dwarn(`[addons] ${addon.manifest.name} timed out after ${limit}ms — dropped`);
      } else if (!signal.aborted) {
        dwarn(`[addons] ${addon.manifest.name} failed`, e);
      }
      return null;
    } finally {
      clearTimeout(timer);
      signal.removeEventListener("abort", onParentAbort);
      const elapsed = Math.round(performance.now() - startedAt);
      if (elapsed > 2500 && !timedOut) {
        dlog(`[addons] ${addon.manifest.name} took ${elapsed}ms`);
      }
    }
  };

  const primary = await queryOnce(type);
  if (primary == null || primary.length > 0 || altTypes.length === 0) return primary ?? [];
  const settled = await Promise.allSettled(altTypes.map((t) => queryOnce(t)));
  for (const r of settled) {
    if (r.status === "fulfilled" && r.value && r.value.length > 0) return r.value;
  }
  return [];
}

function dedupeStreams(streams: Stream[]): Stream[] {
  const seen = new Map<string, Stream>();
  for (const s of streams) {
    const baseKey = s.infoHash
      ? `hash:${s.infoHash}:${s.fileIdx ?? ""}`
      : `url:${s.url ?? s.title ?? s.name ?? Math.random().toString(36)}`;
    const key = `${s.addonId}:${baseKey}`;
    const prior = seen.get(key);
    if (!prior) {
      seen.set(key, s);
      continue;
    }
    if (s.sources && s.sources.length > 0) {
      const merged = new Set([...(prior.sources ?? []), ...s.sources]);
      prior.sources = [...merged];
    }
  }
  return [...seen.values()];
}

type RawStream = Omit<Stream, "addonId" | "addonName">;
