import { dinfo, dwarn } from "@/lib/debug";
import { safeFetch } from "@/lib/safe-fetch";

import { normalizeLang } from "../language";
import type { SubResult, SubSearchQuery } from "../types";

const ENDPOINTS = [
  "https://opensubtitles.stremio.homes",
  "https://opensubtitles-v3.strem.io",
  "https://opensubtitles.strem.io",
];

type RawSub = {
  id?: string;
  url: string;
  lang: string;
  m?: string;
  SubFormat?: string;
  fps?: number;
  encoding?: string;
};

function buildId(q: SubSearchQuery): string | null {
  if (!q.imdbId) return null;
  let id = q.imdbId.startsWith("tt") ? q.imdbId : `tt${q.imdbId}`;
  if (q.season != null && q.episode != null && !id.includes(":")) {
    id = `${id}:${q.season}:${q.episode}`;
  }
  return id;
}

async function callEndpoint(base: string, type: string, id: string): Promise<RawSub[]> {
  const url = `${base}/subtitles/${type}/${id}.json`;
  try {
    const res = await safeFetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      dwarn(`[opensubtitles-v3] ${url} → ${res.status}`);
      return [];
    }
    const data = (await res.json()) as { subtitles?: RawSub[] };
    const list = Array.isArray(data?.subtitles) ? data.subtitles : [];
    dinfo(`[opensubtitles-v3] ${url} → ${list.length} subs`);
    return list;
  } catch (e) {
    dwarn(`[opensubtitles-v3] ${url} fetch error`, e);
    return [];
  }
}

export async function searchOpenSubtitlesV3(q: SubSearchQuery): Promise<SubResult[]> {
  const id = buildId(q);
  if (!id) {
    dinfo("[opensubtitles-v3] no imdbId, skipping");
    return [];
  }
  const isEpisode = q.season != null && q.episode != null;
  const type = isEpisode || id.includes(":") ? "series" : "movie";

  const results = await Promise.all(ENDPOINTS.map((base) => callEndpoint(base, type, id)));
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
    return {
      id: String(s.id ?? `os3:${s.url}`),
      url: s.url,
      lang,
      title: `OpenSubtitles V3 #${n}`,
      source: "opensubtitles" as const,
      format: (s.SubFormat?.toLowerCase() as SubResult["format"]) || undefined,
      encoding: s.encoding,
      fps: s.fps,
    };
  });
}
