import { safeFetch } from "@/lib/safe-fetch";
import { isRecentGameRelease, parseSteamMicrotrailer, parseSteamArtwork, parseSteamDetail, parseSteamDiscovery, parseSteamSearchIds, parseSteamStoreItems, parseSteamPublishers, steamSummary } from "./steam-data";
import type { GameArtwork, GameCatalogPage, GameDetail, GameDiscovery, GameSummary } from "./types";
import { GameRequestPool } from "./request-pool";
import { CATALOG_PAGE_SIZE, catalogParameters, type CatalogFilters } from "./catalog-filters";
import { GameMetadataCache } from "./metadata-cache";
import { metadataStore } from "./metadata-store";
import { parseSteamImportMetadata, validSteamImportId } from "./steam-import";
import { parseSteamStoreCountry, parseSteamStoreSearch, steamStoreParameters, type SteamStorePage } from "./steam-store-search";
import { savedMetadataAt } from "./metadata-records";
import { parseSteamReviewSummary, type SteamReviewSummary } from "./rating-data";
import { parseRecommendationTagNames, parseRecommendationTagProfile, recommendationTagLanguage } from "./recommendation-tags";

const STORE = "https://store.steampowered.com/api/";
const cache = new Map<string, { at: number; value: unknown }>();
const pending = new Map<string, Promise<unknown>>();
const TTL = 15 * 60_000;
const pool = new GameRequestPool(4);
const metadata = new GameMetadataCache(metadataStore);
let automaticStoreCountry: { value: string; at: number } | undefined;

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  // Short video manifests stay in memory; disk snapshots contain public metadata only.
  if (!key.startsWith("microtrailer:")) return metadata.load(key, load);
  const held = cache.get(key);
  if (held && Date.now() - held.at < TTL) return held.value as T;
  const existing = pending.get(key); if (existing) return existing as Promise<T>;
  const task = load().then(value => {
    cache.delete(key); cache.set(key, { at: Date.now(), value });
    if (cache.size > 80) cache.delete(cache.keys().next().value!);
    return value;
  }).finally(() => pending.delete(key));
  pending.set(key, task); return task;
}

async function request(path: string, api = STORE, signal?: AbortSignal, priority = false, format: "json" | "text" = "json"): Promise<unknown> {
  return pool.run(async () => {
    const controller = new AbortController();
    const abort = () => controller.abort(signal?.reason);
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      signal?.throwIfAborted();
      const response = await safeFetch(`${api}${path}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Steam ${response.status}`);
      return format === "text" ? await response.text() : await response.json();
    } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
  }, signal, priority);
}

export async function loadGameCatalog(query: string, filters: CatalogFilters, offset = 0, signal?: AbortSignal): Promise<GameCatalogPage> {
  const params = catalogParameters(query, filters, offset);
  const key = `catalog:${params}`;
  return metadata.load(key, async () => {
  const result = await request(`search/results/?${params}`, "https://store.steampowered.com/", signal, !!query.trim()) as { total_count?: unknown; results_html?: unknown };
  const ids = parseSteamSearchIds(result);
  const total = Number(result.total_count);
  if (!Number.isSafeInteger(total) || total < 0) throw new Error("Invalid catalog count");
  if (total > offset && !ids.length) throw new Error("Catalog results unavailable");
  const input = encodeURIComponent(JSON.stringify({ ids: ids.map(appid => ({ appid })), context: { language: "english", country_code: "US" }, data_request: { include_assets: true, include_basic_info: true, include_release: true, include_platforms: true } }));
  const games = ids.length ? parseSteamStoreItems(await request(`IStoreBrowseService/GetItems/v1/?input_json=${input}`, "https://api.steampowered.com/", signal, !!query.trim()), ids) : [];
  return { games, total, nextOffset: ids.length > 0 && offset + CATALOG_PAGE_SIZE < total ? offset + CATALOG_PAGE_SIZE : null };
  }, signal);
}

export function loadRecommendationTagProfile(appid: number, signal?: AbortSignal) {
  if (!Number.isSafeInteger(appid) || appid <= 0) return Promise.reject(new Error("Invalid Steam ID"));
  return metadata.load(`recommendation-tags:${appid}`, async () => {
    const input = encodeURIComponent(JSON.stringify({ids:[{appid}],context:{language:"english",country_code:"US"},data_request:{include_tag_count:20}}));
    return parseRecommendationTagProfile(await request(`IStoreBrowseService/GetItems/v1/?input_json=${input}`,"https://api.steampowered.com/",signal),appid);
  },signal);
}

export function loadRecommendationTagNames(language: string) {
  const locale = recommendationTagLanguage(language);
  // One bounded, shared public dictionary request; seed cancellation cannot abort another consumer.
  return metadata.load(`recommendation-tag-names:${locale}`, async () =>
    parseRecommendationTagNames(await request(`IStoreService/GetTagList/v1/?language=${locale}`,"https://api.steampowered.com/")));
}

export function readGameDiscoverySnapshot() { return metadata.peek<GameDiscovery>("discovery:home:us:en"); }
export function readGameDetailSnapshot(steamId: number) { return metadata.peek<GameDetail>(`game:${steamId}`); }
export function readGameCatalogSnapshot(query: string, filters: CatalogFilters) { return metadata.peek<GameCatalogPage>(`catalog:${catalogParameters(query, filters, 0)}`); }

export function loadGameDiscovery(): Promise<GameDiscovery> {
  return cached("discovery:us:en", () => request("featuredcategories/?l=english&cc=us").then(parseSteamDiscovery));
}

export function enrichGameDiscovery(base: GameDiscovery): Promise<GameDiscovery> {
  return cached(`discovery:selections:${base.fetchedAt}`, async () => {
    const selections = await Promise.allSettled([
      loadStoreSelection("popularnew"),
      loadStoreSelection("popularcomingsoon"),
      loadStoreSelection("topsellers"),
    ]);
    const replacements = new Map(["new_releases", "coming_soon", "top_sellers"].flatMap((id, index) => {
      const result = selections[index];
      return result.status === "fulfilled" && result.value.length ? [[id, result.value] as const] : [];
    }));
    const shelves = base.shelves.map(shelf => ({ ...shelf, games: replacements.get(shelf.id) ?? shelf.games }));
    const cachedAt = savedMetadataAt({ ...base, shelves });
    const enriched = { ...base, enriched: true, shelves, ...(cachedAt !== undefined ? { cachedAt } : {}) };
    if (cachedAt === undefined) void metadataStore.write("discovery:home:us:en", { at: base.fetchedAt, data: enriched }).catch(() => {});
    return enriched;
  });
}

export function loadStoreSelectionPage(filter: "popularnew" | "popularcomingsoon" | "topsellers", offset = 0, signal?: AbortSignal, search?: {query:string;platform:CatalogFilters["platform"]}): Promise<GameCatalogPage> {
  const start = Math.max(0, Math.floor(Number.isFinite(offset) ? offset : 0));
  const params = new URLSearchParams({ filter, sort_by: filter === "popularnew" ? "Released_DESC" : "", category1: "998", count: String(CATALOG_PAGE_SIZE), start: String(start), cc: "us", l: "english", infinite: "1" });
  if(search?.query.trim()) params.set("term",search.query.trim().slice(0,180));
  if(search?.platform&&search.platform!=="all") params.set("os",search.platform);
  return metadata.load(`catalog:selection:${params}`, async () => {
    const result = await request(`search/results/?${params}`, "https://store.steampowered.com/", signal) as { total_count?: unknown };
    const ids = parseSteamSearchIds(result), total = Number(result.total_count);
    if (!Number.isSafeInteger(total) || total < 0 || total > start && !ids.length) throw new Error("Store selection unavailable");
    const input = encodeURIComponent(JSON.stringify({ ids: ids.map(appid => ({ appid })), context: { language: "english", country_code: "US" }, data_request: { include_assets: true, include_basic_info: true, include_release: true, include_platforms: true } }));
    const games = ids.length ? parseSteamStoreItems(await request(`IStoreBrowseService/GetItems/v1/?input_json=${input}`, "https://api.steampowered.com/", signal), ids) : [];
    return { games: filter === "popularnew" ? games.filter(game => isRecentGameRelease(game)) : games, total, nextOffset: ids.length && start + CATALOG_PAGE_SIZE < total ? start + CATALOG_PAGE_SIZE : null };
  }, signal);
}
function loadStoreSelection(filter: "popularnew" | "popularcomingsoon" | "topsellers"): Promise<GameSummary[]> { return loadStoreSelectionPage(filter).then(page => page.games); }

export function loadGameArtwork(ids: number[]): Promise<Record<number, GameArtwork>> {
  const appids = [...new Set(ids)].filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 60).sort((a, b) => a - b);
  if (!appids.length) return Promise.resolve({});
  return cached(`art:${appids.join(",")}`, async () => {
    const input = encodeURIComponent(JSON.stringify({ ids: appids.map(appid => ({ appid })), context: { language: "english", country_code: "US" }, data_request: { include_assets: true } }));
    const result = await request(`IStoreBrowseService/GetItems/v1/?input_json=${input}`, "https://api.steampowered.com/");
    return Object.fromEntries(appids.map(id => [id, parseSteamArtwork(result, id)]));
  });
}

export type GameHighlight = GameSummary & GameArtwork & { reviews?: SteamReviewSummary; publishers?: string[] };
export type GameChart = { games: (GameHighlight & { chartRank:number; peakPlayers?:number })[]; date?:number; fetchedAt?:number; cachedAt?:number };
export function loadMostPlayedGames(limit = 100):Promise<GameChart> {
  const count=Math.max(1,Math.min(100,Math.floor(limit)));
  return cached(`chart:most-played:v2:${count}`,async()=>{
    const raw=await request("ISteamChartsService/GetMostPlayedGames/v1/","https://api.steampowered.com/") as {response?:{rollup_date?:number;ranks?:{rank:number;appid:number;peak_in_game?:number}[]}};
    const ranks=(raw.response?.ranks??[]).filter(item=>Number.isSafeInteger(item.appid)&&item.appid>0&&Number.isSafeInteger(item.rank)&&item.rank>0).sort((a,b)=>a.rank-b.rank).slice(0,count);
    if(!ranks.length)throw Error("Chart unavailable");
    const ids=ranks.map(item=>item.appid),items=(await Promise.all(Array.from({length:Math.ceil(ids.length/24)},(_,i)=>loadGameHighlights(ids.slice(i*24,(i+1)*24))))).flat();
    const date=raw.response?.rollup_date;
    return {fetchedAt:Date.now(),date:Number.isSafeInteger(date)&&date!>0?date:undefined,games:items.map(game=>{const rank=ranks.find(item=>item.appid===game.steamId)!;return {...game,chartRank:rank.rank,...(Number.isSafeInteger(rank.peak_in_game)&&rank.peak_in_game!>=0?{peakPlayers:rank.peak_in_game}:{})};})};
  });
}
/** Editorial shortlist; scores are current Steam review data, never a fabricated rank. */
export function loadGameHighlights(ids: readonly number[]): Promise<GameHighlight[]> {
  const appids=[...new Set(ids)].filter(id=>Number.isSafeInteger(id)&&id>0).slice(0,24);
  if(!appids.length)return Promise.resolve([]);
  return cached(`highlights:v4:${appids.join(",")}`,async()=>{
    const input=encodeURIComponent(JSON.stringify({ids:appids.map(appid=>({appid})),context:{language:"english",country_code:"US"},data_request:{include_assets:true,include_basic_info:true,include_reviews:true,include_platforms:true}}));
    const raw=await request(`IStoreBrowseService/GetItems/v1/?input_json=${input}`,"https://api.steampowered.com/");
    const items=(raw as {response?:{store_items?:{appid:number;basic_info?:unknown;reviews?:{summary_filtered?:unknown}}[]}}).response?.store_items??[];
    return parseSteamStoreItems(raw,appids).map(game=>{const item=items.find(item=>item.appid===game.steamId),reviews=parseSteamReviewSummary(item?.reviews?.summary_filtered);
      return {...game,...parseSteamArtwork(raw,game.steamId!),publishers:parseSteamPublishers(item?.basic_info),...(reviews?{reviews}:{})};
    });
  });
}
export function loadGameRelease(steamId: number, signal?: AbortSignal, force = false): Promise<{steamId:number;release:string;comingSoon:boolean;cachedAt?:number}> {
  if (!Number.isSafeInteger(steamId) || steamId <= 0 || steamId > 0xffffffff) return Promise.reject(new Error("Invalid Steam ID"));
  return metadata.load(`steam-release:${steamId}`, async()=>{
    const value=await request(`appdetails?appids=${steamId}&filters=release_date&l=english&cc=us`,STORE,signal) as Record<string,{success?:unknown;data?:{release_date?:{date?:unknown;coming_soon?:unknown}}}>;
    const item=value?.[steamId],release=item?.data?.release_date;
    if(item?.success!==true||typeof release?.date!=="string"||typeof release.coming_soon!=="boolean")throw Error("Release metadata unavailable");
    return {steamId,release:release.date.slice(0,100),comingSoon:release.coming_soon};
  },signal,force);
}

export function loadGameDetail(steamId: number): Promise<GameDetail> {
  if (!Number.isSafeInteger(steamId) || steamId <= 0) return Promise.reject(new Error("Invalid Steam ID"));
  return cached(`game:${steamId}`, async () => {
    const input = encodeURIComponent(JSON.stringify({ ids: [{ appid: steamId }], context: { language: "english", country_code: "US" }, data_request: { include_assets: true } }));
    const [detail, artwork] = await Promise.all([
      request(`appdetails?appids=${steamId}&l=english&cc=us`).then(value => parseSteamDetail(value, steamId)),
      request(`IStoreBrowseService/GetItems/v1/?input_json=${input}`, "https://api.steampowered.com/").then(value => parseSteamArtwork(value, steamId)).catch(() => ({})),
    ]);
    return { ...detail, ...artwork };
  });
}
export function readGameHighlightsSnapshot(ids: readonly number[]) {
  const appids=[...new Set(ids)].filter(id=>Number.isSafeInteger(id)&&id>0).slice(0,24);
  return appids.length?metadata.peek<GameHighlight[]>(`highlights:v4:${appids.join(",")}`):Promise.resolve([]);
}
export function loadSteamImportSummary(steamId: number, signal: AbortSignal): Promise<GameSummary> {
  if (!validSteamImportId(steamId)) return Promise.reject(Error("steam_import_record"));
  return metadata.load(`steam-import:${steamId}`, async () => parseSteamImportMetadata(await request(`appdetails?appids=${steamId}&l=english&cc=us`, STORE, signal), steamId), signal);
}
export function loadGameMicrotrailer(steamId: number): Promise<string> {
  if (!Number.isSafeInteger(steamId) || steamId <= 0) return Promise.resolve("");
  return cached(`microtrailer:${steamId}`, async () => {
    const input=encodeURIComponent(JSON.stringify({ids:[{appid:steamId}],context:{language:"english",country_code:"US"},data_request:{include_trailers:true}}));
    return parseSteamMicrotrailer(await request(`IStoreBrowseService/GetItems/v1/?input_json=${input}`,"https://api.steampowered.com/"),steamId);
  });
}
export function searchGames(query: string): Promise<GameSummary[]> {
  const term = query.trim().slice(0, 180); if (term.length < 2) return Promise.resolve([]);
  return cached(`search:${term.toLowerCase()}`, async () => {
    const data = await request(`storesearch/?term=${encodeURIComponent(term)}&l=english&cc=us`) as { items?: unknown[] };
    if (!Array.isArray(data.items)) throw new Error("Invalid search response");
    return data.items.map(steamSummary).filter((game): game is GameSummary => !!game);
  });
}

export function loadSteamStoreSearch(query:string,country:string,offset=0,signal?:AbortSignal,force=false):Promise<SteamStorePage> {
  const params=steamStoreParameters(query,country,offset);
  if(!query.trim())return Promise.resolve({games:[],country,total:0,nextOffset:null});
  return metadata.load(`steam-store-search:v1:${params}`,async()=>{
    let resolvedCountry = country;
    if (country === "auto") {
      if (!automaticStoreCountry || Date.now() - automaticStoreCountry.at >= TTL) {
        const html = await request("search/?l=english", "https://store.steampowered.com/", signal, true, "text");
        const value = parseSteamStoreCountry(html);
        signal?.throwIfAborted();
        automaticStoreCountry = { value, at: Date.now() };
      }
      resolvedCountry = automaticStoreCountry.value;
    }
    const resolvedParams = steamStoreParameters(query, resolvedCountry, offset);
    const raw=await request(`search/results/?${resolvedParams}`,"https://store.steampowered.com/",signal,true) as {total_count?:unknown};
    const ids=parseSteamSearchIds(raw),total=Number(raw.total_count);
    if(!Number.isSafeInteger(total)||total<0||total>offset&&!ids.length)throw Error("Steam search unavailable");
    const input=encodeURIComponent(JSON.stringify({ids:ids.map(appid=>({appid})),context:{language:"english",country_code:resolvedCountry},data_request:{include_assets:true,include_basic_info:true,include_release:true,include_platforms:true}}));
    const details=ids.length?await request(`IStoreBrowseService/GetItems/v1/?input_json=${input}`,"https://api.steampowered.com/",signal,true):{};
    return parseSteamStoreSearch(details,ids,country,total,offset);
  },signal,force);
}

/** Steam autocomplete accepts unfinished titles. Resolve its IDs through the game-only
 * catalog parser so DLC, soundtracks and low-resolution suggestion art do not leak in. */
export function loadGameSearchSuggestions(query:string,signal?:AbortSignal):Promise<GameSummary[]>{
  const term=query.trim().slice(0,180);if(term.length<2)return Promise.resolve([]);
  return metadata.load(`search:games-prefix:v2:${term.toLowerCase()}`,async()=>{
    const data=await request(`storesearch/?term=${encodeURIComponent(term)}&l=english&cc=us`,STORE,signal,true) as {items?:unknown[]};
    if(!Array.isArray(data.items))throw Error('Invalid search suggestions');
    const ids=data.items.map(steamSummary).filter((game):game is GameSummary=>!!game).map(game=>game.steamId!).slice(0,20);
    if(!ids.length)return[];
    const input=encodeURIComponent(JSON.stringify({ids:ids.map(appid=>({appid})),context:{language:'english',country_code:'US'},data_request:{include_assets:true,include_basic_info:true,include_release:true,include_platforms:true}}));
    return parseSteamStoreItems(await request(`IStoreBrowseService/GetItems/v1/?input_json=${input}`,'https://api.steampowered.com/',signal,true),ids);
  },signal);
}
export function readGameSearchSuggestions(query:string){return metadata.peek<GameSummary[]>(`search:games-prefix:v2:${query.trim().slice(0,180).toLowerCase()}`)}
