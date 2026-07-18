import { safeFetch as fetch } from "@/lib/safe-fetch";
import type { Addon } from "@/lib/addons";
import { dlog, dwarn } from "@/lib/debug";
import { isAddonRanked, isStatusOnlyAddon } from "./addon-detect";
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

function timeoutFor(addon: Addon): number {
  const name = addon.manifest.name ?? "";
  const id = addon.manifest.id ?? "";
  const url = addon.transportUrl ?? "";
  const slow = SLOW_ADDON_PATTERNS.some((re) => re.test(name) || re.test(id) || re.test(url));
  return slow ? TIMEOUT_MS_SLOW : TIMEOUT_MS_FAST;
}

export type StreamRequest = {
  type: string;
  ids: string[];
};

export async function fetchAddonStreams(
  addons: Addon[],
  req: StreamRequest,
  signal: AbortSignal,
  onPartial?: (current: Stream[]) => void,
): Promise<Stream[]> {
  const namedTasks: Array<{ name: string; p: Promise<Stream[]> }> = [];
  const skipped: string[] = [];
  for (let i = 0; i < addons.length; i++) {
    const addon = addons[i];
    const priority = i;
    if (isStatusOnlyAddon(addon)) {
      skipped.push(`${addon.manifest.name}(status-addon)`);
      continue;
    }
    const ids = pickIds(addon, req.type, req.ids);
    if (ids.length === 0) {
      skipped.push(`${addon.manifest.name}(no-matching-id)`);
      continue;
    }
    for (const id of ids) {
      const name = ids.length > 1 ? `${addon.manifest.name}[${idScheme(id)}]` : addon.manifest.name;
      namedTasks.push({
        name,
        p: fetchOne(addon, req.type, id, signal).then((ss) =>
          ss.map((s, idx) => ({ ...s, addonPriority: priority, addonReturnIdx: idx })),
        ),
      });
    }
  }
  if (skipped.length > 0) console.info(`[addons] skipped: ${skipped.join(", ")}`);
  console.info(
    `[addons] querying ${namedTasks.length}: ${namedTasks.map((t) => t.name).join(", ")}`,
  );

  const accumulated: Stream[] = [];
  const wrapped = namedTasks.map(({ name, p }) =>
    p
      .then((streams) => {
        console.info(`[addons] ${name}: ${streams.length} streams`);
        accumulated.push(...streams);
        if (onPartial) onPartial(accumulated.slice());
      })
      .catch((e) => {
        if (!signal.aborted) dwarn(`[addons] ${name} failed`, e);
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

function idScheme(id: string): string {
  return id.startsWith("tt") ? "imdb" : id.split(":")[0];
}

function pickIds(addon: Addon, type: string, ids: string[]): string[] {
  const sorted = [...ids].sort((a, b) => idPriority(a) - idPriority(b));
  const accepted = sorted.filter((id) => addonAcceptsId(addon, type, id));
  if (accepted.length === 0) return [];
  const animeId = accepted.find((id) => ANIME_SCHEMES.some((s) => id.startsWith(s)));
  const ttId = accepted.find((id) => id.startsWith("tt"));
  if (animeId && ttId) return [animeId, ttId];
  return [accepted[0]];
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

async function fetchOne(
  addon: Addon,
  type: string,
  id: string,
  signal: AbortSignal,
): Promise<Stream[]> {
  const base = addon.transportUrl.replace(/\/manifest\.json$/, "");
  const url = `${base}/stream/${type}/${id}.json`;
  const limit = timeoutFor(addon);
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
      dwarn(`[addons] ${addon.manifest.name} returned ${res.status} for ${type}/${id}`);
      return [];
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
          if (mapped.fileIdx == null && fromUrl?.fileIdx != null) mapped.fileIdx = fromUrl.fileIdx;
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
    return [];
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onParentAbort);
    const elapsed = Math.round(performance.now() - startedAt);
    if (elapsed > 2500 && !timedOut) {
      dlog(`[addons] ${addon.manifest.name} took ${elapsed}ms`);
    }
  }
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
