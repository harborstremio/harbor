const ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "HarborListSnapshot/1.0 (https://harbor.site) build-time list snapshot";
const LABELS = "en,mul,fr,de,it,es,pt,ja,ko,zh,ru";
const TIMEOUT_MS = 70000;
const MAX_RETRIES = 3;
const FILM = "?f wdt:P31/wdt:P279* wd:Q11424.";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function once(query) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/sparql-results+json",
        "user-agent": UA,
      },
      body: new URLSearchParams({ query }).toString(),
      signal: controller.signal,
    });
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && !type.includes("json")) {
      throw new Error(`200 as ${type || "no content type"}`);
    }
    if (!res.ok) {
      const after = Number(res.headers.get("retry-after") ?? "0");
      return { status: res.status, waitMs: after > 0 ? after * 1000 : 0 };
    }
    const data = await res.json();
    return { rows: data?.results?.bindings ?? [], ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

async function ask(query) {
  let last = "";
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      const result = await once(query);
      if (result.rows) return result;
      last = `HTTP ${result.status}`;
      if (attempt < MAX_RETRIES) await sleep(result.waitMs || attempt * 3000);
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_RETRIES) await sleep(attempt * 3000);
    }
  }
  throw new Error(`${last} after ${MAX_RETRIES} tries`);
}

function ceremonyQuery(award) {
  return `SELECT ?f ?fLabel (SAMPLE(?imdb) AS ?im) (SAMPLE(?tmdb) AS ?tm) (MIN(?ay) AS ?awarded) (MIN(?ry) AS ?year) WHERE {
  ?f p:P166 ?st.
  ?st ps:P166 wd:${award}.
  ?st pq:P585 ?d. BIND(YEAR(?d) AS ?ay)
  ${FILM}
  OPTIONAL { ?f wdt:P345 ?imdb }
  OPTIONAL { ?f wdt:P4947 ?tmdb }
  OPTIONAL { ?f wdt:P577 ?rd. BIND(YEAR(?rd) AS ?ry) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${LABELS}". }
} GROUP BY ?f ?fLabel ORDER BY DESC(?awarded)`;
}

function releaseQuery(award) {
  return `SELECT ?f ?fLabel (SAMPLE(?imdb) AS ?im) (SAMPLE(?tmdb) AS ?tm) (MIN(?ry) AS ?year) WHERE {
  ?f wdt:P166 wd:${award}.
  ${FILM}
  OPTIONAL { ?f wdt:P345 ?imdb }
  OPTIONAL { ?f wdt:P4947 ?tmdb }
  OPTIONAL { ?f wdt:P577 ?rd. BIND(YEAR(?rd) AS ?ry) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${LABELS}". }
} GROUP BY ?f ?fLabel ORDER BY DESC(?year)`;
}

const SPINE_QUERY = `SELECT ?f ?fLabel ?spine (SAMPLE(?imdb) AS ?im) WHERE {
  ?f wdt:P12279 ?spine.
  OPTIONAL { ?f wdt:P345 ?imdb. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${LABELS}". }
} GROUP BY ?f ?fLabel ?spine ORDER BY xsd:integer(?spine)`;

function cell(row, key) {
  const value = row?.[key]?.value;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function year(row, key) {
  const n = Number(cell(row, key));
  return Number.isFinite(n) && n > 1880 ? n : null;
}

function named(row) {
  const label = cell(row, "fLabel");
  if (!label || /^Q\d+$/.test(label)) return null;
  return label;
}

function bump(counts, key) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

export async function fetchWikidataList(source) {
  const query = source.awardYear === "ceremony" ? ceremonyQuery(source.award) : releaseQuery(source.award);
  const { rows, ms } = await ask(query);
  const skipped = new Map();
  const seen = new Set();
  const items = [];
  for (const row of rows) {
    const imdb = cell(row, "im");
    if (!imdb || !/^tt\d+$/.test(imdb)) {
      bump(skipped, "no imdb id");
      continue;
    }
    if (seen.has(imdb)) {
      bump(skipped, "duplicate imdb id");
      continue;
    }
    const title = named(row);
    if (!title) {
      bump(skipped, "no label in any read language");
      continue;
    }
    const awarded = source.awardYear === "ceremony" ? year(row, "awarded") : year(row, "year");
    if (awarded == null) {
      bump(skipped, "no award year");
      continue;
    }
    seen.add(imdb);
    const item = { rank: null, imdb, title, awardYear: awarded };
    const tmdb = Number(cell(row, "tm"));
    if (Number.isFinite(tmdb) && tmdb > 0) item.tmdb = tmdb;
    const released = year(row, "year");
    if (released != null) item.year = released;
    items.push(item);
  }
  items.sort((a, b) => b.awardYear - a.awardYear || a.title.localeCompare(b.title));
  return { items, rows: rows.length, skipped, ms };
}

export async function fetchCriterionSpines() {
  const { rows, ms } = await ask(SPINE_QUERY);
  const skipped = new Map();
  const spines = {};
  let lowest = Infinity;
  let highest = 0;
  for (const row of rows) {
    const imdb = cell(row, "im");
    const spine = Number(cell(row, "spine"));
    if (!imdb || !/^tt\d+$/.test(imdb)) {
      bump(skipped, "no imdb id");
      continue;
    }
    if (!Number.isInteger(spine) || spine < 1) {
      bump(skipped, "spine is not a whole number");
      continue;
    }
    if (spines[imdb] != null) {
      bump(skipped, "second spine for one film");
      continue;
    }
    spines[imdb] = spine;
    lowest = Math.min(lowest, spine);
    highest = Math.max(highest, spine);
  }
  return { spines, rows: rows.length, skipped, ms, lowest, highest };
}
