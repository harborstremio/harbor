// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import assert from "node:assert/strict";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import { readFileSync } from "node:fs";
// @ts-expect-error Node test types are intentionally outside the browser-only tsconfig.
import test from "node:test";
import { LIST_SEEDS } from "../src/lib/curated/catalog";
import { rankInItems, type CuratedListItem, type CuratedSnapshot } from "../src/lib/curated/types";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const index = JSON.parse(read("src/data/curated/index.json")) as {
  builtAt: string;
  lists: Array<{ id: string; count: number; snapshotDate: string; head: CuratedListItem[] }>;
};

const snapshotOf = (id: string) =>
  JSON.parse(read(`src/data/curated/${id}.json`)) as CuratedSnapshot;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

test("every descriptor has a snapshot and the index agrees with it", () => {
  assert.ok(DATE.test(index.builtAt), "index carries a build date");
  for (const seed of LIST_SEEDS) {
    const entry = index.lists.find((l) => l.id === seed.id);
    assert.ok(entry, `${seed.id} is in the index`);
    const snap = snapshotOf(seed.id);
    assert.equal(snap.id, seed.id);
    assert.equal(snap.count, snap.items.length, `${seed.id} count matches its items`);
    assert.equal(entry.count, snap.count, `${seed.id} index count matches the snapshot`);
    assert.equal(entry.snapshotDate, snap.snapshotDate);
    assert.ok(DATE.test(snap.snapshotDate), `${seed.id} snapshot date is a plain date`);
    assert.equal(
      entry.head.length,
      Math.min(seed.rowCount, snap.count),
      `${seed.id} head is the row slice`,
    );
    assert.deepEqual(entry.head, snap.items.slice(0, entry.head.length), `${seed.id} head matches`);
  }
});

test("a snapshot never publishes below the descriptor floor", () => {
  for (const seed of LIST_SEEDS) {
    const snap = snapshotOf(seed.id);
    assert.ok(
      snap.count >= seed.expectedCount,
      `${seed.id} holds ${snap.count}, floor is ${seed.expectedCount}`,
    );
  }
});

test("every item carries a usable IMDb id and a unique one", () => {
  for (const seed of LIST_SEEDS) {
    const snap = snapshotOf(seed.id);
    const seen = new Set<string>();
    for (const item of snap.items) {
      assert.match(item.imdb, /^tt\d+$/, `${seed.id} ${item.title} has an IMDb id`);
      assert.ok(!seen.has(item.imdb), `${seed.id} lists ${item.imdb} once`);
      seen.add(item.imdb);
      assert.ok(item.title.length > 0, `${seed.id} ${item.imdb} has a title`);
    }
  }
});

test("awarded lists run newest first and every item states its year", () => {
  const awarded = LIST_SEEDS.filter((s) => s.ordering === "awarded");
  assert.ok(awarded.length > 0, "the Wikidata tenants are declared");
  for (const seed of awarded) {
    const snap = snapshotOf(seed.id);
    let previous = Infinity;
    for (const item of snap.items) {
      assert.equal(item.rank, null, `${seed.id} ${item.title} claims no rank`);
      assert.equal(
        typeof item.awardYear,
        "number",
        `${seed.id} ${item.title} states the year it was honoured`,
      );
      assert.ok(
        item.awardYear <= previous,
        `${seed.id} year ${item.awardYear} follows ${previous}, so the order is broken`,
      );
      previous = item.awardYear;
    }
  }
});

test("ranked and spine lists stay in the curator's order", () => {
  for (const seed of LIST_SEEDS) {
    if (seed.ordering !== "ranked" && seed.ordering !== "spine") continue;
    const snap = snapshotOf(seed.id);
    let previous = 0;
    for (const item of snap.items) {
      assert.ok(item.rank != null, `${seed.id} ${item.title} carries a rank`);
      assert.ok(
        item.rank > previous,
        `${seed.id} rank ${item.rank} follows ${previous}, so the order is broken`,
      );
      previous = item.rank;
    }
  }
});

test("the ported NYT list keeps its published ranks", () => {
  const seed = LIST_SEEDS.find((s) => s.id === "nyt-tv-100");
  assert.ok(seed, "the NYT list is a descriptor rather than four files");
  assert.equal(seed.kind, "series");
  assert.equal(seed.ordering, "ranked");
  assert.equal(seed.source.kind, "bundled");
  const items = snapshotOf("nyt-tv-100").items;
  assert.equal(items.length, 100);
  assert.equal(rankInItems(items, "tt0903747"), 1);
  assert.equal(rankInItems(items, "tt0306414"), 2);
  assert.equal(rankInItems(items, "tt1837576"), 100);
  assert.equal(rankInItems(items, "tt0000000"), null);
  assert.equal(rankInItems(items, null), null);
});

test("the detail page can look a NYT rank up without loading a chunk", () => {
  const seed = LIST_SEEDS.find((s) => s.id === "nyt-tv-100");
  assert.ok(seed);
  const snap = snapshotOf("nyt-tv-100");
  assert.ok(
    seed.rowCount >= snap.count,
    "awards-block reads the eager head synchronously, so the head must be the whole list",
  );
  const canon = read("src/lib/curated/canon.ts");
  assert.match(canon, /if \(!eligible\(list, kind\) \|\| !complete\(list\)\) continue;/);
  assert.match(canon, /canonInItems\(list, list\.head, imdbId\)/);
  assert.match(read("src/components/awards-block.tsx"), /useCanon\(imdbId, kind\)/);
});

test("Criterion membership never pulls its snapshot", () => {
  const canon = read("src/lib/curated/canon.ts");
  assert.match(
    canon,
    /list\.id !== CRITERION_LIST_ID/,
    "the spine file answers Criterion, so the 125KB snapshot stays unloaded",
  );
  const spine = JSON.parse(read("src/data/criterion-spine.json")) as {
    count: number;
    spines: Record<string, number>;
  };
  assert.equal(spine.spines["tt0033467"], 1104);
  assert.ok(spine.count > 1000, "the spine file carries the whole collection");
});

test("the canon lists a viewer names are complete on disk even when the index head is short", () => {
  for (const id of ["sight-and-sound-2022", "afi-100-1998", "national-film-registry"]) {
    const seed = LIST_SEEDS.find((s) => s.id === id);
    assert.ok(seed, `${id} is a known list`);
    const snap = snapshotOf(id);
    const entry = index.lists.find((l) => l.id === id);
    assert.ok(entry, `${id} is indexed`);
    assert.ok(
      entry.head.length < snap.count,
      `${id} is the partial case the lazy load exists for`,
    );
    assert.equal(snap.items.length, snap.count, `${id} snapshot holds every item`);
  }
});

test("the Criterion snapshot is in spine order with sparse slots", () => {
  const seed = LIST_SEEDS.find((s) => s.id === "criterion-collection");
  assert.ok(seed);
  assert.equal(seed.ordering, "spine");
  const items = snapshotOf("criterion-collection").items;
  assert.equal(items[0].imdb, "tt0028950");
  assert.equal(items[4].imdb, "tt0053198");
  assert.ok(items.at(-1).rank > items.length, "spine slots are sparser than the item count");
});

test("the row and the page only badge a number the data carries", () => {
  const registry = read("src/lib/curated/registry.ts");
  assert.match(registry, /export function cardBadge[\s\S]*?ordering === "ranked"[\s\S]*?item\.rank/);
  assert.match(registry, /ordering === "spine"[\s\S]*?spineFor\(item\.imdb\)/);
  assert.match(registry, /ordering === "awarded"[\s\S]*?item\.awardYear/);
  const shared = "src/components/curated-card-badge.tsx";
  assert.match(read(shared), /cardBadge\(list, item\)/, "one component asks the registry");
  for (const path of [
    shared,
    "src/components/curated-list-row.tsx",
    "src/views/curated-list/list-grid.tsx",
  ]) {
    const source = read(path);
    assert.ok(!/\bindexOf\b|\bi \+ 1\b/.test(source), `${path} never counts positions itself`);
  }
  for (const path of ["src/components/curated-list-row.tsx", "src/views/curated-list/list-grid.tsx"]) {
    const source = read(path);
    assert.match(source, /<CuratedCardBadge list=\{list\} item=\{item\} \/>/, `${path} reuses it`);
  }
});

test("the Criterion spine sidecar is joined to the shipped list", () => {
  const spine = JSON.parse(read("src/data/criterion-spine.json")) as {
    builtAt: string;
    count: number;
    lowest: number;
    highest: number;
    spines: Record<string, number>;
  };
  assert.ok(DATE.test(spine.builtAt), "the sidecar carries a build date");
  assert.equal(spine.count, Object.keys(spine.spines).length);
  assert.ok(spine.count >= 1200, `${spine.count} spines, the floor is 1200`);
  assert.equal(spine.lowest, 1, "spine one exists");
  assert.ok(spine.highest > spine.count, "spine slots are sparser than the film count");
  assert.equal(spine.spines["tt0028950"], 1, "La Grande Illusion is spine one");
  assert.equal(spine.spines["tt0053198"], 5, "The 400 Blows is spine five");
  const items = snapshotOf("criterion-collection").items;
  const joined = items.filter((i) => spine.spines[i.imdb] != null).length;
  assert.ok(
    joined > items.length * 0.7,
    `only ${joined} of ${items.length} Criterion items resolve a spine number`,
  );
});

test("a festival badge names its prize without leaning on the curator line", () => {
  const badged = LIST_SEEDS.filter((s) => s.badge);
  assert.equal(badged.length, 8, "the eight unshipped festival prizes are badged");
  for (const seed of badged) {
    assert.equal(seed.ordering, "awarded", `${seed.id} badges an award year`);
    const snap = snapshotOf(seed.id);
    assert.ok(seed.rowCount >= snap.count, `${seed.id} head covers all ${snap.count} items`);
  }
  const shipped = JSON.parse(read("src/data/awards.json")) as Record<string, unknown>;
  for (const already of ["cannes", "venice", "berlin"]) {
    assert.ok(shipped[already], `${already} stays with the bundled award table`);
  }
  const badges = badged.map((s) => s.badge);
  assert.ok(!badges.includes("Palme d'Or"), "the top prizes already shipped are not duplicated");
  assert.ok(!badges.includes("Golden Lion"));
  assert.ok(!badges.includes("Golden Bear"));
});

test("no list descriptor duplicates an id or a pinned source", () => {
  const ids = new Set<string>();
  const sources = new Set<string>();
  for (const seed of LIST_SEEDS) {
    assert.ok(!ids.has(seed.id), `${seed.id} is declared once`);
    ids.add(seed.id);
    if (seed.source.kind === "wikidata") {
      const qid = seed.source.award;
      assert.match(qid, /^Q\d+$/, `${seed.id} pins a Wikidata item`);
      assert.ok(!sources.has(qid), `Wikidata item ${qid} is pinned once`);
      sources.add(qid);
      assert.equal(seed.source.url, `https://www.wikidata.org/wiki/${qid}`);
      continue;
    }
    if (seed.source.kind !== "trakt") continue;
    const key = String(seed.source.listId);
    assert.ok(!sources.has(key), `Trakt list ${key} is pinned once`);
    sources.add(key);
    assert.match(seed.source.url, /^https:\/\/trakt\.tv\/lists\/\d+$/);
    assert.ok(seed.source.url.endsWith(key), `${seed.id} url points at its pinned id`);
  }
});

test("only the rails Discover actually renders claim one", () => {
  const own = LIST_SEEDS.filter((s) => s.discoverRow === true).map((s) => s.id);
  assert.deepEqual(
    [...own].sort(),
    ["national-film-registry-latest", "nyt-tv-100"],
    "the rest reach the reader through the canon shelf",
  );
  const discover = read("src/views/discover.tsx");
  assert.match(discover, /listId="nyt-tv-100"/);
  assert.match(discover, /listId=\{REGISTRY_LATEST_LIST_ID\}/);
  assert.match(discover, /case "special:canon":/);
  assert.ok(!discover.includes("NytTvRow"), "the bespoke NYT row is gone");
});

test("English strings for every descriptor are registered", () => {
  const catalog = read("src/lib/i18n/locales/en/curated-lists.ts");
  const registered = read("src/lib/i18n/locales/en.ts");
  assert.match(registered, /import curatedLists from ".\/en\/curated-lists"/);
  assert.match(registered, /\.\.\.curatedLists,/);
  assert.match(registered, /import filmRegistry from ".\/en\/film-registry"/);
  assert.match(registered, /\.\.\.filmRegistry,/);
  const shipped = [
    catalog,
    read("src/lib/i18n/locales/en/nyt-tv.ts"),
    read("src/lib/i18n/locales/en/film-registry.ts"),
  ];
  for (const seed of LIST_SEEDS) {
    for (const value of [seed.title, seed.curator, seed.blurb]) {
      assert.ok(
        shipped.some((f) => f.includes(value)),
        `"${value.slice(0, 40)}" is in the English catalogue`,
      );
    }
  }
});
