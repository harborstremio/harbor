import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { MANUAL, NO_RECORD } from "./film-registry-manual.mjs";
import { craftCredits } from "./film-registry-roles.mjs";
import { buildIndex, resolve, titleForms } from "./film-registry-match.mjs";

// The same path without ?fo=json answers 403 to a non-browser client, so the query is load-bearing.
const LOC_URL =
  "https://www.loc.gov/programs/national-film-preservation-board/film-registry/complete-national-film-registry-listing/?fo=json";
const LOC_ORIGIN = "https://www.loc.gov";
const WDQS = "https://query.wikidata.org/sparql";
const CURATED_DIR = path.resolve("src/data/curated");
const REGISTRY_DIR = path.resolve("src/data/film-registry");
const LIST_ID = "national-film-registry";
const LATEST_ID = "national-film-registry-latest";
const MIN_FILMS = 900;
const MIN_MATCHED = 880;
const WDQS_TIMEOUT_MS = 45000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36";

const QUERY = `SELECT ?film (SAMPLE(?imdb) AS ?imdbId) (SAMPLE(?tmdb) AS ?tmdbId)
       (SAMPLE(?label) AS ?name) (MIN(?y) AS ?year)
       (GROUP_CONCAT(DISTINCT ?alt; separator="|") AS ?alts)
WHERE {
  # Wikidata models registry membership as part-of, not award-received: P166 here returns 10 rows.
  ?film wdt:P361 wd:Q823422 .
  OPTIONAL { ?film wdt:P345 ?imdb }
  OPTIONAL { ?film wdt:P4947 ?tmdb }
  OPTIONAL { ?film wdt:P577 ?d . BIND(YEAR(?d) AS ?y) }
  OPTIONAL { ?film rdfs:label ?label . FILTER(LANG(?label) = "en") }
  OPTIONAL { ?film skos:altLabel ?alt . FILTER(LANG(?alt) = "en") }
}
GROUP BY ?film`;

const PROBE_QUERY = (literals) => `SELECT ?probe ?film ?imdb (SAMPLE(?tmdb) AS ?tmdbId) (SAMPLE(?lab) AS ?name) (MIN(?y) AS ?year)
WHERE {
  VALUES ?probe { ${literals} }
  { ?film rdfs:label ?probe } UNION { ?film skos:altLabel ?probe }
  ?film wdt:P345 ?imdb .
  OPTIONAL { ?film wdt:P4947 ?tmdb }
  OPTIONAL { ?film wdt:P577 ?d . BIND(YEAR(?d) AS ?y) }
  OPTIONAL { ?film rdfs:label ?lab . FILTER(LANG(?lab) = "en") }
}
GROUP BY ?probe ?film ?imdb`;

const SEARCH_QUERY = (literals) => `SELECT ?probe ?item ?imdb (SAMPLE(?tmdb) AS ?tmdbId) (SAMPLE(?lab) AS ?name) (MIN(?y) AS ?year)
WHERE {
  VALUES ?probe { ${literals} }
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:endpoint "www.wikidata.org" ;
                    wikibase:api "EntitySearch" ;
                    mwapi:search ?probe ;
                    mwapi:language "en" ;
                    mwapi:limit "12" .
    ?item wikibase:apiOutputItem mwapi:item .
  }
  ?item wdt:P345 ?imdb .
  OPTIONAL { ?item wdt:P4947 ?tmdb }
  OPTIONAL { ?item wdt:P577 ?d . BIND(YEAR(?d) AS ?y) }
  OPTIONAL { ?item rdfs:label ?lab . FILTER(LANG(?lab) = "en") }
}
GROUP BY ?probe ?item ?imdb`;

const ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  hellip: "...",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
};

function plain(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]*>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
    .replace(/\s+/g, " ")
    .trim();
}

function key(title, year) {
  return `${plain(title).toLowerCase()}::${String(year ?? "").trim()}`;
}

async function fetchListing() {
  const res = await fetch(LOC_URL, { headers: { "user-agent": UA, accept: "application/json" } });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok) throw new Error(`loc.gov returned ${res.status}`);
  if (!type.includes("application/json")) throw new Error(`loc.gov returned ${res.status} as ${type || "no content type"}`);
  const declared = Number(res.headers.get("content-length") ?? "0");
  const text = await res.text();
  const bytes = Buffer.byteLength(text);
  if (declared > 0 && bytes !== declared) {
    throw new Error(`truncated: ${bytes} bytes read against ${declared} declared`);
  }
  const body = JSON.parse(text);
  const components = body?.content?.components;
  if (!Array.isArray(components)) throw new Error("no content.components array");
  const listing = components
    .filter((c) => Array.isArray(c?.items))
    .sort((a, b) => b.items.length - a.items.length)[0];
  if (!listing) throw new Error("no component carries an items array");
  if (listing.items.length < MIN_FILMS) {
    throw new Error(`${listing.items.length} items, expected at least ${MIN_FILMS}`);
  }
  console.log(`  loc.gov: ${bytes.toLocaleString()} bytes, ${listing.items.length} items`);
  return listing.items;
}

async function ask(query, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WDQS_TIMEOUT_MS);
  try {
    const res = await fetch(WDQS, {
      method: "POST",
      signal: controller.signal,
      headers: {
        accept: "application/sparql-results+json",
        "content-type": "application/x-www-form-urlencoded",
        "user-agent": "Harbor/snapshot-film-registry",
      },
      body: new URLSearchParams({ query }),
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.includes("json")) {
      console.log(`  ${label}: ${res.status} ${type || "no content type"}, degrading`);
      return [];
    }
    return (await res.json())?.results?.bindings ?? [];
  } catch (e) {
    console.log(`  ${label}: ${e.name}, degrading`);
    return [];
  } finally {
    clearTimeout(timer);
  }
}

async function fetchRegistry() {
  const rows = await ask(QUERY, "wikidata registry");
  if (rows.length === 0) return rows;
  const withImdb = rows.filter((r) => r.imdbId?.value).length;
  console.log(`  wikidata registry: ${rows.length} rows, ${withImdb} with an IMDb id`);
  return rows;
}

function probeTitles(films) {
  const titles = new Set();
  for (const film of films) for (const form of titleForms(film.title, film.sort_title)) titles.add(form);
  return [...titles];
}

async function fetchProbe(films) {
  if (films.length === 0) return [];
  const titles = probeTitles(films);
  const literals = titles.map((t) => JSON.stringify(t) + "@en").join(" ");
  const rows = await ask(PROBE_QUERY(literals), "wikidata titles");
  console.log(`  wikidata titles: ${titles.length} probes for ${films.length} leftovers, ${rows.length} rows`);
  return rows;
}

async function fetchSearch(films) {
  if (films.length === 0) return [];
  const titles = probeTitles(films);
  const literals = titles.map((t) => JSON.stringify(t)).join(" ");
  const rows = await ask(SEARCH_QUERY(literals), "wikidata search");
  console.log(`  wikidata search: ${titles.length} probes for ${films.length} leftovers, ${rows.length} rows`);
  return rows;
}

function reconcile(films, indexes) {
  const manual = new Map(MANUAL.map((m) => [key(m.title, m.year), m.imdb]));
  const declined = new Set(NO_RECORD.map((m) => key(m.title, m.year)));
  const seen = new Map();
  const matched = [];
  const unmatched = [];
  const stale = [];

  for (const film of films) {
    const k = key(film.title, film.year_released);
    const override = manual.get(k);
    if (override) manual.delete(k);
    let auto = null;
    if (!override) {
      for (const index of indexes) {
        auto = resolve(film, index);
        if (auto) break;
      }
    }
    const imdb = override ?? auto?.imdb ?? null;
    if (declined.has(k)) {
      declined.delete(k);
      unmatched.push(film);
      continue;
    }
    if (!imdb) {
      unmatched.push(film);
      continue;
    }
    const clash = seen.get(imdb);
    if (clash) {
      throw new Error(
        `${imdb} claimed by both "${clash}" and "${film.title}", add one to the manual table`,
      );
    }
    seen.set(imdb, film.title);
    matched.push({ film, imdb, tmdb: override ? null : (auto?.tmdb ?? null) });
  }

  for (const k of manual.keys()) stale.push(`manual ${k}`);
  for (const k of declined) stale.push(`declined ${k}`);
  return { matched, unmatched, stale };
}

function essayOf(film) {
  for (const link of film.links ?? []) {
    const title = plain(link.title);
    if (!/essay/i.test(title) || !link.url) continue;
    const by = title.match(/\bby\s+(.+)$/i)?.[1]?.trim();
    const url = /^https?:/i.test(link.url) ? link.url : `${LOC_ORIGIN}${link.url}`;
    return by ? { by, url } : { url };
  }
  return null;
}

function inductionYear(film) {
  const year = Number(film.year_inducted);
  return Number.isFinite(year) ? year : null;
}

async function main() {
  console.log(`[${LIST_ID}] Library of Congress: the National Film Registry`);
  const films = await fetchListing();
  const registryIndex = buildIndex(await fetchRegistry(), ["name", "alts"]);
  const claimed = new Set(MANUAL.map((m) => key(m.title, m.year)));
  const open = (indexes) =>
    films.filter(
      (f) =>
        !claimed.has(key(f.title, f.year_released)) && !indexes.some((index) => resolve(f, index)),
    );
  const probeIndex = buildIndex(await fetchProbe(open([registryIndex])), ["probe", "name"]);
  const indexes = [registryIndex, probeIndex];
  const searchIndex = buildIndex(await fetchSearch(open(indexes)), ["probe", "name"]);
  indexes.push(searchIndex);
  const { matched, unmatched, stale } = reconcile(films, indexes);

  console.log(
    `  reconciled ${matched.length} of ${films.length} (${((matched.length / films.length) * 100).toFixed(1)} percent), ${unmatched.length} without a film record`,
  );
  for (const s of stale) console.log(`  stale table row, no longer in the listing: ${s}`);
  if (matched.length < MIN_MATCHED) {
    throw new Error(`${matched.length} reconciled, the floor is ${MIN_MATCHED}`);
  }

  const classes = [...new Set(films.map(inductionYear).filter((y) => y != null))].sort((a, b) => a - b);
  const latestClass = classes[classes.length - 1];
  const snapshotDate = new Date().toISOString().slice(0, 10);

  const collator = new Intl.Collator("en", {
    numeric: true,
    sensitivity: "base",
    ignorePunctuation: true,
  });
  matched.sort((a, b) =>
    collator.compare(
      plain(a.film.sort_title || a.film.title),
      plain(b.film.sort_title || b.film.title),
    ),
  );

  const items = [];
  const inductions = {};
  const entries = {};
  for (const { film, imdb, tmdb } of matched) {
    const inducted = inductionYear(film);
    const item = { rank: null, imdb, title: plain(film.title), awardYear: inducted };
    if (tmdb != null) item.tmdb = tmdb;
    const released = plain(film.year_released);
    const year = Number(released.slice(0, 4));
    if (Number.isFinite(year)) item.year = year;
    items.push(item);
    if (inducted != null) inductions[imdb] = inducted;
    const entry = {};
    if (released && released !== String(year)) entry.years = released;
    const note = plain(film.description);
    if (note) entry.note = note;
    const essay = essayOf(film);
    if (essay) entry.essay = essay;
    const crew = craftCredits(film.contributors);
    if (crew.length > 0) entry.crew = crew;
    if (Object.keys(entry).length > 0) entries[imdb] = entry;
  }
  const latest = items.filter((i) => i.awardYear === latestClass);
  await mkdir(CURATED_DIR, { recursive: true });
  await mkdir(REGISTRY_DIR, { recursive: true });
  await writeFile(
    path.join(CURATED_DIR, `${LIST_ID}.json`),
    JSON.stringify({ id: LIST_ID, count: items.length, snapshotDate, items }),
  );
  await writeFile(
    path.join(CURATED_DIR, `${LATEST_ID}.json`),
    JSON.stringify({ id: LATEST_ID, count: latest.length, snapshotDate, items: latest }),
  );
  await writeFile(
    path.join(REGISTRY_DIR, "inductions.json"),
    JSON.stringify({ builtAt: snapshotDate, latestClass, count: Object.keys(inductions).length, inductions }),
  );
  await writeFile(
    path.join(REGISTRY_DIR, "entries.json"),
    JSON.stringify({ builtAt: snapshotDate, entries }),
  );

  const withNote = Object.values(entries).filter((e) => e.note).length;
  const withEssay = Object.values(entries).filter((e) => e.essay?.by).length;
  const withCrew = Object.values(entries).filter((e) => e.crew).length;
  const entryBytes = (await readFile(path.join(REGISTRY_DIR, "entries.json"))).byteLength;
  console.log(
    `  wrote ${items.length} items, ${latest.length} in the ${latestClass} class, ${classes.length} classes from ${classes[0]}`,
  );
  console.log(
    `  entries: ${withNote} with a note, ${withEssay} with a signed essay, ${withCrew} with craft credits, ${Math.round(entryBytes / 1024)} KB`,
  );
  if (unmatched.length > 0) {
    console.log(`  no film record for ${unmatched.length}:`);
    for (const f of unmatched) console.log(`    ${plain(f.year_released) || "----"}  ${plain(f.title)}`);
  }
}

await main();
