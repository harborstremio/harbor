import { existsSync, readFileSync, writeFileSync } from "node:fs";

const KEY = process.env.TMDB_KEY;
if (!KEY) {
  console.error("TMDB_KEY missing");
  process.exit(1);
}
const OUT = process.argv[2] || "brand-index.json";
const OUT_TOP = OUT.replace(/\.json$/, "-top.json");
const TALLY = OUT.replace(/\.json$/, "-tally.json");
const STAGE = process.env.STAGE || "all";
const BASE = "https://api.themoviedb.org/3";
const LIMIT = Number(process.env.LIMIT || 8);
const MOVIE_PAGES = Number(process.env.MOVIE_PAGES || 500);
const TV_PAGES = Number(process.env.TV_PAGES || 500);
const KEEP_STUDIOS = Number(process.env.KEEP_STUDIOS || 5000);
const KEEP_NETWORKS = Number(process.env.KEEP_NETWORKS || 2000);
const MIN_COUNT = Number(process.env.MIN_COUNT || 2);
const TOP = Number(process.env.TOP || 60);
const ART_POOL = 8;
const ART_PER_BRAND = 3;
const SKIP_NETWORKS = new Set(["syndication"]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let active = 0;
const waiting = [];
let pausedUntil = 0;
async function slot() {
  if (active < LIMIT) active += 1;
  else await new Promise((resolve) => waiting.push(resolve));
  const wait = pausedUntil - Date.now();
  if (wait > 0) await sleep(wait);
}
function release() {
  const next = waiting.shift();
  if (next) next();
  else active -= 1;
}

let requests = 0;
let throttled = 0;
async function get(path, params = {}) {
  const url = new URL(`${BASE}/${path}`);
  url.searchParams.set("api_key", KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 40; attempt++) {
    await slot();
    let res = null;
    try {
      requests += 1;
      res = await fetch(url);
    } catch {
      release();
      await sleep(Math.min(8000, 500 * (attempt + 1)));
      continue;
    }
    if (res.status === 429) {
      throttled += 1;
      const wait = Math.max(1000, Number(res.headers.get("retry-after") || 2) * 1000);
      pausedUntil = Math.max(pausedUntil, Date.now() + wait);
      release();
      await sleep(wait + 250);
      continue;
    }
    if (res.status === 404 || res.status === 422) {
      release();
      return null;
    }
    if (!res.ok) {
      release();
      await sleep(Math.min(8000, 500 * (attempt + 1)));
      continue;
    }
    try {
      const json = await res.json();
      release();
      return json;
    } catch {
      release();
      await sleep(500);
    }
  }
  throw new Error(`gave up on ${path}`);
}

const mapAll = (items, fn) => Promise.all(items.map((it, i) => fn(it, i)));

function sortsFor(media) {
  const common = [
    { sort_by: "popularity.desc", "vote_count.gte": 20 },
    { sort_by: "vote_count.desc" },
    { sort_by: "vote_average.desc", "vote_count.gte": 200 },
  ];
  return media === "movie" ? [...common, { sort_by: "revenue.desc", "vote_count.gte": 50 }] : common;
}

async function collectIds(media, pages) {
  const ids = new Map();
  const jobs = sortsFor(media).flatMap((params) => Array.from({ length: pages }, (_, i) => ({ params, page: i + 1 })));
  await mapAll(jobs, async ({ params, page }) => {
    const res = await get(`discover/${media}`, { ...params, page, include_adult: "false" }).catch(() => null);
    for (const r of res?.results ?? []) {
      if (typeof r.id !== "number") continue;
      ids.set(r.id, Math.max(ids.get(r.id) ?? 0, r.popularity ?? 0));
    }
  });
  return ids;
}

const studios = new Map();
const networks = new Map();

function tally(map, entry, weight, media) {
  if (!entry || typeof entry.id !== "number" || !entry.name) return;
  const cur = map.get(entry.id);
  if (cur) {
    cur.count += 1;
    cur.score += weight;
    cur[media] += 1;
    if (!cur.logo && entry.logo_path) cur.logo = entry.logo_path;
    if (!cur.country && entry.origin_country) cur.country = entry.origin_country;
    return;
  }
  map.set(entry.id, {
    id: entry.id,
    name: entry.name,
    logo: entry.logo_path ?? null,
    country: entry.origin_country || null,
    count: 1,
    score: weight,
    tv: media === "tv" ? 1 : 0,
    movie: media === "movie" ? 1 : 0,
  });
}

const weightOf = (pop) => 1 + Math.min(pop ?? 0, 400) / 100;

async function harvestTitles(media, ids) {
  let done = 0;
  let failed = 0;
  await mapAll([...ids.entries()], async ([id, pop]) => {
    const d = await get(`${media}/${id}`).catch(() => {
      failed += 1;
      return null;
    });
    done += 1;
    if (done % 2000 === 0) console.log(`  ${media} ${done}/${ids.size} (requests ${requests}, throttled ${throttled}, failed ${failed})`);
    if (!d) return;
    const w = weightOf(pop);
    for (const c of d.production_companies ?? []) tally(studios, c, w, media);
    if (media === "tv") for (const n of d.networks ?? []) tally(networks, n, w, media);
  });
}

function yearOf(s) {
  if (typeof s !== "string" || s.length < 4) return null;
  const n = Number(s.slice(0, 4));
  return Number.isFinite(n) && n > 1880 ? n : null;
}

async function enrich(kind, brand) {
  const media = kind === "network" ? "tv" : brand.tv > brand.movie ? "tv" : "movie";
  const filterKey = kind === "network" ? "with_networks" : "with_companies";
  const bare = {
    i: brand.id,
    n: brand.name,
    l: brand.logo,
    c: brand.country,
    m: media === "tv" ? "t" : "m",
    s: Math.round(brand.score * 10) / 10,
    k: brand.count,
    y: "",
    r: null,
    g: [],
    pool: [],
  };
  const page = await get(`discover/${media}`, {
    [filterKey]: brand.id,
    sort_by: "popularity.desc",
    "vote_count.gte": 20,
    include_adult: "false",
  }).catch(() => null);
  const results = page?.results ?? [];
  if (results.length === 0) return bare;
  const rated = results.filter((r) => (r.vote_count ?? 0) >= 100 && typeof r.vote_average === "number");
  const rating = rated.length ? Math.round((rated.reduce((s, r) => s + r.vote_average, 0) / rated.length) * 10) / 10 : null;
  const years = results.map((r) => yearOf(r.release_date ?? r.first_air_date)).filter((y) => y !== null);
  const span = years.length > 1 ? `${Math.min(...years)} to ${Math.max(...years)}` : years.length === 1 ? String(years[0]) : "";
  const genreCounts = new Map();
  for (const r of results) for (const g of r.genre_ids ?? []) genreCounts.set(g, (genreCounts.get(g) ?? 0) + 1);
  const genres = [...genreCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([g]) => g);
  const pool = results.filter((r) => typeof r.id === "number" && r.poster_path).slice(0, ART_POOL).map((r) => ({ id: r.id, p: r.poster_path }));
  return { ...bare, k: page.total_results ?? results.length, y: span, r: rating, g: genres, pool };
}

function assignArt(list) {
  const claimed = new Set();
  return list.map((b) => {
    const fresh = b.pool.filter((p) => !claimed.has(p.id));
    const picks = fresh.length >= ART_PER_BRAND ? fresh.slice(0, ART_PER_BRAND) : b.pool.slice(0, ART_PER_BRAND);
    for (const p of picks) claimed.add(p.id);
    const { pool: _pool, ...rest } = b;
    return { ...rest, a: picks.map((p) => p.p) };
  });
}

async function build(kind, list, keep) {
  const ranked = list
    .filter((b) => b.count >= MIN_COUNT && !(kind === "network" && SKIP_NETWORKS.has(b.name.toLowerCase())))
    .sort((a, b) => b.score - a.score)
    .slice(0, keep);
  console.log(`${kind}: ${list.length} seen, ${ranked.length} kept, enriching`);
  let done = 0;
  const enriched = await mapAll(ranked, async (b) => {
    const e = await enrich(kind, b);
    done += 1;
    if (done % 1000 === 0) console.log(`  ${kind} enriched ${done}/${ranked.length} (requests ${requests}, throttled ${throttled})`);
    return e;
  });
  enriched.sort((a, b) => b.s - a.s);
  return assignArt(enriched);
}

const t0 = Date.now();
let tallyData;
if (STAGE !== "enrich" || !existsSync(TALLY)) {
  console.log(`collecting title ids (movie ${MOVIE_PAGES} pages x ${sortsFor("movie").length} sorts, tv ${TV_PAGES} x ${sortsFor("tv").length}, limit ${LIMIT})`);
  const [movieIds, tvIds] = await Promise.all([collectIds("movie", MOVIE_PAGES), collectIds("tv", TV_PAGES)]);
  console.log(`movies ${movieIds.size}, shows ${tvIds.size} (requests ${requests}, throttled ${throttled}, ${Math.round((Date.now() - t0) / 1000)}s)`);
  await Promise.all([harvestTitles("movie", movieIds), harvestTitles("tv", tvIds)]);
  tallyData = { studios: [...studios.values()], networks: [...networks.values()] };
  writeFileSync(TALLY, JSON.stringify(tallyData));
  console.log(`studios seen ${studios.size}, networks seen ${networks.size}; tally saved (requests ${requests}, throttled ${throttled}, ${Math.round((Date.now() - t0) / 1000)}s)`);
  if (STAGE === "collect") process.exit(0);
} else {
  tallyData = JSON.parse(readFileSync(TALLY, "utf8"));
  console.log(`loaded tally: ${tallyData.studios.length} studios, ${tallyData.networks.length} networks`);
}
const [studio, network] = await Promise.all([build("studio", tallyData.studios, KEEP_STUDIOS), build("network", tallyData.networks, KEEP_NETWORKS)]);
const builtAt = new Date().toISOString().slice(0, 10);
const full = { builtAt, studio, network };
const top = { builtAt, studio: studio.slice(0, TOP), network: network.slice(0, TOP) };
writeFileSync(OUT, JSON.stringify(full));
writeFileSync(OUT_TOP, JSON.stringify(top));
console.log(
  `wrote ${OUT} (${studio.length} studios, ${network.length} networks, ${Math.round(JSON.stringify(full).length / 1024)} KB) and ${OUT_TOP} (${Math.round(JSON.stringify(top).length / 1024)} KB); ${requests} requests, throttled ${throttled}, ${Math.round((Date.now() - t0) / 1000)}s`,
);
