import type { Addon } from "@/lib/addons";
import { dlog } from "@/lib/debug";
import type { DebridStore } from "@/lib/debrid/types";
import { fetchAddonStreams, type AddonFailure, type AddonProgress, type StreamRequest } from "./addons";
import type { AddonRankFn } from "./addon-priority";
import { applyStreamPriority } from "./priority-partition";
import { enhanceAnimeStreams } from "./anitomy";
import { partitionByExactAnimeEpisode } from "./anime-identity-core";
import { fetchLibraryStreams, type LibraryListings, type LibraryQuery } from "./library";
import { parseStream } from "./parser";
import { applyTrust, type Rejection, type TrustOptions } from "./trust";
import { computeCorpusStats, rankAndPick, scoreStream, type ScoreOptions } from "./scoring";
import type { ParsedStream, RankedPicker, Stream } from "./types";

const PREFER_AAC = typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window);

const GIB = 1024 ** 3;
const RESCUABLE_REASON_RX = /^(fresh-cinema-fake|new-release-stub)/;

function rescueCorroboratedLeaks(rejected: Rejection[], trust: TrustOptions): Set<ParsedStream> {
  const rd = trust.releaseDate ? new Date(trust.releaseDate) : null;
  if (!rd || Number.isNaN(rd.getTime())) return new Set();
  const days = (Date.now() - rd.getTime()) / 86_400_000;
  if (!(days > -90 && days < 60)) return new Set();
  const minSize = (res: string) => (res === "4K" ? 2.5 * GIB : GIB);
  const candidates = rejected.filter(
    (r) =>
      RESCUABLE_REASON_RX.test(r.reason) &&
      (r.stream.resolution === "1080p" || r.stream.resolution === "4K") &&
      r.stream.size != null &&
      r.stream.size >= minSize(r.stream.resolution),
  );
  const clusters = new Map<string, ParsedStream[]>();
  for (const r of candidates) {
    const bucket = Math.round((r.stream.size! / GIB) * 4) / 4;
    const key = `${r.stream.resolution}|${bucket}`;
    const arr = clusters.get(key);
    if (arr) arr.push(r.stream);
    else clusters.set(key, [r.stream]);
  }
  const rescued = new Set<ParsedStream>();
  for (const streams of clusters.values()) {
    const groups = new Set(streams.map((s) => s.releaseGroupNormalized).filter(Boolean));
    if (streams.length >= 3 || groups.size >= 2) {
      for (const s of streams) rescued.add(s);
    }
  }
  return rescued;
}

function finalizeWithRescue(
  picker: RankedPicker,
  rejected: Rejection[],
  trust: TrustOptions,
  score: ScoreOptions,
): { picker: RankedPicker; rejected: Rejection[] } {
  const rescued = rescueCorroboratedLeaks(rejected, trust);
  if (rescued.size === 0) return { picker, rejected };
  const keep: ParsedStream[] = [...picker.all, ...rescued];
  const corpus = computeCorpusStats(keep, score);
  const scored = keep.map((s) => scoreStream(s, score, corpus));
  const newPicker = rankAndPick(
    scored,
    score.activeDebrids,
    PREFER_AAC,
    score.respectAddonOrder === true,
  );
  dlog(`[pipeline] early-leak rescue: restored ${rescued.size} corroborated high-res stream(s)`);
  return { picker: newPicker, rejected: rejected.filter((r) => !rescued.has(r.stream)) };
}

function applyAnimeEpisodeFilter(
  parsed: ParsedStream[],
  input: PipelineInput,
): { kept: ParsedStream[]; extraRejected: Rejection[] } {
  const expected = input.animeAbsoluteEpisode;
  if (!input.isAnime || expected == null) return { kept: parsed, extraRejected: [] };
  const validNums = new Set<number>([expected]);
  for (const a of input.animeEpisodeAliases ?? []) {
    if (Number.isFinite(a) && a >= 1) validNums.add(a);
  }
  const { keep, drop } = partitionByExactAnimeEpisode(parsed, validNums);
  return {
    kept: keep,
    extraRejected: drop.map((stream) => ({
      stream,
      reason: `anime-episode-mismatch:${stream.episode}-vs-${expected}`,
    })),
  };
}

export type PipelineInput = {
  request: StreamRequest;
  query: LibraryQuery;
  addons: Addon[];
  debrids: DebridStore[];
  trust?: TrustOptions;
  score: ScoreOptions;
  isAnime?: boolean;
  animeAbsoluteEpisode?: number | null;
  animeEpisodeAliases?: Set<number> | null;
  presetStreams?: Stream[];
  addonTimeoutMs?: number;
  addonRanks?: AddonRankFn | null;
  forcedAddonBases?: Array<{ base: string; id: string }>;
};

export type DebridError = { slug: string; name: string; code: string };

export type PipelineResult = {
  picker: RankedPicker;
  rejected: Rejection[];
  raw: { addon: Stream[]; library: Stream[] };
  debridErrors?: DebridError[];
  addonErrors?: AddonFailure[];
};

// One debrid cacheCheck can fan out into many provider calls, so re-checking on
// every addon batch would hammer the APIs; a short floor keeps it to the first
// batch plus at most one refresh per interval.
const DEBRID_CHECK_MIN_INTERVAL_MS = 1500;

export async function runPipeline(
  input: PipelineInput,
  signal: AbortSignal,
  onProgress?: (partial: PipelineResult) => void,
  onAddonProgress?: (progress: AddonProgress) => void,
): Promise<PipelineResult> {
  let library: Stream[] = [];
  let lastPartialAt = 0;
  let latestAddonStreams: Stream[] = [];
  const debridErrors: DebridError[] = [];
  let addonErrors: AddonFailure[] = [];
  const priorityActive = input.addonRanks != null;

  // Debrid verification runs alongside the addon fetch instead of after it, so
  // the "Cached / In library" badges land on the early partials rather than only
  // on the final list. Results are accumulated per provider and re-applied to
  // every partial.
  const cachedBySlug = new Map<string, Record<string, true>>();
  const libraryBySlug = new Map<string, Set<string>>();
  const checkedBySlug = new Map<string, Set<string>>();
  let cacheCheckTimer: number | null = null;
  let lastCacheCheckAt = 0;

  const hashList = (streams: Stream[]): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of streams) {
      if (!s.infoHash) continue;
      const h = s.infoHash.toLowerCase();
      if (seen.has(h)) continue;
      seen.add(h);
      out.push(h);
    }
    return out;
  };

  const applyDebridFlags = (parsed: ParsedStream[]): void => {
    if (input.debrids.length === 0) return;
    for (const p of parsed) {
      if (!p.infoHash) continue;
      const h = p.infoHash.toLowerCase();
      for (const d of input.debrids) {
        const cached = cachedBySlug.get(d.slug)?.[h] === true;
        const inLibrary = libraryBySlug.get(d.slug)?.has(h) === true;
        if (!cached && !inLibrary) continue;
        p.cached[d.slug] = true;
        if (inLibrary) p.inLibrary[d.slug] = true;
        p.cacheVerified[d.slug] = true;
      }
    }
  };

  const runCacheCheck = async (streams: Stream[]): Promise<void> => {
    if (signal.aborted || input.debrids.length === 0) return;
    const hashes = hashList(streams);
    if (hashes.length === 0) return;
    await Promise.allSettled(
      input.debrids.map(async (d) => {
        const checked = checkedBySlug.get(d.slug) ?? new Set<string>();
        const fresh = hashes.filter((h) => !checked.has(h));
        if (fresh.length === 0) return;
        const r = await d.cacheCheck(fresh, signal);
        if (signal.aborted || !r.ok) return;
        const map = cachedBySlug.get(d.slug) ?? {};
        for (const h of fresh) {
          checked.add(h);
          if (r.data[h]) map[h] = true;
        }
        checkedBySlug.set(d.slug, checked);
        cachedBySlug.set(d.slug, map);
      }),
    );
    lastCacheCheckAt = performance.now();
  };

  const buildPartial = async (addonStreams: Stream[]): Promise<PipelineResult> => {
    const merged = mergeAndDedupe(library, addonStreams);
    const pre = merged.map(parseStream);
    if (input.isAnime && input.animeAbsoluteEpisode != null) {
      await enhanceAnimeStreams(pre);
    }
    const { kept: parsed, extraRejected } = applyAnimeEpisodeFilter(pre, input);
    applyDebridFlags(parsed);
    const { keep, rejected } = applyTrust(parsed, input.trust ?? {});
    const corpus = computeCorpusStats(keep, input.score);
    const scored = keep.map((s) => scoreStream(s, input.score, corpus));
    const picker = rankAndPick(
      scored,
      input.score.activeDebrids,
      PREFER_AAC,
      input.score.respectAddonOrder === true,
    );
    const fin = finalizeWithRescue(picker, rejected, input.trust ?? {}, input.score);
    return {
      picker: applyStreamPriority(fin.picker, priorityActive, input.score.activeDebrids),
      rejected: [...fin.rejected, ...extraRejected],
      raw: { addon: addonStreams, library },
      debridErrors: debridErrors.length > 0 ? debridErrors : undefined,
      addonErrors: addonErrors.length > 0 ? addonErrors : undefined,
    };
  };

  const emitPartialNow = (): void => {
    if (!onProgress || signal.aborted) return;
    void buildPartial(latestAddonStreams)
      .then((result) => {
        if (signal.aborted) return;
        onProgress(result);
      })
      .catch(() => {
        /* swallow */
      });
  };

  const scheduleCacheCheck = (): void => {
    if (input.debrids.length === 0 || signal.aborted || cacheCheckTimer != null) return;
    const since = performance.now() - lastCacheCheckAt;
    const delay = lastCacheCheckAt === 0 ? 0 : Math.max(0, DEBRID_CHECK_MIN_INTERVAL_MS - since);
    cacheCheckTimer = window.setTimeout(() => {
      cacheCheckTimer = null;
      void runCacheCheck(latestAddonStreams).then(() => {
        // Refresh the visible partial so newly verified streams update in place.
        if (!signal.aborted) emitPartialNow();
      });
    }, delay);
  };

  const onAddonBatch = (addonStreams: Stream[]): void => {
    latestAddonStreams = addonStreams;
    scheduleCacheCheck();
    if (!onProgress || signal.aborted) return;
    const now = performance.now();
    if (now - lastPartialAt < 250) return;
    lastPartialAt = now;
    emitPartialNow();
  };

  // `fetchAddonStreams` reports which addons answered with nothing because the
  // request failed; carry that into the result so the picker can explain "0
  // streams" instead of staying silent.
  const handleAddonProgress = (progress: AddonProgress): void => {
    addonErrors = progress.failures ?? [];
    onAddonProgress?.(progress);
  };

  // Library listings do not depend on the addon responses, so start them with the
  // addons instead of after them.
  const libraryListsPromise: LibraryListings =
    input.debrids.length > 0
      ? Promise.allSettled(input.debrids.map((d) => d.listLibrary(signal)))
      : Promise.resolve([]);

  const presets = input.presetStreams ?? [];
  const [librarySettled, addonSettled] = await Promise.allSettled([
    fetchLibraryStreams(input.debrids, input.query, signal, libraryListsPromise).then((s) => {
      library = s;
      return s;
    }),
    presets.length > 0
      ? Promise.resolve(presets)
      : fetchAddonStreams(
          input.addons,
          input.request,
          signal,
          onAddonBatch,
          handleAddonProgress,
          input.addonTimeoutMs,
          input.addonRanks,
          input.forcedAddonBases,
        ),
  ]);
  if (librarySettled.status === "fulfilled") library = librarySettled.value;
  const addonStreams = addonSettled.status === "fulfilled" ? addonSettled.value : [];
  const merged = mergeAndDedupe(library, addonStreams);

  const preParsed = merged.map(parseStream);
  const verifiedCacheByHash = new Map<string, ParsedStream["cacheVerified"]>();
  const markCacheVerified = (stream: ParsedStream, slug: DebridStore["slug"]) => {
    if (!stream.infoHash) return;
    const hash = stream.infoHash.toLowerCase();
    stream.cacheVerified[slug] = true;
    const byProvider = verifiedCacheByHash.get(hash) ?? {};
    byProvider[slug] = true;
    verifiedCacheByHash.set(hash, byProvider);
  };
  const restoreCacheVerification = (picker: RankedPicker) => {
    for (const stream of picker.all) {
      if (!stream.infoHash) continue;
      const verified = verifiedCacheByHash.get(stream.infoHash.toLowerCase());
      if (verified) stream.cacheVerified = { ...verified };
    }
  };

  if (input.isAnime) {
    await enhanceAnimeStreams(preParsed);
  }

  const { kept: parsed, extraRejected: animeRejected } = applyAnimeEpisodeFilter(preParsed, input);
  if (animeRejected.length > 0) {
    dlog(
      `[pipeline] anime episode filter: dropped ${animeRejected.length} stream(s) not matching ep ${input.animeAbsoluteEpisode}`,
    );
  }

  const hashes = [
    ...new Set(
      parsed
        .map((p) => p.infoHash)
        .filter((h): h is string => Boolean(h))
        .map((h) => h.toLowerCase()),
    ),
  ];
  if (hashes.length > 0 && input.debrids.length > 0 && !signal.aborted) {
    dlog(
      `[pipeline] ${parsed.length} parsed streams · ${hashes.length} unique hashes · debrids: ${input.debrids.map((d) => d.name).join(", ")}`,
    );
    // Flush any deferred incremental check so the hashes that arrived with the
    // last addons are verified too, then apply everything we have learned.
    if (cacheCheckTimer != null) {
      window.clearTimeout(cacheCheckTimer);
      cacheCheckTimer = null;
    }
    await runCacheCheck(merged);

    for (let i = 0; i < input.debrids.length; i++) {
      const slug = input.debrids[i].slug;
      const cacheMap = cachedBySlug.get(slug);
      let hits = 0;
      for (const p of parsed) {
        if (!p.infoHash) continue;
        if (cacheMap?.[p.infoHash.toLowerCase()]) {
          p.cached[slug] = true;
          markCacheVerified(p, slug);
          hits++;
        }
      }
      dlog(`[pipeline] cacheCheck on ${input.debrids[i].name}: ${hits} streams flagged cached`);
    }

    const libraryResults = await libraryListsPromise;
    for (let i = 0; i < input.debrids.length; i++) {
      const r = libraryResults[i];
      if (r.status === "rejected") {
        debridErrors.push({
          slug: input.debrids[i].slug,
          name: input.debrids[i].name,
          code: "network-error",
        });
        continue;
      }
      if (!r.value.ok) {
        debridErrors.push({
          slug: input.debrids[i].slug,
          name: input.debrids[i].name,
          code: r.value.code,
        });
        continue;
      }
      const slug = input.debrids[i].slug;
      const libHashes = new Set(r.value.data.map((e) => e.hash.toLowerCase()).filter(Boolean));
      libraryBySlug.set(slug, libHashes);
      let hits = 0;
      for (const p of parsed) {
        if (!p.infoHash) continue;
        if (libHashes.has(p.infoHash.toLowerCase())) {
          if (!p.cached[slug]) hits++;
          p.cached[slug] = true;
          p.inLibrary[slug] = true;
          markCacheVerified(p, slug);
        }
      }
      dlog(
        `[pipeline] listLibrary cross-check on ${input.debrids[i].name}: ${hits} extra streams flagged cached (lib has ${libHashes.size} hashes)`,
      );
    }

    const totalCached = parsed.filter((p) => Object.values(p.cached).some(Boolean)).length;
    dlog(`[pipeline] final: ${totalCached}/${parsed.length} streams marked cached`);
  }

  const core = await runCorePipeline(parsed, input.trust ?? {}, input.score);
  if (core) {
    if (core.rejected.length > 0) {
      const byReason = new Map<string, number>();
      for (const r of core.rejected) {
        const k = r.reason.split(":")[0];
        byReason.set(k, (byReason.get(k) ?? 0) + 1);
      }
      const summary = [...byReason.entries()].map(([k, n]) => `${k}=${n}`).join(", ");
      dlog(
        `[pipeline] (core) trust kept ${core.picker.all.length}/${parsed.length} · rejected: ${summary}`,
      );
    }
    const fin = finalizeWithRescue(core.picker, core.rejected, input.trust ?? {}, input.score);
    restoreCacheVerification(fin.picker);
    return {
      picker: applyStreamPriority(fin.picker, priorityActive, input.score.activeDebrids),
      rejected: [...fin.rejected, ...animeRejected],
      raw: { addon: addonStreams, library },
      debridErrors: debridErrors.length > 0 ? debridErrors : undefined,
      addonErrors: addonErrors.length > 0 ? addonErrors : undefined,
    };
  }
  const { keep, rejected } = applyTrust(parsed, input.trust ?? {});
  if (rejected.length > 0) {
    const byReason = new Map<string, number>();
    for (const r of rejected) {
      const k = r.reason.split(":")[0];
      byReason.set(k, (byReason.get(k) ?? 0) + 1);
    }
    const summary = [...byReason.entries()].map(([k, n]) => `${k}=${n}`).join(", ");
    dlog(`[pipeline] trust kept ${keep.length}/${parsed.length} · rejected: ${summary}`);
    for (const r of rejected.slice(0, 6)) {
      dlog(
        `[pipeline]   reject ${r.reason} :: ${r.stream.parsedTitle ?? r.stream.title ?? r.stream.name ?? "?"}`,
      );
    }
  }
  const corpus = computeCorpusStats(keep, input.score);
  const scored = keep.map((s) => scoreStream(s, input.score, corpus));
  const picker = rankAndPick(
    scored,
    input.score.activeDebrids,
    PREFER_AAC,
    input.score.respectAddonOrder === true,
  );
  const fin = finalizeWithRescue(picker, rejected, input.trust ?? {}, input.score);
  restoreCacheVerification(fin.picker);
  return {
    picker: applyStreamPriority(fin.picker, priorityActive, input.score.activeDebrids),
    rejected: [...fin.rejected, ...animeRejected],
    raw: { addon: addonStreams, library },
    addonErrors: addonErrors.length > 0 ? addonErrors : undefined,
  };
}

async function runCorePipeline(
  parsed: ReturnType<typeof parseStream>[],
  trustOpts: TrustOptions,
  scoreOpts: ScoreOptions,
): Promise<{ picker: RankedPicker; rejected: Rejection[] } | null> {
  const isTauri =
    typeof window !== "undefined" && ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);
  if (!isTauri) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const result = (await invoke("streams_run_pipeline", {
      streams: parsed,
      trustOpts,
      scoreOpts,
    })) as { picker: RankedPicker; rejected: Rejection[] };
    return result;
  } catch (e) {
    dlog(`[pipeline] core pipeline failed, falling back to JS: ${e}`);
    return null;
  }
}

function mergeAndDedupe(library: Stream[], addons: Stream[]): Stream[] {
  const seen = new Map<string, Stream>();
  const addContributor = (target: Stream, id: string, name: string) => {
    const list = target.contributors ?? [{ id: target.addonId, name: target.addonName }];
    if (!list.some((c) => c.id === id)) list.push({ id, name });
    target.contributors = list;
  };
  for (const s of library) {
    seen.set(streamKey(s), { ...s, contributors: [{ id: s.addonId, name: s.addonName }] });
  }
  for (const s of addons) {
    const key = streamKey(s);
    const prior = seen.get(key);
    if (!prior) {
      seen.set(key, { ...s, contributors: [{ id: s.addonId, name: s.addonName }] });
      continue;
    }
    addContributor(prior, s.addonId, s.addonName);
    if (s.sources && s.sources.length > 0) {
      const merged = new Set([...(prior.sources ?? []), ...s.sources]);
      prior.sources = [...merged];
    }
    if (!prior.url && s.url) prior.url = s.url;
  }
  return [...seen.values()];
}

function streamKey(s: Stream): string {
  if (s.infoHash) return `hash:${s.infoHash.toLowerCase()}:${s.fileIdx ?? ""}`;
  if (s.url) return `url:${s.url}`;
  return `n:${s.name ?? ""}:${s.title ?? ""}`;
}
