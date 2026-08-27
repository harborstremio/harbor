import type { Addon } from "@/lib/addons";
import type { PlayerBridge } from "@/lib/player/bridge";
import type { Settings } from "@/lib/settings";
import type { PlayerSrc } from "@/lib/view";
import { markAddedSub } from "./added-subs";
import { langScore, normalizeLang } from "./language";
import {
  providerLabel,
  releaseOf,
  subtitleStreamDescriptor,
  subtitleTitleOf,
} from "./provider-label";
import {
  compareSubtitleMatch,
  searchSubtitles,
  streamMatchDetail,
  type StreamHints,
} from "./search";
import { loadFirstWorkingSubtitle } from "./autoload";
import type { SubResult } from "./types";

const EXTRA_TRACKS_PER_LANGUAGE = 35;
const DEEP_EXTRA_TRACKS = 60;
const DEEP_TIMEOUT_MS = 20_000;
const BUILT_IN_TIMEOUT_MS = 12_000;
const BUILT_IN_EAGER_LIMIT_PER_LANGUAGE = 1;
const PROGRESSIVE_TRACKS_PER_LANGUAGE = 35;
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
  deep?: boolean;
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

export function streamHintsOf(src: PlayerSrc): StreamHints {
  return {
    release: src.streamRef?.title ?? src.streamRef?.parsedTitle ?? null,
    source: src.streamRef?.source ?? null,
    resolution: src.streamRef?.resolution ?? null,
    season: src.episode?.imdbSeason ?? src.episode?.season ?? null,
    episode: src.episode?.imdbEpisode ?? src.episode?.episode ?? null,
  };
}

function extraCtx(settings: Settings, deep: boolean) {
  const enabled = settings.subProvidersEnabled ?? {};
  const wantSubdl = enabled.subdl === true && !!settings.subdlApiKey;
  const wantSubsource = enabled.subsource === true && !!settings.subsourceApiKey;
  if (!wantSubdl && !wantSubsource) return undefined;
  return {
    userAgent: "Harbor",
    netAllowed: true,
    subdlApiKey: settings.subdlApiKey || null,
    subsourceApiKey: settings.subsourceApiKey || null,
    enabled: { subdl: wantSubdl, subsource: wantSubsource },
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

export async function fetchSubtitlesIntoPlayer(p: SubFetchParams): Promise<SubFetchResult> {
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
      format: r.format,
      encoding: r.encoding,
      release: releaseOf(r),
      provider: providerLabel(r),
      fps: r.fps,
      downloads: r.downloads,
      author: r.author,
      matchScore: match.score,
      matchConfidence: match.confidence,
      matchReasons: match.reasons,
      subId: r.id,
    };
  };

  const rankedResults = (results: SubResult[]) =>
    results
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
        selected ??= result;
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
      const fresh = rankedFresh(partial).filter(
        (result) => streamMatchDetail(result, hints).confidence !== "incompatible",
      );
      const eagerPool = limitEagerProviderDownloads(fresh, consumed);
      const candidates = spreadBySourcePerLanguage(
        eagerPool,
        consumed,
        PROGRESSIVE_TRACKS_PER_LANGUAGE,
      );
      await addCandidates(candidates);
    });
  };

  const results = await searchSubtitles(
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
      timeoutMs: deep ? DEEP_TIMEOUT_MS : 7_000,
      providers: {
        wyzie: p.providers?.wyzie ?? enabled.wyzie === true,
        addons: p.providers?.addons ?? enabled.addons !== false,
        opensubtitles: p.providers?.opensubtitles ?? enabled.opensubtitles !== false,
      },
      addons: p.addons,
      preferredLangs: p.langs,
      streamHints: hints,
      extra: p.providers?.extras === false ? undefined : extraCtx(p.settings, deep),
      onPartial: queuePartial,
    },
  );

  await progressiveQueue;

  if (!p.isActive()) return { added: 0, found: results.length, hints, selected: null };

  const fresh = rankedFresh(results);
  if (!deep && selected == null) {
    const autoCandidates = fresh.filter(
      (result) => streamMatchDetail(result, hints).confidence !== "incompatible",
    );
    selected = await loadFirstWorkingSubtitle(autoCandidates, async (r) => {
      if (!p.isActive()) return false;
      if (attemptedUrls.has(r.url)) return false;
      attemptedUrls.add(r.url);
      const ok = await p.bridge.addSubtitle(r.url, r.lang, subtitleTitleOf(r), false, meta(r));
      if (ok === true) {
        markAddedSub(r.url);
        consumed.add(r);
        added++;
      }
      return ok === true;
    });
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
