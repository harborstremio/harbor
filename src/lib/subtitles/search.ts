import type { Addon } from "@/lib/addons";
import { dinfo, dwarn } from "@/lib/debug";
import type { SubResult, SubSearchQuery } from "./types";
import { searchWyzie } from "./providers/wyzie";
import { searchAddons } from "./providers/addons";
import { searchOpenSubtitlesV3 } from "./providers/opensubtitles-v3";
import { searchExtraSubSources, toSubResult, type ProviderCtx } from "./autosync/sub-sources";
import { langScore, normalizeLang } from "./language";
import { detectSource, parseRelease, releaseAffinity, type ReleaseTags } from "./release-match";
import { SUBTITLE_PROVIDER_TIMEOUT_MS, withSubtitleTimeout } from "./autoload";

export type SearchOptions = {
  onPartial?: (results: SubResult[], stillFetching: number) => void;
  timeoutMs?: number;
  providers?: { wyzie?: boolean; addons?: boolean; opensubtitles?: boolean };
  addons?: Addon[];
  preferredLangs: string[];
  streamHints?: StreamHints;
  extra?: ProviderCtx;
};

export type StreamHints = {
  release?: string | null;
  source?: string | null;
  resolution?: string | null;
  preferHearingImpaired?: boolean;
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
  if (opts.extra)
    tasks.push({
      name: "extra-sources",
      p: withSubtitleTimeout(
        searchExtraSubSources(q, opts.extra).then((a) => a.all.map(toSubResult)),
        tmo,
        [],
      ),
    });
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

export function streamTagsOf(hints: StreamHints): ReleaseTags {
  const parsed = parseRelease(hints.release);
  return {
    ...parsed,
    source: detectSource(hints.source) ?? parsed.source,
    resolution: normalizeResolution(hints.resolution) ?? parsed.resolution,
  };
}

function normalizeResolution(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.toLowerCase();
  if (s === "4k" || s === "uhd" || s.includes("2160")) return "2160p";
  const m = s.match(/(2160|1080|720|576|480)/);
  return m ? `${m[1]}p` : null;
}

export function subtitleText(r: SubResult): string {
  return `${r.release ?? ""} ${r.title ?? ""} ${r.url ?? ""}`;
}

export function streamMatchDetail(
  r: SubResult,
  hints: StreamHints | undefined,
): { score: number; reasons: string[] } {
  if (!hints) return { score: 0, reasons: [] };
  const { score, reasons } = releaseAffinity(streamTagsOf(hints), subtitleText(r));
  let total = score;
  const out = [...reasons];
  if (r.hash === "moviehash") {
    total += 200;
    out.unshift("exact file match");
  }
  if (r.hearingImpaired && !hints.preferHearingImpaired) total -= 25;
  return { score: total, reasons: out };
}

export function streamMatchScore(r: SubResult, hints: StreamHints | undefined): number {
  return streamMatchDetail(r, hints).score;
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
      const sa = streamMatchScore(a, hints);
      const sb = streamMatchScore(b, hints);
      if (sa !== sb) return sb - sa;
      const da = a.downloads ?? 0;
      const db = b.downloads ?? 0;
      if (da !== db) return db - da;
      return (a.title || "").localeCompare(b.title || "");
    });
  }
  const sourceOrder = [...buckets.keys()].sort(
    (a, b) => sourcePriority(b as SubResult["source"]) - sourcePriority(a as SubResult["source"]),
  );
  const out: SubResult[] = [];
  const seen = new Set<SubResult>();
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
