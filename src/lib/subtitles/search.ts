import type { Addon } from "@/lib/addons";
import { dinfo, dwarn } from "@/lib/debug";
import type { SubResult, SubSearchQuery } from "./types";
import { searchWyzie } from "./providers/wyzie";
import { searchAddons } from "./providers/addons";
import { searchOpenSubtitlesV3 } from "./providers/opensubtitles-v3";
import {
  pickSources,
  searchExtraSubSources,
  toSubResult,
  type ProviderCtx,
} from "./autosync/sub-sources";
import { langScore, normalizeLang } from "./language";
import { compareSubtitleMatch } from "./candidate-ranking";
import type { StreamHints } from "./stream-hints";
import { SUBTITLE_PROVIDER_TIMEOUT_MS, withSubtitleTimeout } from "./autoload";
import { bindSubtitleDownloadAuth, browserSubtitleCredentialKey } from "./provider-auth";
import { isSafeProviderSubtitleUrl } from "./provider-url";

export { streamTagsOf } from "./stream-hints";
export type { StreamHints } from "./stream-hints";
export {
  compareSubtitleMatch,
  rankSubtitleCandidates,
  streamMatchDetail,
  streamMatchScore,
  subtitleText,
} from "./candidate-ranking";

export type SearchOptions = {
  onPartial?: (results: SubResult[], stillFetching: number) => void;
  timeoutMs?: number;
  providers?: { wyzie?: boolean; addons?: boolean; opensubtitles?: boolean };
  addons?: Addon[];
  preferredLangs: string[];
  streamHints?: StreamHints;
  extra?: ProviderCtx;
};

export async function searchSubtitles(
  q: SubSearchQuery,
  opts: SearchOptions,
): Promise<SubResult[]> {
  let extraCtx: ProviderCtx | undefined;
  if (opts.extra) {
    const [subdl, subsource] = await Promise.all([
      bindSubtitleDownloadAuth("subdl-api-key", opts.extra.subdlApiKey),
      bindSubtitleDownloadAuth("subsource-api-key", opts.extra.subsourceApiKey),
    ]);
    extraCtx = {
      ...opts.extra,
      subdlApiKey: browserSubtitleCredentialKey(opts.extra.subdlApiKey),
      subsourceApiKey: browserSubtitleCredentialKey(opts.extra.subsourceApiKey),
      credentialAuth: { subdl, subsource },
    };
  }
  const want = opts.providers ?? {};
  const wyzieOn = want.wyzie === true;
  const addonsOn = want.addons ?? true;
  const osOn = want.opensubtitles ?? true;
  dinfo("[subs] search", {
    type: q.type,
    languages: q.langs?.length ?? 0,
    hasImdbId: Boolean(q.imdbId),
    hasTmdbId: Boolean(q.tmdbId),
    hasVideoHash: Boolean(q.videoHash),
    hasFilename: Boolean(q.filename),
    providers: { osOn, addonsOn, wyzieOn },
    addons: opts.addons?.length ?? 0,
  });
  const tmo = opts.timeoutMs ?? SUBTITLE_PROVIDER_TIMEOUT_MS;
  const tasks: Array<{ name: string; p: Promise<SubResult[]> }> = [];
  if (osOn)
    tasks.push({
      name: "opensubtitles-v3",
      p: withSubtitleTimeout(searchOpenSubtitlesV3(q), tmo, []),
    });
  if (wyzieOn)
    tasks.push({
      name: "wyzie",
      p: withSubtitleTimeout(searchWyzie(q), tmo, []),
    });
  if (addonsOn && opts.addons && opts.addons.length > 0) {
    for (const addon of opts.addons) {
      tasks.push({
        name: `addon:${addon.manifest.name}`,
        p: searchAddons([addon], q, tmo),
      });
    }
  }
  if (extraCtx) {
    const extraTimeout = extraCtx.timeoutMs ?? tmo;
    for (const source of pickSources(q, extraCtx)) {
      tasks.push({
        name: `extra:${source.id}`,
        p: withSubtitleTimeout(
          searchExtraSubSources(q, extraCtx, [source]).then((aggregate) => {
            return aggregate.all.map((candidate) =>
              toSubResult(
                candidate,
                candidate.downloadAuth
                  ? extraCtx.credentialAuth?.[
                      candidate.downloadAuth === "subsource-api-key" ? "subsource" : "subdl"
                    ]
                  : undefined,
              ),
            );
          }),
          extraTimeout + 500,
          [],
        ),
      });
    }
  }
  const resultsByTask: SubResult[][] = tasks.map(() => []);
  const allResults = () => resultsByTask.flat();
  let pending = tasks.length;
  const emit = () => {
    if (!opts.onPartial) return;
    opts.onPartial(
      deduplicateAndRankSubtitleResults(allResults(), opts.preferredLangs, opts.streamHints),
      pending,
    );
  };
  await Promise.all(
    tasks.map((t, taskIndex) =>
      t.p.then(
        (v) => {
          dinfo(`[subs] ${t.name}: ${v.length} results`);
          resultsByTask[taskIndex] = v;
          pending -= 1;
          emit();
        },
        () => {
          dwarn(`[subs] ${t.name} failed`);
          pending -= 1;
          emit();
        },
      ),
    ),
  );
  const ranked = deduplicateAndRankSubtitleResults(
    allResults(),
    opts.preferredLangs,
    opts.streamHints,
  );
  dinfo(`[subs] total ${ranked.length} after dedup/rank from ${tasks.length} sources`);
  return ranked;
}

function sourcePriority(source: SubResult["source"]): number {
  switch (source) {
    case "addon":
      return 3;
    case "opensubtitles":
      return 2;
    case "wyzie":
      return 2;
    case "podnapisi":
      return 2;
    case "gestdown":
      return 2;
    case "subdl":
      return 2;
    case "subsource":
      return 2;
    case "jimaku":
      return 1;
    default:
      return 0;
  }
}

function providerConfidenceValue(result: SubResult): number {
  switch (result.providerMatch?.confidence) {
    case "exact":
      return 5;
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 2;
    case "unknown":
      return 1;
    default:
      return 0;
  }
}

function providerScoreValue(result: SubResult): number {
  const raw = result.providerMatch?.score;
  if (raw == null || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.min(1, raw > 1 ? raw / 100 : raw));
}

function metadataRichness(result: SubResult): number {
  return Object.entries(result).reduce((score, [key, value]) => {
    if (key === "id" || key === "url" || key === "lang" || value == null || value === "") {
      return score;
    }
    if (Array.isArray(value)) return score + value.length;
    if (typeof value === "object") return score + Object.keys(value).length;
    return score + 1;
  }, 0);
}

function stableDuplicateCandidateKey(result: SubResult): string {
  return [
    result.source,
    result.id,
    result.upstreamProvider ?? "",
    result.release ?? "",
    result.rawFilename ?? "",
    result.providerMatch?.confidence ?? "",
    providerScoreValue(result),
  ]
    .join("|")
    .toLowerCase();
}

function compareDuplicateCandidates(a: SubResult, b: SubResult, hints?: StreamHints): number {
  const hash = Number(b.hash === "moviehash") - Number(a.hash === "moviehash");
  if (hash !== 0) return hash;
  const auth = Number(Boolean(b.downloadAuth)) - Number(Boolean(a.downloadAuth));
  if (auth !== 0) return auth;
  const confidence = providerConfidenceValue(b) - providerConfidenceValue(a);
  if (confidence !== 0) return confidence;
  const providerScore = providerScoreValue(b) - providerScoreValue(a);
  if (providerScore !== 0) return providerScore;
  const local = compareSubtitleMatch(a, b, hints);
  if (local !== 0) return local;
  const richness = metadataRichness(b) - metadataRichness(a);
  if (richness !== 0) return richness;
  const source = sourcePriority(b.source) - sourcePriority(a.source);
  if (source !== 0) return source;
  const aKey = stableDuplicateCandidateKey(a);
  const bKey = stableDuplicateCandidateKey(b);
  return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
}

function mergeDuplicateGroup(group: SubResult[], hints?: StreamHints): SubResult {
  const ordered = [...group].sort((a, b) => compareDuplicateCandidates(a, b, hints));
  const merged: SubResult = { ...ordered[0] };
  for (const candidate of ordered.slice(1)) {
    for (const key of Object.keys(candidate) as Array<keyof SubResult>) {
      if (merged[key] == null && candidate[key] != null) {
        Object.assign(merged, { [key]: candidate[key] });
      }
    }
  }
  const providerMatches = ordered
    .map((candidate) => candidate.providerMatch)
    .filter((match): match is NonNullable<SubResult["providerMatch"]> => match != null);
  if (providerMatches.length > 0) {
    const primary = providerMatches[0];
    merged.providerMatch = {
      ...primary,
      reasons: [...new Set(providerMatches.flatMap((match) => match.reasons ?? []))].sort(),
      matchedBy: [...new Set(providerMatches.flatMap((match) => match.matchedBy ?? []))].sort(),
    };
  }
  return merged;
}

export function deduplicateAndRankSubtitleResults(
  results: SubResult[],
  preferred: string[],
  hints?: StreamHints,
): SubResult[] {
  const groups = new Map<string, SubResult[]>();
  for (const r of results) {
    if (!isSafeProviderSubtitleUrl(r.url)) continue;
    const key = `${normalizeLang(r.lang)}|${r.url}|${r.title || ""}|${r.format || ""}`;
    const group = groups.get(key) ?? [];
    group.push(r);
    groups.set(key, group);
  }
  const filtered = [...groups.values()].map((group) => mergeDuplicateGroup(group, hints));
  const interleaved = interleaveBySource(filtered, preferred, hints);
  return interleaved;
}

function interleaveBySource(
  list: SubResult[],
  preferred: string[],
  hints?: StreamHints,
): SubResult[] {
  const buckets = new Map<string, SubResult[]>();
  for (const r of list) {
    const key = r.source;
    const arr = buckets.get(key) ?? [];
    arr.push(r);
    buckets.set(key, arr);
  }
  for (const arr of buckets.values()) {
    arr.sort((a, b) => {
      const la = langScore(a.lang, preferred);
      const lb = langScore(b.lang, preferred);
      if (la !== lb) return lb - la;
      return compareSubtitleMatch(a, b, hints);
    });
  }
  const sourceOrder = [...buckets.keys()].sort(
    (a, b) => sourcePriority(b as SubResult["source"]) - sourcePriority(a as SubResult["source"]),
  );
  const out: SubResult[] = [];
  const seen = new Set<SubResult>();
  const compare = (a: SubResult, b: SubResult) => {
    const la = langScore(a.lang, preferred);
    const lb = langScore(b.lang, preferred);
    if (la !== lb) return lb - la;
    return compareSubtitleMatch(a, b, hints);
  };
  const preferredResults = list.filter((r) => langScore(r.lang, preferred) > 0);
  const best = [...(preferredResults.length > 0 ? preferredResults : list)].sort(compare)[0];
  if (best) {
    seen.add(best);
    out.push(best);
  }
  const drain = (predicate: (r: SubResult) => boolean) => {
    let depth = 0;
    let more = true;
    while (more) {
      more = false;
      for (const src of sourceOrder) {
        const item = buckets.get(src)?.[depth];
        if (!item) continue;
        more = true;
        if (!seen.has(item) && predicate(item)) {
          seen.add(item);
          out.push(item);
        }
      }
      depth++;
    }
  };
  drain((r) => langScore(r.lang, preferred) > 0);
  drain(() => true);
  return out;
}
