import { COLLECTIONS_CATALOG, type CatalogCollection } from "@/lib/collections-catalog";
import type { Collection, CollectionItem } from "@/lib/collections";
import {
  fetchCommunityCollections,
  type CommunityCollection,
} from "@/lib/social/collections-sync";
import { searchTvdbCollectionsOrNull } from "@/lib/providers/tvdb-collections";
import { tmdbCollectionsFeed } from "@/lib/providers/tmdb";
import type { CategoryHit } from "@/views/collections/use-category-feed";
import {
  BP_COLLECTIONS_ALL,
  BP_CURATED_NAMES,
  bpCatalogFor,
  bpMapLimit,
  bpStripCollectionSuffix,
  resolveBpCollection,
} from "./use-bp-collections";

export type BpCollectionSource = "all" | "mine" | "community" | "tvdb" | "tmdb";

export const BP_COLLECTION_SOURCES: BpCollectionSource[] = [
  "all",
  "mine",
  "community",
  "tmdb",
  "tvdb",
];

export type BpCollectionOpen =
  | { kind: "tmdb"; collectionId: number; name: string; image: string | null }
  | { kind: "tvdb"; collectionId: number; name: string; image: string | null }
  | {
      kind: "items";
      name: string;
      byline: string | null;
      image: string | null;
      items: CollectionItem[];
      hidden: number;
    };

export type BpCollectionEntry = {
  key: string;
  source: Exclude<BpCollectionSource, "all">;
  name: string;
  image: string | null;
  count: number | null;
  byline: string | null;
  open: BpCollectionOpen;
};

const TMDB_PAGE = 24;
export const HYDRATE_LANES = 4;
const TVDB_NAMES_PER_PULL = 5;
const TVDB_HITS_PER_NAME = 3;
const TVDB_ALL_CAP = 10;
export const STEPS_PER_PULL = 3;
const MIN_PARTS = 2;

const TVDB_SEEDS = COLLECTIONS_CATALOG.map((c) => c.name);

type Phase = "community" | "curated" | "tvdb" | "feed";

// The open ended TMDB search runs last so the finite sources are all reachable
// by scrolling rather than buried behind 500 pages of it.
const PHASES: Record<BpCollectionSource, Phase[]> = {
  all: ["community", "curated", "tvdb", "feed"],
  mine: [],
  community: ["community"],
  tvdb: ["tvdb"],
  tmdb: ["curated", "feed"],
};

export type Ctx = {
  key: string;
  category: string;
  phases: Phase[];
  catalog: CatalogCollection[];
  tvdbCap: number;
  at: number;
  curated: number;
  page: number;
  name: number;
  seen: Set<string>;
  tvdbMore: boolean;
  communityFailed: boolean;
  tvdbFailed: boolean;
};

export function makeCtx(source: BpCollectionSource, category: string, key: string): Ctx {
  return {
    key,
    category,
    phases: PHASES[source],
    catalog: bpCatalogFor(category),
    tvdbCap: source === "all" ? TVDB_ALL_CAP : TVDB_SEEDS.length,
    at: 0,
    curated: 0,
    page: 0,
    name: 0,
    seen: new Set(),
    tvdbMore: false,
    communityFailed: false,
    tvdbFailed: false,
  };
}

function firstPoster(items: CollectionItem[]): string | null {
  for (const it of items) if (it.poster) return it.poster;
  return null;
}

export function ownedEntry(
  c: Collection,
  source: "mine" | "community",
  byline: string | null,
): BpCollectionEntry {
  const shown = c.items.filter((it) => it.type !== "manga");
  return {
    key: `${source}:${byline ?? ""}:${c.id}`,
    source,
    name: c.name,
    image: c.coverImage ?? c.bgImage ?? firstPoster(c.items),
    count: c.items.length,
    byline,
    open: {
      kind: "items",
      name: c.name,
      byline,
      image: c.bgImage ?? c.coverImage ?? null,
      items: shown,
      hidden: c.items.length - shown.length,
    },
  };
}

function communityEntry(c: CommunityCollection): BpCollectionEntry {
  return ownedEntry(c, "community", c.displayName || c.handle);
}

export function tmdbEntry(id: number, name: string, image: string | null, count: number | null): BpCollectionEntry {
  return {
    key: `tmdb:${id}`,
    source: "tmdb",
    name,
    image,
    count,
    byline: null,
    open: { kind: "tmdb", collectionId: id, name, image },
  };
}

export function categoryEntry(h: CategoryHit): BpCollectionEntry {
  return tmdbEntry(h.id, h.name, h.backdrop, h.count);
}

function fresh(ctx: Ctx, list: BpCollectionEntry[]): BpCollectionEntry[] {
  const out: BpCollectionEntry[] = [];
  for (const e of list) {
    if (ctx.seen.has(e.key)) continue;
    ctx.seen.add(e.key);
    out.push(e);
  }
  return out;
}

async function stepCommunity(ctx: Ctx): Promise<BpCollectionEntry[]> {
  ctx.at += 1;
  const list = await fetchCommunityCollections().catch(() => null);
  if (!list) {
    ctx.communityFailed = true;
    return [];
  }
  return fresh(ctx, list.map(communityEntry));
}

async function stepTvdb(ctx: Ctx): Promise<BpCollectionEntry[]> {
  const limit = Math.min(TVDB_SEEDS.length, ctx.tvdbCap);
  if (ctx.name >= limit) {
    ctx.at += 1;
    ctx.tvdbMore = limit < TVDB_SEEDS.length;
    return [];
  }
  const slice = TVDB_SEEDS.slice(ctx.name, Math.min(ctx.name + TVDB_NAMES_PER_PULL, limit));
  ctx.name += slice.length;
  let broke = 0;
  const groups = await bpMapLimit(slice, 3, async (n) => {
    const hits = await searchTvdbCollectionsOrNull(n).catch(() => null);
    if (hits) return hits;
    broke += 1;
    return [];
  });
  ctx.tvdbFailed = broke === slice.length;
  const flat = groups.flatMap((g) =>
    g.slice(0, TVDB_HITS_PER_NAME).map(
      (h): BpCollectionEntry => ({
        key: `tvdb:${h.id}`,
        source: "tvdb",
        name: h.name,
        image: h.image,
        count: null,
        byline: null,
        open: { kind: "tvdb", collectionId: h.id, name: h.name, image: h.image },
      }),
    ),
  );
  return fresh(ctx, flat);
}

async function stepCurated(ctx: Ctx): Promise<BpCollectionEntry[]> {
  if (!ctx.key || ctx.curated >= ctx.catalog.length) {
    ctx.at += 1;
    return [];
  }
  const slice = ctx.catalog.slice(ctx.curated, ctx.curated + TMDB_PAGE);
  ctx.curated += slice.length;
  const rows = await bpMapLimit(slice, HYDRATE_LANES, async (c) => ({
    c,
    found: await resolveBpCollection(ctx.key, c.id, c.name),
  }));
  const out: BpCollectionEntry[] = [];
  for (const { c, found } of rows) {
    // An entry that neither loads by id nor heals by name has no art, no count
    // and opens onto an empty detail, so it is dropped rather than faked.
    if (!found) continue;
    out.push(
      tmdbEntry(
        found.id,
        bpStripCollectionSuffix(found.name || c.name),
        found.backdrop ?? null,
        found.parts.length,
      ),
    );
  }
  return fresh(ctx, out);
}

async function stepTmdbFeed(ctx: Ctx): Promise<BpCollectionEntry[]> {
  if (!ctx.key || ctx.category !== BP_COLLECTIONS_ALL) {
    ctx.at += 1;
    return [];
  }
  const page = ctx.page + 1;
  const { hits, totalPages } = await tmdbCollectionsFeed(ctx.key, page).catch(() => ({
    hits: [],
    totalPages: 0,
  }));
  ctx.page = page;
  if (hits.length === 0 || page >= totalPages) ctx.at += 1;
  const wanted = hits.filter(
    (h) => !BP_CURATED_NAMES.has(bpStripCollectionSuffix(h.name).toLowerCase()),
  );
  const rows = await bpMapLimit(wanted, HYDRATE_LANES, async (h) => ({
    h,
    found: await resolveBpCollection(ctx.key, h.id, h.name),
  }));
  const out: BpCollectionEntry[] = [];
  for (const { h, found } of rows) {
    if (!found || found.parts.length < MIN_PARTS) continue;
    out.push(
      tmdbEntry(
        found.id,
        bpStripCollectionSuffix(found.name || h.name),
        found.backdrop ?? h.backdrop,
        found.parts.length,
      ),
    );
  }
  return fresh(ctx, out);
}

export function step(ctx: Ctx): Promise<BpCollectionEntry[]> {
  const phase = ctx.phases[ctx.at];
  if (phase === "community") return stepCommunity(ctx);
  if (phase === "curated") return stepCurated(ctx);
  if (phase === "tvdb") return stepTvdb(ctx);
  if (phase === "feed") return stepTmdbFeed(ctx);
  return Promise.resolve([]);
}
