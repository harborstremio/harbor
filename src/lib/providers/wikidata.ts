import { useEffect, useState } from "react";
import { lruSet } from "../cache";

const CACHE_MAX = 300;

export type AwardType =
  | "oscar"
  | "emmy"
  | "golden_globe"
  | "bafta"
  | "sag"
  | "critics_choice"
  | "cannes"
  | "venice"
  | "berlin"
  | "other";

export type AwardEntry = {
  type: AwardType;
  awardName: string;
  category?: string;
  recipient?: string;
  recipients?: string[];
  year?: number;
  result: "won" | "nominated";
  workTitle?: string;
  workImdb?: string;
};

const CACHE_KEY = "harbor.awards.wikidata.v10";
const STALE_MS = 30 * 24 * 60 * 60 * 1000;

type Cached = { entries: AwardEntry[]; fetchedAt: number; complete: boolean };

const cache = new Map<string, Cached>();
const inflight = new Map<string, Promise<AwardEntry[]>>();
const subs = new Set<() => void>();
let loaded = false;
let saveTimer: number | null = null;

function load() {
  if (loaded) return;
  loaded = true;
  try {
    localStorage.removeItem("harbor.awards.wikidata.v8");
    localStorage.removeItem("harbor.awards.wikidata.v9");
  } catch {
    /* ignore */
  }
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) {
      const obj = JSON.parse(raw) as Record<string, Cached>;
      for (const [k, v] of Object.entries(obj)) cache.set(k, v);
    }
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

const QUERY = `SELECT DISTINCT ?award ?awardLabel ?category ?categoryLabel ?recipient ?recipientLabel ?date ?work ?workLabel ?workImdb WHERE {
  ?film wdt:P345 "IMDB_ID".
  {
    ?film p:P166 ?statement.
    ?statement ps:P166 ?award.
    OPTIONAL { ?statement pq:P585 ?date. }
    OPTIONAL { ?statement pq:P642 ?category. }
    OPTIONAL { ?statement pq:P1686 ?work. OPTIONAL { ?work wdt:P345 ?workImdb. } }
  }
  UNION
  {
    ?recipient p:P166 ?statement.
    ?statement pq:P1686 ?film.
    ?statement ps:P166 ?award.
    OPTIONAL { ?statement pq:P585 ?date. }
    OPTIONAL { ?statement pq:P642 ?category. }
    BIND(?film AS ?work)
    OPTIONAL { ?film wdt:P345 ?workImdb. }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 400`;

const NOMINATION_QUERY = `SELECT DISTINCT ?award ?awardLabel ?category ?categoryLabel ?recipient ?recipientLabel ?date ?work ?workLabel ?workImdb WHERE {
  ?film wdt:P345 "IMDB_ID".
  {
    ?film p:P1411 ?statement.
    ?statement ps:P1411 ?award.
    OPTIONAL { ?statement pq:P585 ?date. }
    OPTIONAL { ?statement pq:P642 ?category. }
    OPTIONAL { ?statement pq:P1686 ?work. OPTIONAL { ?work wdt:P345 ?workImdb. } }
  }
  UNION
  {
    ?recipient p:P1411 ?statement.
    ?statement pq:P1686 ?film.
    ?statement ps:P1411 ?award.
    OPTIONAL { ?statement pq:P585 ?date. }
    OPTIONAL { ?statement pq:P642 ?category. }
    BIND(?film AS ?work)
    OPTIONAL { ?film wdt:P345 ?workImdb. }
  }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
LIMIT 400`;

const CATEGORY_PREFIXES = [
  "Academy Award for ",
  "Primetime Creative Arts Emmy Award for ",
  "Primetime Emmy Award for ",
  "Creative Arts Emmy Award for ",
  "Daytime Emmy Award for ",
  "International Emmy Award for ",
  "Golden Globe Award for ",
  "British Academy Film Award for ",
  "BAFTA TV Award for ",
  "BAFTA Television Award for ",
  "BAFTA Award for ",
  "Screen Actors Guild Award for ",
  "Critics' Choice Movie Award for ",
  "Critics' Choice Television Award for ",
  "Critics' Choice Documentary Award for ",
  "Critics' Choice Real TV Award for ",
  "Critics' Choice Super Award for ",
  "Critics' Choice Award for ",
];

function prettyCategory(awardName: string, provided?: string): string | undefined {
  if (provided) return provided;
  for (const p of CATEGORY_PREFIXES) {
    if (awardName.startsWith(p)) {
      const rest = awardName.slice(p.length).trim();
      return rest || undefined;
    }
  }
  return awardName;
}

function classify(name: string): AwardType {
  const n = name.toLowerCase();
  if (n.includes("academy award") || n.includes("oscar")) return "oscar";
  if (n.includes("primetime emmy") || n.includes("emmy")) return "emmy";
  if (n.includes("golden globe")) return "golden_globe";
  if (n.includes("bafta") || n.includes("british academy")) return "bafta";
  if (n.includes("screen actors guild") || n.includes("sag award")) return "sag";
  if (n.includes("critics' choice") || n.includes("critics choice")) return "critics_choice";
  if (n.includes("palme") || n.includes("cannes")) return "cannes";
  if (n.includes("golden lion") || n.includes("venice")) return "venice";
  if (n.includes("golden bear") || n.includes("berlin")) return "berlin";
  return "other";
}

function parseRows(data: any, result: "won" | "nominated"): AwardEntry[] {
  const rows = data?.results?.bindings ?? [];
  const map = new Map<string, { entry: AwardEntry; recipients: Set<string> }>();
  for (const r of rows) {
    const awardName = r.awardLabel?.value;
    if (!awardName) continue;
    const category = prettyCategory(awardName, r.categoryLabel?.value);
    const recipient = r.recipientLabel?.value;
    const date = r.date?.value;
    const year = date ? new Date(date).getFullYear() : undefined;
    const workTitle =
      typeof r.workLabel?.value === "string" && !r.workLabel.value.startsWith("http")
        ? r.workLabel.value
        : undefined;
    const workImdb = typeof r.workImdb?.value === "string" ? r.workImdb.value : undefined;
    const key = `${awardName}|${category ?? ""}|${year ?? ""}|${result}|${workImdb ?? workTitle ?? ""}`;
    let bucket = map.get(key);
    if (!bucket) {
      bucket = {
        entry: {
          type: classify(awardName),
          awardName,
          category,
          year,
          result,
          workTitle,
          workImdb,
        },
        recipients: new Set<string>(),
      };
      map.set(key, bucket);
    } else {
      if (workTitle && !bucket.entry.workTitle) bucket.entry.workTitle = workTitle;
      if (workImdb && !bucket.entry.workImdb) bucket.entry.workImdb = workImdb;
    }
    if (recipient) bucket.recipients.add(recipient);
  }
  return [...map.values()]
    .map(({ entry, recipients }) => {
      const list = [...recipients];
      return {
        ...entry,
        recipient: list.length > 0 ? list.join(", ") : undefined,
        recipients: list.length > 0 ? list : undefined,
      };
    })
    .filter((e) => !isAggregateEntry(e));
}

const AGGREGATE_NAMES = [
  "golden globe awards",
  "academy awards",
  "bafta awards",
  "primetime emmy awards",
  "creative arts emmy awards",
  "international emmy awards",
  "emmy awards",
  "screen actors guild awards",
  "critics' choice awards",
  "tony awards",
  "grammy awards",
  "cannes film festival",
  "venice film festival",
  "berlin international film festival",
  "saturn awards",
];

function isAggregateEntry(entry: AwardEntry): boolean {
  const name = entry.awardName.toLowerCase().trim();
  const isBodyName = /\bawards$/i.test(entry.awardName.trim()) || AGGREGATE_NAMES.includes(name);
  if (!isBodyName) return false;
  const cat = entry.category?.toLowerCase().trim();
  if (cat && cat !== name) return false;
  return true;
}

function dropGenericDuplicates(entries: AwardEntry[]): AwardEntry[] {
  const keyOf = (e: AwardEntry) => `${e.awardName}|${e.category ?? ""}|${e.year ?? ""}|${e.result}`;
  const hasWork = new Set<string>();
  for (const e of entries) {
    if (e.workImdb || e.workTitle) hasWork.add(keyOf(e));
  }
  return entries.filter((e) => e.workImdb || e.workTitle || !hasWork.has(keyOf(e)));
}

async function runQuery(query: string): Promise<any | null> {
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;
  try {
    const res = await fetch(url, { headers: { Accept: "application/sparql-results+json" } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function awardsCached(imdbId?: string): AwardEntry[] | null {
  if (!imdbId) return null;
  load();
  const hit = cache.get(imdbId);
  if (!hit) return null;
  if (Date.now() - hit.fetchedAt > STALE_MS) return null;
  return hit.entries;
}

export async function fetchAwards(imdbId: string): Promise<AwardEntry[]> {
  if (!imdbId.startsWith("tt") && !imdbId.startsWith("nm")) return [];
  load();
  const hit = cache.get(imdbId);
  if (hit && hit.complete && Date.now() - hit.fetchedAt < STALE_MS) return hit.entries;
  if (inflight.has(imdbId)) return inflight.get(imdbId)!;
  const p = (async () => {
    const [winsData, nomsData] = await Promise.all([
      runQuery(QUERY.replace("IMDB_ID", imdbId)),
      runQuery(NOMINATION_QUERY.replace("IMDB_ID", imdbId)),
    ]);
    const wins = winsData ? parseRows(winsData, "won") : [];
    const allNoms = nomsData ? parseRows(nomsData, "nominated") : [];
    const overlapKey = (e: AwardEntry) =>
      `${e.awardName}|${e.category ?? ""}|${e.year ?? ""}|${e.workImdb ?? e.workTitle ?? ""}`;
    const winKeys = new Set(wins.map(overlapKey));
    const noms = allNoms.filter((n) => !winKeys.has(overlapKey(n)));
    const entries = dropGenericDuplicates([...wins, ...noms]);
    const complete = winsData !== null && nomsData !== null;
    lruSet(cache, imdbId, { entries, fetchedAt: Date.now(), complete }, CACHE_MAX);
    persistSoon();
    notify();
    return entries;
  })().finally(() => inflight.delete(imdbId));
  inflight.set(imdbId, p);
  return p;
}

export function subscribeAwards(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function useAwards(imdbId?: string): AwardEntry[] | null {
  const [v, setV] = useState<AwardEntry[] | null>(() => awardsCached(imdbId));
  useEffect(() => {
    setV(awardsCached(imdbId));
    if (imdbId) fetchAwards(imdbId);
    return subscribeAwards(() => setV(awardsCached(imdbId)));
  }, [imdbId]);
  return v;
}

export function awardSummary(entries: AwardEntry[]): {
  type: AwardType;
  wins: number;
  nominations: number;
}[] {
  const map = new Map<AwardType, { wins: number; nominations: number }>();
  for (const e of entries) {
    if (e.type === "other") continue;
    const cur = map.get(e.type) ?? { wins: 0, nominations: 0 };
    if (e.result === "won") cur.wins += 1;
    else cur.nominations += 1;
    map.set(e.type, cur);
  }
  const order: AwardType[] = [
    "oscar",
    "emmy",
    "bafta",
    "golden_globe",
    "sag",
    "cannes",
    "venice",
    "berlin",
    "critics_choice",
  ];
  return order
    .filter((t) => map.has(t))
    .map((t) => ({ type: t, ...(map.get(t) as { wins: number; nominations: number }) }));
}

export function awardTypeLabel(type: AwardType, n: number): string {
  const plural = n === 1 ? "" : "s";
  switch (type) {
    case "oscar":
      return `Oscar${plural}`;
    case "emmy":
      return `Emmy${plural === "s" ? "s" : ""}`;
    case "golden_globe":
      return `Golden Globe${plural}`;
    case "bafta":
      return `BAFTA${plural}`;
    case "sag":
      return `SAG Award${plural}`;
    case "critics_choice":
      return `Critics' Choice Award${plural}`;
    case "cannes":
      return `Cannes Award${plural}`;
    case "venice":
      return `Venice Award${plural}`;
    case "berlin":
      return `Berlin Award${plural}`;
    default:
      return `Award${plural}`;
  }
}
