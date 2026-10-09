import { writeFileSync } from "node:fs";

const ENDPOINT = "https://query.wikidata.org/sparql";
const UA = "HarborBlackAndWhiteIndex/1.0 (https://harbor.site)";
const OUT = process.argv[2] || "src/data/black-and-white.json";
const MIN_SITELINKS = Number(process.env.MIN_SITELINKS || 16);
const MIN_ROWS = Number(process.env.MIN_ROWS || 1200);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 75000);

const QUERY = `
SELECT ?film ?imdb ?links (SAMPLE(?tmdbId) AS ?tmdb) (SAMPLE(?yr) AS ?year) (SAMPLE(?label) AS ?title) WHERE {
  ?film wdt:P31 wd:Q11424 ;
        wdt:P462 wd:Q838368 ;
        wdt:P345 ?imdb ;
        wikibase:sitelinks ?links .
  FILTER NOT EXISTS { ?film wdt:P462 wd:Q22006653 }
  FILTER(?links >= ${MIN_SITELINKS})
  OPTIONAL { ?film wdt:P4947 ?tmdbId }
  OPTIONAL { ?film wdt:P577 ?date . BIND(YEAR(?date) AS ?yr) }
  ?film rdfs:label ?label . FILTER(LANG(?label) = "en")
}
GROUP BY ?film ?imdb ?links
ORDER BY DESC(?links)`;

async function run() {
  const started = Date.now();
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      accept: "application/sparql-results+json",
      "user-agent": UA,
    },
    body: new URLSearchParams({ query: QUERY }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const type = res.headers.get("content-type") ?? "";
  console.log(`sparql ${res.status} ${type.split(";")[0]} ${Date.now() - started}ms`);
  if (!res.ok || !type.includes("sparql-results+json")) {
    throw new Error(`unusable response: ${res.status} ${type}`);
  }
  return (await res.json()).results.bindings;
}

const bindings = await run();
const byImdb = new Map();
let fanout = 0;
for (const row of bindings) {
  const imdb = row.imdb?.value;
  if (!imdb || !/^tt\d+$/.test(imdb)) continue;
  if (byImdb.has(imdb)) {
    fanout += 1;
    continue;
  }
  const year = Number(row.year?.value ?? 0);
  const tmdb = Number(row.tmdb?.value ?? 0);
  byImdb.set(imdb, {
    imdb,
    title: row.title.value,
    ...(year > 1870 && year < 2100 ? { year } : {}),
    ...(tmdb > 0 ? { tmdb } : {}),
    links: Number(row.links.value),
  });
}

const films = [...byImdb.values()].sort(
  (a, b) => b.links - a.links || (a.year ?? 0) - (b.year ?? 0) || a.title.localeCompare(b.title),
);
console.log(`rows ${bindings.length} films ${films.length} collapsed ${fanout}`);
if (films.length < MIN_ROWS) {
  console.error(`refusing to write: ${films.length} films is below the ${MIN_ROWS} floor`);
  process.exit(1);
}

const decades = new Map();
for (const f of films) {
  if (!f.year) continue;
  const d = Math.floor(f.year / 10) * 10;
  decades.set(d, (decades.get(d) ?? 0) + 1);
}
console.log(
  [...decades]
    .sort((a, b) => a[0] - b[0])
    .map(([d, n]) => `${d}s ${n}`)
    .join("  "),
);
console.log(`head ${films.slice(0, 5).map((f) => f.title).join(", ")}`);

const payload = {
  builtAt: new Date().toISOString().slice(0, 10),
  minSitelinks: MIN_SITELINKS,
  count: films.length,
  films: films.map(({ links, ...rest }) => rest),
};
writeFileSync(OUT, `${JSON.stringify(payload)}\n`);
console.log(`wrote ${OUT}`);
