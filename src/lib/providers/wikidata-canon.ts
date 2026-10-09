import { useEffect, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { countryQid } from "./country-qid";
import { cacheGet, cachePeek, cacheSet } from "./tmdb/brand-cache";

export type CanonTitle = { imdb: string; title: string; year: number | null };

type Cached = { at: number; titles: CanonTitle[] };

const TTL_MS = 30 * 24 * 60 * 60 * 1000;
const ABORT_MS = 20000;
const LIMIT = 120;
const MIN_REACH = 5;
export const MIN_CANON = 8;

const ENDPOINT = "https://query.wikidata.org/sparql";

const inflight = new Map<string, Promise<CanonTitle[]>>();

function cacheKey(iso: string, mediaType: "movie" | "tv"): string {
  return `canon:v1:${mediaType}:${iso.toUpperCase()}`;
}

function query(qid: string, mediaType: "movie" | "tv"): string {
  const type = mediaType === "tv" ? "wdt:P31/wdt:P279* wd:Q5398426" : "wdt:P31 wd:Q11424";
  const dated = mediaType === "tv" ? "wdt:P580" : "wdt:P577";
  return `SELECT ?w ?wl (MIN(?y) AS ?year) (SAMPLE(?id) AS ?imdb) (SAMPLE(?s) AS ?reach) WHERE {
  ?w ${type} ; wdt:P495 wd:${qid} ; wikibase:sitelinks ?s . FILTER(?s >= ${MIN_REACH})
  ?w wdt:P345 ?id
  OPTIONAL { ?w ${dated} ?d BIND(YEAR(?d) AS ?y) }
  ?w rdfs:label ?wl FILTER(LANG(?wl)="en")
} GROUP BY ?w ?wl ORDER BY DESC(?reach) LIMIT ${LIMIT}`;
}

type Row = Record<string, { value?: string } | undefined>;

function parse(data: unknown): CanonTitle[] {
  const rows = (data as { results?: { bindings?: Row[] } } | null)?.results?.bindings ?? [];
  const seen = new Set<string>();
  const out: CanonTitle[] = [];
  for (const row of rows) {
    const imdb = row.imdb?.value;
    const title = row.wl?.value;
    if (!imdb || !title || !imdb.startsWith("tt") || seen.has(imdb)) continue;
    seen.add(imdb);
    const year = Number(row.year?.value);
    out.push({ imdb, title, year: Number.isFinite(year) && year > 1880 ? year : null });
  }
  return out;
}

async function run(qid: string, mediaType: "movie" | "tv"): Promise<CanonTitle[] | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ABORT_MS);
  const url = `${ENDPOINT}?format=json&query=${encodeURIComponent(query(qid, mediaType))}`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/sparql-results+json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    if ((res.headers.get("content-type") ?? "").includes("html")) return null;
    return parse(await res.json());
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function canonPeek(iso: string, mediaType: "movie" | "tv"): CanonTitle[] | null {
  const hit = cachePeek<Cached>(cacheKey(iso, mediaType));
  if (!hit || Date.now() - hit.at > TTL_MS) return null;
  return hit.titles;
}

export async function fetchCanon(iso: string, mediaType: "movie" | "tv"): Promise<CanonTitle[]> {
  const qid = countryQid(iso);
  if (!qid) return [];
  const key = cacheKey(iso, mediaType);
  const running = inflight.get(key);
  if (running) return running;
  const p = (async () => {
    const hit = await cacheGet<Cached>(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.titles;
    const titles = await run(qid, mediaType);
    if (titles === null) return hit?.titles ?? [];
    await cacheSet(key, { at: Date.now(), titles });
    return titles;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export function canonMeta(title: CanonTitle, mediaType: "movie" | "tv"): Meta {
  return {
    id: title.imdb,
    type: mediaType === "tv" ? "series" : "movie",
    name: title.title,
    poster: `https://images.metahub.space/poster/small/${title.imdb}/img`,
    background: `https://images.metahub.space/background/medium/${title.imdb}/img`,
    releaseInfo: title.year ? String(title.year) : undefined,
  };
}

export function useCountryCanon(iso: string, mediaType: "movie" | "tv"): CanonTitle[] | null {
  const [titles, setTitles] = useState<CanonTitle[] | null>(() => canonPeek(iso, mediaType));
  useEffect(() => {
    let alive = true;
    setTitles(canonPeek(iso, mediaType));
    void fetchCanon(iso, mediaType).then((list) => {
      if (alive) setTitles(list);
    });
    return () => {
      alive = false;
    };
  }, [iso, mediaType]);
  return titles;
}
