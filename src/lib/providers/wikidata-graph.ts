import { useEffect, useState } from "react";
import { lruSet } from "../cache";

const CACHE_KEY = "harbor.graph.wikidata.v2";
const STALE_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_MAX = 80;
const QUERY_TIMEOUT_MS = 12000;
const SIBLING_LIMIT = 120;
const SHARED_MIN = 3;

export type SharedCrewFilm = {
  metaId: string;
  name: string;
  shared: number;
  who: string[];
};

export type AdaptationSource = {
  qid: string;
  title: string;
  authors: string[];
  year?: number;
  openLibraryId?: string;
  gutenbergId?: string;
};

export type AdaptationSibling = {
  metaId: string;
  name: string;
  year?: number;
  kind: "movie" | "tv";
};

export type AdaptationFamily = {
  source: AdaptationSource;
  siblings: AdaptationSibling[];
};

export type GraphFacts = {
  crew: SharedCrewFilm[];
  family: AdaptationFamily | null;
  fetchedAt: number;
};

type Entry = GraphFacts;

const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<Entry>>();
const subs = new Set<() => void>();
let loaded = false;
let saveTimer: number | null = null;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw) as Record<string, Entry>;
    for (const [k, v] of Object.entries(obj)) cache.set(k, v);
  } catch {
    /* ignore */
  }
}

function persistSoon() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(cache)));
    } catch {
      /* ignore */
    }
  }, 5000);
}

function notify() {
  subs.forEach((fn) => fn());
}

const CREW_QUERY = `SELECT ?other ?otherLabel ?tmdb (COUNT(DISTINCT ?person) AS ?shared) (GROUP_CONCAT(DISTINCT ?personLabel; separator=" | ") AS ?who) WHERE {
  ?f wdt:P345 "IMDB_ID" .
  VALUES ?role { wdt:P57 wdt:P344 wdt:P86 wdt:P1040 wdt:P2554 wdt:P2515 wdt:P58 }
  ?f ?role ?person .
  ?other ?role ?person .
  ?other wdt:P31 wd:Q11424 ; wdt:P4947 ?tmdb .
  FILTER(?other != ?f)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". ?other rdfs:label ?otherLabel . ?person rdfs:label ?personLabel }
}
GROUP BY ?other ?otherLabel ?tmdb HAVING(COUNT(DISTINCT ?person) >= SHARED_MIN) ORDER BY DESC(?shared) LIMIT 12`;

const SOURCE_QUERY = `SELECT ?src ?srcLabel (MIN(?y) AS ?pub) (SAMPLE(?ol) AS ?olId) (SAMPLE(?gut) AS ?gutId) (GROUP_CONCAT(DISTINCT ?authorLabel; separator=" & ") AS ?authors) WHERE {
  ?f wdt:P345 "IMDB_ID" ; wdt:P144 ?src .
  OPTIONAL { ?src wdt:P50 ?author }
  OPTIONAL { ?src wdt:P648 ?ol }
  OPTIONAL { ?src wdt:P2034 ?gut }
  OPTIONAL { ?src wdt:P577 ?d . BIND(YEAR(?d) AS ?y) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". ?src rdfs:label ?srcLabel . ?author rdfs:label ?authorLabel }
}
GROUP BY ?src ?srcLabel
LIMIT 6`;

const SIBLING_QUERY = `SELECT ?src ?other ?otherLabel ?kind ?tmdb (MIN(?y) AS ?year) WHERE {
  ?f wdt:P345 "IMDB_ID" ; wdt:P144 ?src .
  ?other wdt:P144 ?src .
  VALUES (?prop ?kind) { (wdt:P4947 "movie") (wdt:P4983 "tv") }
  ?other ?prop ?tmdb .
  FILTER(?other != ?f)
  OPTIONAL { ?other wdt:P577 ?d . BIND(YEAR(?d) AS ?y) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul". ?other rdfs:label ?otherLabel }
}
GROUP BY ?src ?other ?otherLabel ?kind ?tmdb
ORDER BY ?year
LIMIT SIBLING_LIMIT`;

type Binding = Record<string, { value: string } | undefined>;

async function runQuery(query: string): Promise<Binding[] | null> {
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
  const abort = new AbortController();
  const timer = window.setTimeout(() => abort.abort(), QUERY_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/sparql-results+json" },
      signal: abort.signal,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: { bindings?: Binding[] } };
    const rows = json?.results?.bindings;
    return Array.isArray(rows) ? rows : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function num(row: Binding, key: string): number | undefined {
  const raw = row[key]?.value;
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function str(row: Binding, key: string): string | undefined {
  const raw = row[key]?.value?.trim();
  return raw ? raw : undefined;
}

function parseCrew(rows: Binding[]): SharedCrewFilm[] {
  const out: SharedCrewFilm[] = [];
  for (const row of rows) {
    const tmdb = str(row, "tmdb");
    const name = str(row, "otherLabel");
    const shared = num(row, "shared");
    if (!tmdb || !name || !shared || name.startsWith("http")) continue;
    out.push({
      metaId: `tmdb:movie:${tmdb}`,
      name,
      shared,
      who: (str(row, "who") ?? "").split(" | ").filter(Boolean),
    });
  }
  return out;
}

function parseSiblings(rows: Binding[]): Map<string, AdaptationSibling[]> {
  const bySource = new Map<string, Map<string, AdaptationSibling>>();
  for (const row of rows) {
    const src = str(row, "src");
    const tmdb = str(row, "tmdb");
    const name = str(row, "otherLabel");
    const kindRaw = str(row, "kind");
    if (!src || !tmdb || !name || name.startsWith("http")) continue;
    const kind = kindRaw === "tv" ? "tv" : "movie";
    const metaId = kind === "tv" ? `tmdb:tv:${tmdb}` : `tmdb:movie:${tmdb}`;
    let group = bySource.get(src);
    if (!group) {
      group = new Map();
      bySource.set(src, group);
    }
    if (group.has(metaId)) continue;
    group.set(metaId, { metaId, name, year: num(row, "year"), kind });
  }
  const out = new Map<string, AdaptationSibling[]>();
  for (const [src, group] of bySource) {
    const list = [...group.values()].sort(
      (a, b) => (a.year ?? Number.MAX_SAFE_INTEGER) - (b.year ?? Number.MAX_SAFE_INTEGER),
    );
    out.set(src, list);
  }
  return out;
}

function parseSources(rows: Binding[]): AdaptationSource[] {
function namedAuthors(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(" & ")
    .map((name) => name.trim())
    .filter((name) => name && !/^https?:\/\//i.test(name) && !/^Q\d+$/.test(name));
}

  const out: AdaptationSource[] = [];
  for (const row of rows) {
    const qid = str(row, "src");
    const title = str(row, "srcLabel");
    if (!qid || !title || title.startsWith("http")) continue;
    out.push({
      qid,
      title,
      authors: namedAuthors(str(row, "authors")),
      year: num(row, "pub"),
      openLibraryId: str(row, "olId"),
      gutenbergId: str(row, "gutId"),
    });
  }
  return out;
}

function pickFamily(
  sources: AdaptationSource[],
  siblings: Map<string, AdaptationSibling[]>,
): AdaptationFamily | null {
  let best: AdaptationFamily | null = null;
  let bestScore = -1;
  for (const source of sources) {
    const list = siblings.get(source.qid) ?? [];
    const score =
      list.length * 100 +
      (source.gutenbergId ? 8 : 0) +
      (source.openLibraryId ? 4 : 0) +
      (source.authors.length > 0 ? 2 : 0) +
      (source.year != null ? 1 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = { source, siblings: list };
    }
  }
  if (!best) return null;
  if (best.siblings.length === 0 && best.source.authors.length === 0) return null;
  return best;
}

export function graphCached(imdbId?: string): Entry | null {
  if (!imdbId) return null;
  load();
  const hit = cache.get(imdbId);
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > STALE_MS) return null;
  return hit;
}

const EMPTY: Entry = { crew: [], family: null, fetchedAt: 0 };

export async function fetchGraph(imdbId: string): Promise<Entry> {
  if (!/^tt\d+$/.test(imdbId)) return EMPTY;
  load();
  const hit = graphCached(imdbId);
  if (hit) return hit;
  const pending = inflight.get(imdbId);
  if (pending) return pending;
  const p = (async () => {
    const [crewRows, sourceRows, siblingRows] = await Promise.all([
      runQuery(CREW_QUERY.replace("IMDB_ID", imdbId).replace("SHARED_MIN", String(SHARED_MIN))),
      runQuery(SOURCE_QUERY.replace("IMDB_ID", imdbId)),
      runQuery(
        SIBLING_QUERY.replace("IMDB_ID", imdbId).replace("SIBLING_LIMIT", String(SIBLING_LIMIT)),
      ),
    ]);
    const entry: Entry = {
      crew: crewRows ? parseCrew(crewRows) : [],
      family: sourceRows ? pickFamily(parseSources(sourceRows), parseSiblings(siblingRows ?? [])) : null,
      fetchedAt: Date.now(),
    };
    if (crewRows !== null || sourceRows !== null) {
      lruSet(cache, imdbId, entry, CACHE_MAX);
      persistSoon();
    }
    notify();
    return entry;
  })().finally(() => inflight.delete(imdbId));
  inflight.set(imdbId, p);
  return p;
}

export function subscribeGraph(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

function useGraph(imdbId?: string): Entry | null {
  const [v, setV] = useState<Entry | null>(() => graphCached(imdbId));
  useEffect(() => {
    setV(graphCached(imdbId));
    if (!imdbId || !imdbId.startsWith("tt")) return;
    void fetchGraph(imdbId);
    return subscribeGraph(() => setV(graphCached(imdbId)));
  }, [imdbId]);
  return v;
}

export function useSharedCrew(imdbId?: string): SharedCrewFilm[] {
  return useGraph(imdbId)?.crew ?? [];
}

export function useAdaptationFamily(imdbId?: string): AdaptationFamily | null {
  return useGraph(imdbId)?.family ?? null;
}
