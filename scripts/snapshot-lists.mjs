import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { register } from "node:module";
import { fetchCriterionSpines, fetchWikidataList } from "./wikidata-lists.mjs";

register("./scripts/node-test-loader.mjs", pathToFileURL("./"));

const { LIST_SEEDS } = await import("@/lib/curated/catalog");

const OUT_DIR = path.resolve("src/data/curated");
const INDEX = path.join(OUT_DIR, "index.json");
const SPINE_FILE = path.resolve("src/data/criterion-spine.json");
const SPINE_FLOOR = 1200;
const CONFIG = path.resolve("src/lib/trakt/config.ts");
const API = "https://api.trakt.tv";
const POLITE_DELAY_MS = 400;
const MAX_RETRIES = 4;

const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function traktClientId() {
  const source = await readFile(CONFIG, "utf8");
  const match = source.match(/TRAKT_CLIENT_ID\s*=\s*"([0-9a-f]{40,})"/);
  if (!match) throw new Error(`no TRAKT_CLIENT_ID in ${CONFIG}`);
  return match[1];
}

async function traktPage(clientId, listId, page) {
  const url = `${API}/lists/${listId}/items?limit=250&page=${page}`;
  for (let attempt = 1; ; attempt += 1) {
    const res = await fetch(url, {
      headers: {
        "trakt-api-version": "2",
        "trakt-api-key": clientId,
        accept: "application/json",
        // Trakt's edge answers 403 with text/html to node's default undici agent; any named one is fine.
        "user-agent": "Harbor/snapshot-lists",
      },
    });
    const type = res.headers.get("content-type") ?? "";
    if (res.ok && !type.includes("application/json")) {
      throw new Error(`${url} returned ${res.status} as ${type || "no content type"}`);
    }
    if (res.ok) {
      return {
        items: await res.json(),
        itemCount: Number(res.headers.get("x-pagination-item-count") ?? "0"),
        pageLimit: Number(res.headers.get("x-pagination-limit") ?? "0"),
        pageCount: Number(res.headers.get("x-pagination-page-count") ?? "0"),
      };
    }
    if (attempt >= MAX_RETRIES) throw new Error(`${url} returned ${res.status}`);
    const retryAfter = Number(res.headers.get("retry-after") ?? "0");
    await sleep(retryAfter > 0 ? retryAfter * 1000 : attempt * 1500);
  }
}

function normalise(raw, seed, skipped) {
  const out = [];
  for (const entry of raw) {
    const kind = entry?.type === "movie" ? "movie" : entry?.type === "show" ? "series" : null;
    if (!kind) {
      skipped.set(entry?.type ?? "unknown", (skipped.get(entry?.type ?? "unknown") ?? 0) + 1);
      continue;
    }
    const body = entry[entry.type];
    const imdb = body?.ids?.imdb;
    if (!imdb || !/^tt\d+$/.test(imdb)) {
      skipped.set("no imdb id", (skipped.get("no imdb id") ?? 0) + 1);
      continue;
    }
    const item = {
      rank: typeof entry.rank === "number" ? entry.rank : null,
      imdb,
      title: String(body.title ?? "").trim(),
    };
    if (typeof body.ids.tmdb === "number") item.tmdb = body.ids.tmdb;
    if (typeof body.year === "number") item.year = body.year;
    if (kind !== seed.kind) item.type = kind;
    const note = typeof entry.notes === "string" ? entry.notes.trim() : "";
    if (note) item.note = note;
    out.push(item);
  }
  return out;
}

function checkAwardYears(seed, items) {
  const problems = [];
  const missing = items.filter((i) => typeof i.awardYear !== "number").length;
  if (missing > 0) problems.push(`${missing} of ${items.length} items carry no award year`);
  for (let i = 1; i < items.length; i += 1) {
    if ((items[i].awardYear ?? 0) > (items[i - 1].awardYear ?? 0)) {
      problems.push(`award year ${items[i].awardYear} follows ${items[i - 1].awardYear}`);
      break;
    }
  }
  return problems;
}

function checkOrdering(seed, items) {
  if (seed.ordering === "awarded") return checkAwardYears(seed, items);
  if (seed.ordering === "unordered") return [];
  const problems = [];
  const missing = items.filter((i) => i.rank == null).length;
  if (missing > 0) problems.push(`${missing} of ${items.length} items carry no rank`);
  const ranks = items.map((i) => i.rank).filter((r) => r != null);
  for (let i = 1; i < ranks.length; i += 1) {
    if (ranks[i] <= ranks[i - 1]) {
      problems.push(`rank ${ranks[i]} follows ${ranks[i - 1]}, so the sequence is not ordered`);
      break;
    }
  }
  return problems;
}

async function readSnapshot(id) {
  try {
    return JSON.parse(await readFile(path.join(OUT_DIR, `${id}.json`), "utf8"));
  } catch {
    return null;
  }
}

async function fetchTrakt(clientId, seed) {
  const items = [];
  const skipped = new Map();
  let itemCount = 0;
  let pageCount = 1;
  for (let page = 1; page <= pageCount; page += 1) {
    const res = await traktPage(clientId, seed.source.listId, page);
    if (page === 1) {
      itemCount = res.itemCount;
      pageCount = Math.max(1, res.pageCount);
      const pages = pageCount === 1 ? "1 page" : `${pageCount} pages`;
      console.log(
        `  ${itemCount} items per x-pagination-item-count, ${pages} of ${res.pageLimit}`,
      );
    }
    items.push(...normalise(res.items, seed, skipped));
    if (page < pageCount) await sleep(POLITE_DELAY_MS);
  }
  if (skipped.size > 0) {
    console.log(`  skipped ${[...skipped].map(([k, v]) => `${v} ${k}`).join(", ")}`);
  }
  return { items, itemCount };
}

async function fetchWikidata(seed) {
  const { items, rows, skipped, ms } = await fetchWikidataList(seed.source);
  console.log(`  ${rows} rows from ${seed.source.award} in ${ms} ms`);
  if (skipped.size > 0) {
    console.log(`  skipped ${[...skipped].map(([k, v]) => `${v} ${k}`).join(", ")}`);
  }
  return { items, itemCount: rows };
}

async function snapshot(clientId, seed) {
  const previous = await readSnapshot(seed.id);
  if (seed.source.kind === "bundled") {
    if (!previous) {
      console.log(`  no bundled snapshot on disk, nothing to refresh`);
      return { ok: false, previous: null };
    }
    console.log(`  bundled, kept at ${previous.count} items from ${previous.snapshotDate}`);
    return { ok: true, kept: true, snapshot: previous };
  }

  const { items, itemCount } =
    seed.source.kind === "wikidata" ? await fetchWikidata(seed) : await fetchTrakt(clientId, seed);
  const problems = [];
  if (items.length < seed.expectedCount) {
    problems.push(`${items.length} usable items, the descriptor expects at least ${seed.expectedCount}`);
  }
  if (previous && items.length < previous.count) {
    problems.push(`shrank from ${previous.count} to ${items.length}`);
  }
  problems.push(...checkOrdering(seed, items));
  if (items.length > seed.expectedCount) {
    console.log(`  grew to ${items.length} of ${itemCount} slots, descriptor floor ${seed.expectedCount}`);
  }

  if (problems.length > 0) {
    for (const p of problems) console.log(`  refused: ${p}`);
    return { ok: false, previous };
  }

  const next = {
    id: seed.id,
    count: items.length,
    snapshotDate: new Date().toISOString().slice(0, 10),
    source: seed.source,
    items,
  };
  await writeFile(path.join(OUT_DIR, `${seed.id}.json`), JSON.stringify(next));
  console.log(`  wrote ${items.length} items`);
  return { ok: true, snapshot: next };
}

async function writeIndex() {
  const names = (await readdir(OUT_DIR)).filter((n) => n.endsWith(".json") && n !== "index.json");
  const bySeed = new Map(LIST_SEEDS.map((s) => [s.id, s]));
  const lists = [];
  for (const name of names.sort()) {
    const id = name.slice(0, -".json".length);
    const seed = bySeed.get(id);
    if (!seed) {
      console.log(`index: ${id} has a snapshot but no descriptor, skipped`);
      continue;
    }
    const snap = JSON.parse(await readFile(path.join(OUT_DIR, name), "utf8"));
    lists.push({
      id,
      count: snap.count,
      snapshotDate: snap.snapshotDate,
      head: snap.items.slice(0, seed.rowCount),
    });
  }
  lists.sort((a, b) => LIST_SEEDS.findIndex((s) => s.id === a.id) - LIST_SEEDS.findIndex((s) => s.id === b.id));
  const index = { builtAt: new Date().toISOString().slice(0, 10), lists };
  await writeFile(INDEX, JSON.stringify(index, null, 2));
  const bytes = JSON.stringify(index).length;
  console.log(
    `\nindex: ${lists.length} lists, ${lists.reduce((n, l) => n + l.count, 0)} items, head ${Math.round(bytes / 1024)} KB`,
  );
}

async function writeSpines() {
  console.log(`\n[criterion-spine] Criterion: spine numbers`);
  let result;
  try {
    result = await fetchCriterionSpines();
  } catch (err) {
    console.log(`  refused: ${err instanceof Error ? err.message : String(err)}`);
    return 1;
  }
  const { spines, rows, skipped, ms, lowest, highest } = result;
  const count = Object.keys(spines).length;
  console.log(`  ${rows} rows in ${ms} ms, ${count} with an IMDb id, spines ${lowest} to ${highest}`);
  if (skipped.size > 0) {
    console.log(`  skipped ${[...skipped].map(([k, v]) => `${v} ${k}`).join(", ")}`);
  }
  if (count < SPINE_FLOOR) {
    console.log(`  refused: ${count} spines, the floor is ${SPINE_FLOOR}`);
    return 1;
  }
  await writeFile(
    SPINE_FILE,
    JSON.stringify({
      builtAt: new Date().toISOString().slice(0, 10),
      count,
      lowest,
      highest,
      spines,
    }),
  );
  console.log(`  wrote ${count} spine numbers`);
  return 0;
}

const clientId = await traktClientId();
let refused = 0;
await mkdir(OUT_DIR, { recursive: true });
for (const seed of LIST_SEEDS) {
  if (only.length > 0 && !only.includes(seed.id)) continue;
  console.log(`\n[${seed.id}] ${seed.curator}: ${seed.title}`);
  const result = await snapshot(clientId, seed);
  if (!result.ok) {
    refused += 1;
    if (result.previous) console.log(`  kept ${result.previous.count} items from ${result.previous.snapshotDate}`);
  }
  if (seed.source.kind !== "bundled") await sleep(POLITE_DELAY_MS);
}
await writeIndex();
if (only.length === 0 || only.includes("criterion-spine")) {
  refused += await writeSpines();
}
if (refused > 0) {
  console.log(`\n${refused} list(s) refused, the previous snapshot still serves`);
  process.exit(1);
}
