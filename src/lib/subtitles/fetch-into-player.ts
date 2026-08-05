import type { Addon } from "@/lib/addons";
import type { PlayerBridge } from "@/lib/player/bridge";
import type { Settings } from "@/lib/settings";
import type { PlayerSrc } from "@/lib/view";
import { markAddedSub } from "./added-subs";
import { langScore, normalizeLang } from "./language";
import { providerLabel, releaseOf } from "./provider-label";
import { searchSubtitles, streamMatchScore, type StreamHints } from "./search";
import { loadFirstWorkingSubtitle } from "./autoload";
import type { SubResult } from "./types";

const EXTRA_TRACKS_PER_LANGUAGE = 40;
const DEEP_EXTRA_TRACKS = 60;
const DEEP_TIMEOUT_MS = 20_000;

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
    timeoutMs: deep ? DEEP_TIMEOUT_MS : undefined,
  };
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

  const results = await searchSubtitles(
    {
      imdbId: p.searchImdbId ?? undefined,
      stremioId: p.src.meta.id,
      candidateIds: p.candidateIds,
      type: p.src.meta.type === "series" ? "series" : "movie",
      season: p.season,
      episode: p.episode,
      langs: p.langs,
      videoHash: p.videoHash,
      videoSize: p.videoSize,
      filename: p.src.streamRef?.parsedTitle ?? p.src.streamRef?.title ?? undefined,
    },
    {
      timeoutMs: deep ? DEEP_TIMEOUT_MS : 7_000,
      providers: {
        wyzie: enabled.wyzie === true,
        addons: enabled.addons !== false,
        opensubtitles: enabled.opensubtitles !== false,
      },
      addons: p.addons,
      preferredLangs: p.langs,
      streamHints: hints,
      extra: extraCtx(p.settings, deep),
    },
  );

  if (!p.isActive()) return { added: 0, found: results.length, hints, selected: null };

  const matches = results.filter((r) => langScore(r.lang ?? "", p.langs) >= 0);
  const skipUrls = p.skipUrls ?? new Set<string>();
  const fresh = matches.filter((r) => !skipUrls.has(r.url));

  const meta = (r: SubResult) => ({
    format: r.format,
    encoding: r.encoding,
    release: releaseOf(r),
    provider: providerLabel(r),
    matchScore: streamMatchScore(r, hints),
    subId: r.id,
  });

  let selected: SubResult | null = null;
  const consumed = new Set<SubResult>();
  if (!deep) {
    selected = await loadFirstWorkingSubtitle(fresh, async (r) => {
      if (!p.isActive()) return false;
      const ok = await p.bridge.addSubtitle(r.url, r.lang, providerLabel(r), false, meta(r));
      if (ok === true) markAddedSub(r.url);
      return ok === true;
    });
    if (selected) consumed.add(selected);
  }

  const byPreferredLang = [...fresh].sort(
    (a, b) => langScore(b.lang ?? "", p.langs) - langScore(a.lang ?? "", p.langs),
  );
  const extras = deep
    ? spreadBySource(byPreferredLang, consumed, DEEP_EXTRA_TRACKS)
    : spreadBySourcePerLanguage(byPreferredLang, consumed, EXTRA_TRACKS_PER_LANGUAGE);
  let added = selected ? 1 : 0;
  for (const r of extras) {
    if (!p.isActive()) break;
    const ok = await p.bridge.addSubtitle(r.url, r.lang, providerLabel(r), false, meta(r));
    if (ok === true) {
      markAddedSub(r.url);
      added++;
    }
  }
  return { added, found: results.length, hints, selected };
}
