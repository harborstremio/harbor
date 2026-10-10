import { CATALOG_PAGE_SIZE, type CatalogFilters } from "./catalog-filters";
import { parseAtlasSummary } from "./igdb-data";
import { savedMetadataAt } from "./metadata-records";
import type { GameCatalogPage, GameSummary } from "./types";

type Provider = "Steam" | "IGDB";
export type GameSearchCursor = { steam: number | null; igdb: number | null };
export type UnifiedGameSearchPage = GameCatalogPage & {
  searchCursor?: GameSearchCursor;
  unavailable?: Provider[];
};
type Sources = {
  steam: (query: string, filters: CatalogFilters, offset: number, signal?: AbortSignal) => Promise<GameCatalogPage>;
  igdb: (body: string, signal?: AbortSignal) => Promise<unknown[]>;
  savedSteam: (query: string, filters: CatalogFilters) => Promise<GameCatalogPage | null>;
  savedIgdb: (body: string) => Promise<unknown[] | null>;
  suggest?: (query:string,signal?:AbortSignal)=>Promise<GameSummary[]>;
  savedSuggest?: (query:string)=>Promise<GameSummary[]|null>;
};

/** These fields have Steam-specific meaning and cannot truthfully filter another catalog. */
export function hasSteamSearchFilters(filters: CatalogFilters): boolean {
  return !!(filters.tags.length || filters.features?.length || filters.price !== "all" ||
    filters.controller || filters.mode === "39" || filters.developer || filters.publisher ||
    filters.sort === "Price_ASC" || filters.sort === "Reviews_DESC");
}

export const normalizeGameSearchTitle = (value: string): string => value.replace(/[™®©]/g, "").normalize("NFKD")
  .replace(/\p{M}/gu, "").toLocaleLowerCase("en")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");

export function unifiedIgdbQuery(query: string, filters: CatalogFilters, offset = 0, names = false): string {
  const term = query.trim().slice(0, 160).replace(/["\\\x00-\x1f]/g, " ");
  const clauses: string[] = [];
  const platform = { win: 6, mac: 14, linux: 3 };
  const mode = { "2": 1, "1": 2, "9": 3, "20": 5 };
  if (filters.platform !== "all") clauses.push(`platforms = (${platform[filters.platform]})`);
  if (filters.mode !== "all" && filters.mode !== "39") clauses.push(`game_modes = (${mode[filters.mode]})`);
  // No cover/version/type restriction: console editions, Classic, fan games and hacks are searchable.
  const fields = "name,game_type,total_rating_count,cover.image_id,screenshots.image_id,first_release_date,platforms.name,external_games.external_game_source,external_games.uid";
  const start = Math.max(0, Math.floor(Number.isFinite(offset) ? offset : 0));
  const order = filters.sort === "Name_ASC" ? "name asc" : filters.sort === "Released_DESC" ? "first_release_date desc" : null;
  if (order || names) clauses.unshift(`(name ~ *"${term}"* | alternative_names.name ~ *"${term}"*)`);
  return `${order || names ? `sort ${order??'total_rating_count desc'};` : `search "${term}";`} fields ${fields};${clauses.length ? ` where ${clauses.join(" & ")};` : ""} limit ${CATALOG_PAGE_SIZE}; offset ${start};`;
}

function atlasSummaries(rows: unknown[]): GameSummary[] {
  return rows.flatMap(value => {
    const game = parseAtlasSummary(value);
    if (!game) return [];
    const release = (value as { first_release_date?: unknown }).first_release_date;
    return [{ ...game, ...(typeof release === "number" && Number.isFinite(release) && release > 0
      ? { releaseTimestamp: release, comingSoon: release * 1000 > Date.now() } : {}) }];
  });
}

function matchRank(name: string, query: string): number {
  if (name === query) return 0;
  if (name.startsWith(query)) return 1;
  if (` ${name} `.includes(` ${query} `)) return 2;
  if (query.split(" ").every(word => name.split(" ").some(part=>part.startsWith(word)))) return 3;
  return 4;
}

/** Merge identity evidence, never similar names: originals/remakes/Classic stay distinct. */
export function mergeGameSearchResults(query: string, games: GameSummary[], sort: CatalogFilters["sort"] = "_ASC"): GameSummary[] {
  const merged = new Map<string, GameSummary>();
  for (const game of games) {
    const key = game.steamId ? `steam:${game.steamId}` : game.id;
    const existing = merged.get(key);
    merged.set(key, existing ? {
      ...game, ...existing, id: key,
      igdbId: existing.igdbId ?? game.igdbId,
      gameType: existing.gameType ?? game.gameType,
      igdbRatingCount: existing.igdbRatingCount ?? game.igdbRatingCount,
      capsule: existing.capsule || game.capsule,
      portrait: existing.portrait || game.portrait,
      releaseTimestamp: existing.releaseTimestamp ?? game.releaseTimestamp,
      comingSoon: existing.comingSoon ?? game.comingSoon,
      platforms: [...new Set([...existing.platforms, ...game.platforms].map(platform =>
        platform === "PC (Microsoft Windows)" ? "Windows" : platform === "Mac" ? "macOS" : platform))],
      cachedAt: savedMetadataAt([existing, game]),
    } : { ...game, id: key });
  }
  const term = normalizeGameSearchTitle(query);
  return [...merged.values()].sort((a, b) => {
    if (sort === "Name_ASC") return a.name.localeCompare(b.name);
    if (sort === "Released_DESC") return (b.releaseTimestamp ?? 0) - (a.releaseTimestamp ?? 0);
    if (sort !== "_ASC") return 0;
    const an = normalizeGameSearchTitle(a.name), bn = normalizeGameSearchTitle(b.name);
    // Exact/closer names still win, including a deliberately searched-for fan project.
    // For broad franchise matches, prefer releases over classified mods/fan games,
    // then use real rating volume before arbitrary name length or alphabetic order.
    const community = (game: GameSummary) => Number(game.gameType === 5 || game.gameType === 15);
    return matchRank(an, term) - matchRank(bn, term) ||
      community(a) - community(b) ||
      (b.igdbRatingCount ?? 0) - (a.igdbRatingCount ?? 0) ||
      Number(!!a.comingSoon) - Number(!!b.comingSoon) ||
      an.split(" ").length - bn.split(" ").length || an.localeCompare(bn);
  });
}

export function createUnifiedGameSearch(sources: Sources) {
  async function load(query: string, filters: CatalogFilters, cursor: GameSearchCursor = { steam: 0, igdb: 0 }, signal?: AbortSignal, onPreview?:(games:GameSummary[])=>void): Promise<UnifiedGameSearchPage> {
    signal?.throwIfAborted();
    if (!query.trim() || hasSteamSearchFilters(filters)) return sources.steam(query, filters, cursor.steam ?? 0, signal);
    const preview:GameSummary[]=[];
    const announce=(games:GameSummary[])=>{if(!signal?.aborted&&games.length&&onPreview){preview.push(...games);onPreview(mergeGameSearchResults(query,preview,filters.sort))}};
    const suggest=cursor.steam===0&&filters.platform==='all'&&filters.mode==='all'&&filters.sort==='_ASC'&&!!sources.suggest;
    const [steam, igdb, suggestions] = await Promise.allSettled([
      cursor.steam === null ? Promise.resolve(null) : sources.steam(query, filters, cursor.steam, signal).then(page=>{announce(page.games);return page}),
      cursor.igdb === null ? Promise.resolve(null) : Promise.all([
        sources.igdb(unifiedIgdbQuery(query, filters, cursor.igdb), signal),
        filters.sort==='_ASC'?sources.igdb(unifiedIgdbQuery(query, filters, cursor.igdb,true), signal):Promise.resolve([]),
      ]).then(pages=>{announce(atlasSummaries(pages.flat()));return pages}),
      suggest?sources.suggest!(query,signal).then(games=>{announce(games);return games}):Promise.resolve(null),
    ]);
    signal?.throwIfAborted();
    const unavailable: Provider[] = [];
    const next = { ...cursor };
    let anySucceeded = false;
    const candidates: GameSummary[] = [];
    const times: unknown[] = [];
    if (steam.status === "fulfilled") {
      if (steam.value) { anySucceeded = true; candidates.push(...steam.value.games); times.push(steam.value); next.steam = steam.value.nextOffset; }
    } else unavailable.push("Steam");
    if (igdb.status === "fulfilled") {
      if (igdb.value) {
        anySucceeded = true; candidates.push(...atlasSummaries(igdb.value.flat())); times.push(...igdb.value);
        next.igdb = igdb.value.some(page=>page.length===CATALOG_PAGE_SIZE) ? (cursor.igdb ?? 0) + CATALOG_PAGE_SIZE : null;
      }
    } else unavailable.push("IGDB");
    if(suggestions.status==='fulfilled'){if(suggestions.value){anySucceeded=true;candidates.push(...suggestions.value);times.push(suggestions.value)}}
    else{if(!unavailable.includes('Steam'))unavailable.push('Steam');next.steam=cursor.steam}
    if (!anySucceeded && unavailable.length) throw new Error(`Game search unavailable: ${unavailable.join(", ")}`);
    const games = mergeGameSearchResults(query, candidates, filters.sort);
    // Each source advances independently. A failed source keeps its cursor for the next retry.
    const offsets = [next.steam, next.igdb].filter((value): value is number => value !== null);
    return { games, total: games.length, nextOffset: offsets.length ? Math.max(...offsets) : null,
      searchCursor: next, unavailable, cachedAt: savedMetadataAt(times) };
  }

  async function snapshot(query: string, filters: CatalogFilters): Promise<UnifiedGameSearchPage | null> {
    if (!query.trim() || hasSteamSearchFilters(filters)) return sources.savedSteam(query, filters);
    const [steam, igdb, names, suggestions] = await Promise.allSettled([
      sources.savedSteam(query, filters), sources.savedIgdb(unifiedIgdbQuery(query, filters)),
      filters.sort==='_ASC'?sources.savedIgdb(unifiedIgdbQuery(query,filters,0,true)):Promise.resolve(null),
      filters.platform==='all'&&filters.mode==='all'&&filters.sort==='_ASC'?sources.savedSuggest?.(query)??Promise.resolve(null):Promise.resolve(null),
    ]);
    const a = steam.status === "fulfilled" ? steam.value : null;
    const b = igdb.status === "fulfilled" ? igdb.value : null;
    const c=names.status==='fulfilled'?names.value:null,d=suggestions.status==='fulfilled'?suggestions.value:null;
    if (!a && !b && !c && !d) return null;
    const games = mergeGameSearchResults(query, [...(a?.games ?? []), ...atlasSummaries([...(b??[]),...(c??[])]),...(d??[])], filters.sort);
    const next = { steam: a ? a.nextOffset : 0, igdb: b ? b.length === CATALOG_PAGE_SIZE||c?.length===CATALOG_PAGE_SIZE ? CATALOG_PAGE_SIZE : null : 0 };
    return { games, total: games.length, nextOffset: next.steam !== null || next.igdb !== null ? Math.max(next.steam ?? 0, next.igdb ?? 0) : null,
      searchCursor: next, cachedAt: savedMetadataAt([a, b,c,d]) };
  }
  return { load, snapshot };
}

const search = createUnifiedGameSearch({
  steam: (...args) => import("./catalog").then(module => module.loadGameCatalog(...args)),
  igdb: (body,signal) => import("./atlas").then(module => module.queryIgdb(body,signal,false,true)),
  savedSteam: (...args) => import("./catalog").then(module => module.readGameCatalogSnapshot(...args)),
  savedIgdb: (...args) => import("./atlas").then(module => module.readIgdbSnapshot(...args)),
  suggest: (...args)=>import('./catalog').then(module=>module.loadGameSearchSuggestions(...args)),
  savedSuggest: (...args)=>import('./catalog').then(module=>module.readGameSearchSuggestions(...args)),
});
export const loadUnifiedGameSearch = search.load;
export const readUnifiedGameSearchSnapshot = search.snapshot;
