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
import {
  releaseAffinity,
  subtitleConfidenceRank,
  type SubtitleMatchConfidence,
} from "./release-match";
import { streamTagsOf, type StreamHints } from "./stream-hints";
import { SUBTITLE_PROVIDER_TIMEOUT_MS, withSubtitleTimeout } from "./autoload";

export { streamTagsOf } from "./stream-hints";
export type { StreamHints } from "./stream-hints";

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
  const want = opts.providers ?? {};
  const wyzieOn = want.wyzie === true;
  const addonsOn = want.addons ?? true;
  const osOn = want.opensubtitles ?? true;
  dinfo("[subs] search", {
    q,
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
  if (addonsOn && opts.addons && opts.addons.length > 0)
    tasks.push({
      name: "addons",
      p: searchAddons(opts.addons, q, tmo),
    });
  if (opts.extra) {
    const extraTimeout = opts.extra.timeoutMs ?? tmo;
    for (const source of pickSources(q, opts.extra)) {
      tasks.push({
        name: `extra:${source.id}`,
        p: withSubtitleTimeout(
          searchExtraSubSources(q, opts.extra, [source]).then((a) => a.all.map(toSubResult)),
          extraTimeout + 500,
          [],
        ),
      });
    }
  }
  const all: SubResult[] = [];
  let pending = tasks.length;
  const emit = () => {
    if (!opts.onPartial) return;
    opts.onPartial(dedupAndRank(all, opts.preferredLangs, opts.streamHints), pending);
  };
  await Promise.all(
    tasks.map((t) =>
      t.p.then(
        (v) => {
          dinfo(`[subs] ${t.name}: ${v.length} results`);
          if (v.length > 0) all.push(...v);
          pending -= 1;
          emit();
        },
        (e) => {
          dwarn(`[subs] ${t.name} failed`, e);
          pending -= 1;
          emit();
        },
      ),
    ),
  );
  const ranked = dedupAndRank(all, opts.preferredLangs, opts.streamHints);
  dinfo(`[subs] total ${ranked.length} after dedup/rank from ${tasks.length} sources`);
  return ranked;
}

export function subtitleText(r: SubResult): string {
  return `${r.release ?? ""} ${r.title ?? ""} ${r.url ?? ""}`;
}

export function streamMatchDetail(
  r: SubResult,
  hints: StreamHints | undefined,
): {
  score: number;
  reasons: string[];
  sourceRank: 1 | 2 | 3;
  exactHash: boolean;
  confidence: SubtitleMatchConfidence;
} {
  if (!hints) {
    return { score: 0, reasons: [], sourceRank: 1, exactHash: false, confidence: "low" };
  }
  const { score, reasons, sourceRank, confidence } = releaseAffinity(
    streamTagsOf(hints),
    subtitleText(r),
  );
  let total = score;
  const out = [...reasons];
  const exactHash = r.hash === "moviehash";
  if (exactHash) {
    total += 200;
    out.unshift("exact file match");
  }
  if (r.hearingImpaired && !hints.preferHearingImpaired) total -= 25;
  return {
    score: total,
    reasons: out,
    sourceRank,
    exactHash,
    confidence: exactHash ? "exact" : confidence,
  };
}

export function streamMatchScore(r: SubResult, hints: StreamHints | undefined): number {
  return streamMatchDetail(r, hints).score;
}

export function compareSubtitleMatch(
  a: SubResult,
  b: SubResult,
  hints: StreamHints | undefined,
): number {
  const aMatch = streamMatchDetail(a, hints);
  const bMatch = streamMatchDetail(b, hints);
  if (aMatch.exactHash !== bMatch.exactHash) return aMatch.exactHash ? -1 : 1;
  const confidence =
    subtitleConfidenceRank(bMatch.confidence) - subtitleConfidenceRank(aMatch.confidence);
  if (confidence !== 0) return confidence;
  if (aMatch.sourceRank !== bMatch.sourceRank) return bMatch.sourceRank - aMatch.sourceRank;
  if (aMatch.score !== bMatch.score) return bMatch.score - aMatch.score;
  const downloads = (b.downloads ?? 0) - (a.downloads ?? 0);
  if (downloads !== 0) return downloads;
  return (a.title || "").localeCompare(b.title || "");
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

function dedupAndRank(results: SubResult[], preferred: string[], hints?: StreamHints): SubResult[] {
  const seen = new Set<string>();
  const filtered: SubResult[] = [];
  for (const r of results) {
    // Include title and format in dedup key to handle cases where same URL appears multiple times
    const key = `${normalizeLang(r.lang)}|${r.url}|${r.title || ""}|${r.format || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    filtered.push(r);
  }
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
