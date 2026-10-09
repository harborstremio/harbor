import { dinfo, dwarn } from "@/lib/debug";
import { safeFetch } from "@/lib/safe-fetch";
import type { SubResult, SubSearchQuery } from "../types";
import { normalizeLang } from "../language";
import {
  classifyProviderSubtitleMetadata,
  type ProviderSubtitleFlags,
} from "../provider-classification";

const ENDPOINTS = ["https://opensubtitles-v3.strem.io"];

type RawSub = ProviderSubtitleFlags & {
  id?: string;
  url: string;
  lang: string;
  m?: string;
  SubFormat?: string;
  fps?: number;
  encoding?: string;
};

function scopedIds(q: SubSearchQuery): Array<{ id: string; type: "series" | "movie" }> {
  const tt = q.imdbId!.startsWith("tt") ? q.imdbId! : `tt${q.imdbId!}`;
  if (q.season != null && q.episode != null) {
    return [{ id: `${tt}:${q.season}:${q.episode}`, type: "series" }];
  }
  if (q.episode != null) {
    return [{ id: `${tt}:1:${q.episode}`, type: "series" }];
  }
  return [{ id: tt, type: q.type === "series" ? "series" : "movie" }];
}

async function callEndpoint(base: string, type: string, id: string): Promise<RawSub[]> {
  const url = `${base}/subtitles/${type}/${id}.json`;
  try {
    const res = await safeFetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      dwarn(`[opensubtitles-v3] endpoint returned ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { subtitles?: RawSub[] };
    const list = Array.isArray(data?.subtitles) ? data.subtitles : [];
    dinfo(`[opensubtitles-v3] endpoint returned ${list.length} subtitles`);
    return list;
  } catch {
    dwarn("[opensubtitles-v3] endpoint fetch failed");
    return [];
  }
}

export async function searchOpenSubtitlesV3(q: SubSearchQuery): Promise<SubResult[]> {
  if (!q.imdbId) {
    dinfo("[opensubtitles-v3] no imdbId, skipping");
    return [];
  }
  const targets = scopedIds(q);

  const results = await Promise.all(
    ENDPOINTS.flatMap((base) => targets.map((t) => callEndpoint(base, t.type, t.id))),
  );
  const seen = new Set<string>();
  const merged: RawSub[] = [];
  for (const list of results) {
    for (const s of list) {
      if (!s.url) continue;
      const key = `${s.lang}|${s.url}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(s);
    }
  }
  const perLang = new Map<string, number>();
  return merged.map((s) => {
    const lang = normalizeLang(s.lang);
    const n = (perLang.get(lang) ?? 0) + 1;
    perLang.set(lang, n);
    const classification = classifyProviderSubtitleMetadata(s, [s.m, s.id, s.url]);
    return {
      id: `os3:${s.id ?? s.url}`,
      url: s.url,
      lang,
      title: `OpenSubtitles V3 #${n}`,
      source: "opensubtitles" as const,
      format: (s.SubFormat?.toLowerCase() as SubResult["format"]) || undefined,
      encoding: s.encoding,
      fps: s.fps,
      release: s.m || undefined,
      ...classification,
    };
  });
}
