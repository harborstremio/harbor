import type { Addon } from "@/lib/addons";
import type { PlayerBridge } from "@/lib/player/bridge";
import type { Settings } from "@/lib/settings";
import type { PlayerSrc } from "@/lib/view";
import { markAddedSub } from "./added-subs";
import { langScore, normalizeLang } from "./language";
import {
  releaseOf,
  subtitleLoadMetadataOf,
  subtitleStreamDescriptor,
  subtitleTitleOf,
} from "./provider-label";
import {
  compareSubtitleMatch,
  rankSubtitleCandidates,
  searchSubtitles,
  streamMatchDetail,
  type StreamHints,
} from "./search";
import type { SubResult } from "./types";
import { prepareRankedSubtitleCandidates, prepareSubtitle } from "./prepare";
import {
  choosePreparedCandidate,
  orderPreparedCandidates,
  preparedCandidateAutoSelectionEligible,
  preflightPreparedCandidates,
  type CandidatePreflightProbe,
  type PreparedSubtitlePreflight,
} from "./candidate-preflight";
import { providerSubtitleDownloadHeaders } from "./provider-auth";
import {
  discardPreparedSubtitle,
  registerPreparedSubtitle,
  takePreparedSubtitleCleanup,
} from "./prepared-registry";
import { releaseCompatibilityPercent } from "./release-match";
import { isSafeProviderSubtitleUrl } from "./provider-url";
import { SUBTITLE_PROVIDER_TIMEOUT_MS } from "./autoload";

const EXTRA_TRACKS_PER_LANGUAGE = 15;
const DEEP_EXTRA_TRACKS = 15;
const DEEP_TIMEOUT_MS = 20_000;
const BUILT_IN_TIMEOUT_MS = 12_000;
const BUILT_IN_EAGER_LIMIT_PER_LANGUAGE = 1;
const AUTO_SELECTION_CANDIDATE_LIMIT = 3;
const PROGRESSIVE_TRACKS_PER_LANGUAGE = 15;
const PROGRESSIVE_PREVIEW_TRACKS_PER_LANGUAGE =
  EXTRA_TRACKS_PER_LANGUAGE - AUTO_SELECTION_CANDIDATE_LIMIT;
const SUBTITLE_ADD_CONCURRENCY = 4;
const ON_DEMAND_SOURCES = new Set<SubResult["source"]>([
  "podnapisi",
  "subdl",
  "gestdown",
  "subsource",
]);

export type SubFetchParams = {
  bridge: PlayerBridge;
  src: PlayerSrc;
  settings: Settings;
  addons: Addon[];
  langs: string[];
  searchImdbId: string | null | undefined;
  candidateIds: string[];
  season?: number;
  episode?: number;
  videoHash?: string;
  videoSize?: number;
  durationSec?: number;
  deep?: boolean;
  autoSelect?: boolean;
  shouldAutoSelect?: () => boolean;
  providers?: {
    opensubtitles?: boolean;
    wyzie?: boolean;
    addons?: boolean;
    extras?: boolean;
  };
  skipUrls?: Set<string>;
  isActive: () => boolean;
};

export type SubFetchResult = {
  added: number;
  found: number;
  hints: StreamHints;
  selected: SubResult | null;
};

export type SubtitleFetchDependencies = {
  search?: typeof searchSubtitles;
  prepare?: typeof prepareSubtitle;
  preflightProbe?: CandidatePreflightProbe;
};

export function streamHintsOf(src: PlayerSrc): StreamHints {
  return {
    release: src.streamRef?.title ?? src.streamRef?.parsedTitle ?? null,
    source: src.streamRef?.source ?? null,
    resolution: src.streamRef?.resolution ?? null,
    season: src.episode?.imdbSeason ?? src.episode?.season ?? null,
    episode: src.episode?.imdbEpisode ?? src.episode?.episode ?? null,
  };
}

function extraCtx(settings: Settings, deep: boolean, hashOnly: boolean) {
  const enabled = settings.subProvidersEnabled ?? {};
  const wantSubdl = enabled.subdl === true && !!settings.subdlApiKey;
  const wantSubsource = enabled.subsource === true && !!settings.subsourceApiKey;
  if (!hashOnly && !wantSubdl && !wantSubsource) return undefined;
  return {
    userAgent: "Harbor",
    netAllowed: true,
    subdlApiKey: settings.subdlApiKey || null,
    subsourceApiKey: settings.subsourceApiKey || null,
    enabled: hashOnly
      ? { podnapisi: true, gestdown: false, subdl: false, subsource: false }
      : { subdl: wantSubdl, subsource: wantSubsource },
    bypassCache: deep,
    timeoutMs: deep ? DEEP_TIMEOUT_MS : BUILT_IN_TIMEOUT_MS,
  };
}

function limitEagerProviderDownloads(list: SubResult[], consumed: Set<SubResult>): SubResult[] {
  const counts = new Map<string, number>();
  const keyOf = (result: SubResult) => `${result.source}:${normalizeLang(result.lang) || "und"}`;
  for (const result of consumed) {
    if (!ON_DEMAND_SOURCES.has(result.source)) continue;
    const key = keyOf(result);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return list.filter((result) => {
    if (!ON_DEMAND_SOURCES.has(result.source)) return true;
    const key = keyOf(result);
    const count = counts.get(key) ?? 0;
    if (count >= BUILT_IN_EAGER_LIMIT_PER_LANGUAGE) return false;
    counts.set(key, count + 1);
    return true;
  });
}

function spreadBySource(list: SubResult[], skip: Set<SubResult>, limit: number): SubResult[] {
  const key = (r: SubResult) => (r.source === "addon" ? `addon:${r.title ?? ""}` : r.source);
  const pool = new Map<string, SubResult[]>();
  for (const r of list) {
    if (skip.has(r)) continue;
    const k = key(r);
    const arr = pool.get(k) ?? [];
    arr.push(r);
    pool.set(k, arr);
  }
  const out: SubResult[] = [];
  for (let depth = 0; out.length < limit; depth++) {
    let progressed = false;
    for (const arr of pool.values()) {
      const item = arr[depth];
      if (!item) continue;
      progressed = true;
      out.push(item);
      if (out.length >= limit) break;
    }
    if (!progressed) break;
  }
  return out;
}

function spreadBySourcePerLanguage(
  list: SubResult[],
  skip: Set<SubResult>,
  limit: number,
): SubResult[] {
  const groups = new Map<string, SubResult[]>();
  for (const result of list) {
    const key = normalizeLang(result.lang) || "und";
    const group = groups.get(key) ?? [];
    group.push(result);
    groups.set(key, group);
  }
  const out: SubResult[] = [];
  for (const group of groups.values()) {
    const consumed = group.filter((result) => skip.has(result)).length;
    out.push(...spreadBySource(group, skip, Math.max(0, limit - consumed)));
  }
  return out;
}

export async function fetchSubtitlesIntoPlayer(
  p: SubFetchParams,
  dependencies: SubtitleFetchDependencies = {},
): Promise<SubFetchResult> {
  const deep = p.deep === true;
  const enabled = p.settings.subProvidersEnabled ?? {};
  const hints = streamHintsOf(p.src);
  const consumed = new Set<SubResult>();
  const attemptedUrls = new Set(p.skipUrls ?? []);
  let selected: SubResult | null = null;
  let added = 0;

  const meta = (r: SubResult) => {
    const match = streamMatchDetail(r, hints);
    return {
      ...subtitleLoadMetadataOf(r),
      matchScore: match.score,
      matchConfidence: match.confidence,
      matchReasons: match.reasons,
    };
  };

  const rankedResults = (results: SubResult[]) =>
    results
      .filter((result) => isSafeProviderSubtitleUrl(result.url))
      .filter((r) => langScore(r.lang ?? "", p.langs) >= 0)
      .sort((a, b) => {
        const language = langScore(b.lang ?? "", p.langs) - langScore(a.lang ?? "", p.langs);
        return language !== 0 ? language : compareSubtitleMatch(a, b, hints);
      });
  const rankedFresh = (results: SubResult[]) =>
    rankedResults(results).filter((r) => !attemptedUrls.has(r.url));

  const addCandidates = async (candidates: SubResult[]) => {
    const claimed = candidates.filter((result) => {
      if (attemptedUrls.has(result.url)) return false;
      attemptedUrls.add(result.url);
      return true;
    });
    let cursor = 0;
    const worker = async () => {
      while (p.isActive()) {
        const result = claimed[cursor++];
        if (!result) return;
        const ok = await p.bridge.addSubtitle(
          result.url,
          result.lang,
          subtitleTitleOf(result),
          false,
          meta(result),
        );
        if (ok !== true) continue;
        markAddedSub(result.url);
        consumed.add(result);
        added++;
      }
    };
    await Promise.all(
      Array.from({ length: Math.min(SUBTITLE_ADD_CONCURRENCY, claimed.length) }, async () =>
        worker(),
      ),
    );
  };

  let progressiveQueue = Promise.resolve();
  const queuePartial = (partial: SubResult[]) => {
    progressiveQueue = progressiveQueue.then(async () => {
      if (!p.isActive()) return;
      const reservedForSelection = deep
        ? null
        : new Set(
            rankSubtitleCandidates(partial, p.langs, hints)
              .slice(0, AUTO_SELECTION_CANDIDATE_LIMIT)
              .map((result) => result.url),
          );
      const fresh = rankedFresh(partial).filter(
        (result) =>
          streamMatchDetail(result, hints).confidence !== "incompatible" &&
          !reservedForSelection?.has(result.url),
      );
      const eagerPool = limitEagerProviderDownloads(fresh, consumed);
      const candidates = spreadBySourcePerLanguage(
        eagerPool,
        consumed,
        deep ? PROGRESSIVE_TRACKS_PER_LANGUAGE : PROGRESSIVE_PREVIEW_TRACKS_PER_LANGUAGE,
      );
      await addCandidates(candidates);
    });
  };

  const searchedResults = await (dependencies.search ?? searchSubtitles)(
    {
      imdbId: p.searchImdbId ?? undefined,
      stremioId: p.src.meta.id,
      candidateIds: p.candidateIds,
      type: p.src.meta.type === "series" ? "series" : "movie",
      title: p.src.meta.name,
      season: p.season,
      episode: p.episode,
      langs: p.langs,
      videoHash: p.videoHash,
      videoSize: p.videoSize,
      filename: subtitleStreamDescriptor(p.src.streamRef),
    },
    {
      timeoutMs: deep ? DEEP_TIMEOUT_MS : SUBTITLE_PROVIDER_TIMEOUT_MS,
      providers: {
        wyzie: p.providers?.wyzie ?? enabled.wyzie === true,
        addons: p.providers?.addons ?? enabled.addons !== false,
        opensubtitles: p.providers?.opensubtitles ?? enabled.opensubtitles !== false,
      },
      addons: p.addons,
      preferredLangs: p.langs,
      streamHints: hints,
      extra: p.providers?.extras === false ? undefined : extraCtx(p.settings, deep, !!p.videoHash),
      onPartial: queuePartial,
    },
  );
  const results = searchedResults.filter((result) => isSafeProviderSubtitleUrl(result.url));

  await progressiveQueue;

  if (!p.isActive()) return { added: 0, found: results.length, hints, selected: null };

  if (!deep) {
    const rankedAuto = rankSubtitleCandidates(results, p.langs, hints).filter(
      (result) => !attemptedUrls.has(result.url),
    );
    const preparedResults = await prepareRankedSubtitleCandidates(
      rankedAuto,
      (result) =>
        (dependencies.prepare ?? prepareSubtitle)({
          url: result.url,
          format: result.format,
          encoding: result.encoding,
          language: result.lang,
          season: p.season,
          episode: p.episode,
          release: releaseOf(result) ?? hints.release ?? undefined,
          filename: result.rawFilename ?? subtitleStreamDescriptor(p.src.streamRef),
          durationSec: p.durationSec,
          requestHeaders: providerSubtitleDownloadHeaders(result.downloadAuth, result.url),
        }),
      AUTO_SELECTION_CANDIDATE_LIMIT,
    );
    for (const result of preparedResults) attemptedUrls.add(result.candidate.url);
    const preflights = await preflightPreparedCandidates(
      preparedResults,
      {
        mediaUrl: p.src.url,
        headers: p.src.headers,
        durationSec: p.durationSec ?? 0,
      },
      {
        probe: dependencies.preflightProbe,
        compatibilityPercent: (result) => {
          const match = streamMatchDetail(result, hints);
          return releaseCompatibilityPercent(match.confidence, match.score);
        },
        releaseConfidence: (result) => streamMatchDetail(result, hints).confidence,
        reasons: (result) => [
          ...(result.providerMatch?.reasons ?? []).map((reason) => `Provider: ${reason}`),
          ...streamMatchDetail(result, hints).reasons.map((reason) => `Local: ${reason}`),
        ],
      },
    );
    const rerankEntries = preflights.map((item) => ({
      item,
      candidate: { ...item.candidate, timingStatus: item.timingStatus },
    }));
    const itemByCandidate = new Map<SubResult, PreparedSubtitlePreflight<SubResult>>(
      rerankEntries.map(({ item, candidate }) => [candidate, item]),
    );
    const selectionRank = new Map<PreparedSubtitlePreflight<SubResult>, number>();
    rankSubtitleCandidates(
      rerankEntries.map(({ candidate }) => candidate),
      p.langs,
      hints,
    ).forEach((candidate, rank) => {
      const item = itemByCandidate.get(candidate);
      if (item) selectionRank.set(item, rank);
    });
    const preferred = choosePreparedCandidate(preflights, {
      rankOf: (item) => selectionRank.get(item) ?? Number.MAX_SAFE_INTEGER,
    });
    const loadOrder = orderPreparedCandidates(preflights, {
      rankOf: (item) => selectionRank.get(item) ?? Number.MAX_SAFE_INTEGER,
    });
    const keep = new Set<PreparedSubtitlePreflight<SubResult>>();
    for (const item of loadOrder) {
      if (!p.isActive()) break;
      const autoSelectionEligible = preparedCandidateAutoSelectionEligible(item, {
        autoSelect: p.autoSelect !== false && selected == null,
        selectionLeaseValid: p.shouldAutoSelect?.() ?? true,
      });
      const shouldSelect = selected == null && preferred != null && autoSelectionEligible;
      registerPreparedSubtitle(item.prepared);
      const itemMeta = {
        ...meta(item.candidate),
        format: item.prepared.format,
        encoding: item.prepared.encoding,
        archive: item.prepared.archive,
        rawFilename: item.prepared.rawFilename,
        prepared: true,
        autoSelectionEligible,
        originalUrl: item.candidate.url,
        timingStatus: item.timingStatus,
        timingMeasurementStatus: item.measurement.status,
        matchExplanation: item.explanation,
      };
      const ok = await p.bridge.addSubtitle(
        item.prepared.playableUrl,
        item.candidate.lang,
        subtitleTitleOf(item.candidate),
        shouldSelect,
        itemMeta,
        "automatic",
      );
      if (ok === true) {
        keep.add(item);
        markAddedSub(item.candidate.url);
        consumed.add(item.candidate);
        added++;
        if (shouldSelect) selected = item.candidate;
      } else {
        takePreparedSubtitleCleanup(item.prepared.playableUrl)?.();
      }
    }
    for (const result of preparedResults) {
      const preflight =
        result.status === "prepared"
          ? preflights.find((item) => item.prepared === result.prepared)
          : undefined;
      if (result.status === "prepared" && (!preflight || !keep.has(preflight))) {
        takePreparedSubtitleCleanup(result.prepared.playableUrl)?.();
        discardPreparedSubtitle(result.prepared);
      }
    }
  }

  const byPreferredLang = rankedResults(results).sort(
    (a, b) => langScore(b.lang ?? "", p.langs) - langScore(a.lang ?? "", p.langs),
  );
  const eagerPool = limitEagerProviderDownloads(byPreferredLang, consumed);
  const extras = deep
    ? spreadBySource(eagerPool, consumed, DEEP_EXTRA_TRACKS)
    : spreadBySourcePerLanguage(eagerPool, consumed, EXTRA_TRACKS_PER_LANGUAGE);
  await addCandidates(extras);
  return { added, found: results.length, hints, selected };
}
