import type { Addon } from "@/lib/addons";
import { dinfo, dwarn } from "@/lib/debug";
import type { SubResult, SubSearchQuery } from "./types";
import { searchWyzie } from "./providers/wyzie";
import { searchAddons } from "./providers/addons";
import { searchOpenSubtitlesV3 } from "./providers/opensubtitles-v3";
import { langScore, normalizeLang } from "./language";
import { SUBTITLE_PROVIDER_TIMEOUT_MS, withSubtitleTimeout } from "./autoload";

export type SearchOptions = {
  providers?: { wyzie?: boolean; addons?: boolean; opensubtitles?: boolean };
  addons?: Addon[];
  preferredLangs: string[];
  streamHints?: StreamHints;
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
  const tasks: Array<{ name: string; p: Promise<SubResult[]> }> = [];
  if (osOn)
    tasks.push({
      name: "opensubtitles-v3",
      p: withSubtitleTimeout(searchOpenSubtitlesV3(q), SUBTITLE_PROVIDER_TIMEOUT_MS, []),
    });
  if (wyzieOn)
    tasks.push({
      name: "wyzie",
      p: withSubtitleTimeout(searchWyzie(q), SUBTITLE_PROVIDER_TIMEOUT_MS, []),
    });
  if (addonsOn && opts.addons && opts.addons.length > 0)
    tasks.push({
      name: "addons",
      p: withSubtitleTimeout(searchAddons(opts.addons, q), SUBTITLE_PROVIDER_TIMEOUT_MS, []),
    });
  const settled = await Promise.allSettled(tasks.map((t) => t.p));
  const all: SubResult[] = [];
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      dinfo(`[subs] ${tasks[i].name}: ${r.value.length} results`);
      all.push(...r.value);
    } else {
      dwarn(`[subs] ${tasks[i].name} failed`, r.reason);
    }
  });
  const ranked = dedupAndRank(all, opts.preferredLangs, opts.streamHints);
  dinfo(`[subs] total ${ranked.length} after dedup/rank`);
  return ranked;
}

const RELEASE_GROUP_RX =
  /[-.][A-Z0-9]{2,}$|\b(EVO|RARBG|YTS|YIFY|FGT|PSA|TBS|GalaxyRG|GalaxyTV|MeGusta|ION10|EZTV|NTb|FLUX|TEPES|KOGi|SMURF|RZeroX|d3g|TGx)\b/gi;

function extractReleaseGroup(text: string | null | undefined): string | null {
  if (!text) return null;
  const matches = text.match(RELEASE_GROUP_RX);
  if (!matches || matches.length === 0) return null;
  const last = matches[matches.length - 1].replace(/^[-.]/, "").toUpperCase();
  return last.length >= 2 ? last : null;
}

function sourceTokens(source: string | null | undefined): string[] {
  if (!source) return [];
  const s = source.toLowerCase();
  if (s.includes("bluray") || s === "remux" || s.includes("bdrip"))
    return ["bluray", "bdrip", "remux"];
  if (s.includes("web-dl") || s === "webdl" || s.includes("webrip"))
    return ["web-dl", "webdl", "webrip", "web"];
  if (s.includes("hdtv")) return ["hdtv"];
  if (s.includes("dvd")) return ["dvd", "dvdrip"];
  return [s];
}

function streamMatchScore(r: SubResult, hints: StreamHints | undefined): number {
  if (!hints) return 0;
  const release = extractReleaseGroup(hints.release);
  const subText = `${r.release ?? ""} ${r.title ?? ""} ${r.url ?? ""}`.toLowerCase();
  let score = 0;
  if (release && subText.includes(release.toLowerCase())) score += 120;
  const wantSrc = sourceTokens(hints.source);
  for (const src of wantSrc) {
    if (subText.includes(src)) {
      score += 40;
      break;
    }
  }
  if (hints.resolution) {
    const res = hints.resolution.toLowerCase();
    if (subText.includes(res) || (res === "4k" && subText.includes("2160p"))) score += 8;
  }
  if (r.hearingImpaired && !hints.preferHearingImpaired) score -= 25;
  return score;
}

function sourcePriority(source: SubResult["source"]): number {
  switch (source) {
    case "addon":
      return 3;
    case "opensubtitles":
      return 2;
    case "wyzie":
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
