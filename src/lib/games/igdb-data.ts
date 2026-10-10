import type { GameSummary } from "./types";
import { GAME_PLATFORMS } from "./platforms";
import { companyCatalogClause } from "./company-relations";
import { websiteGameLinks } from "./library-links";
import { IGDB_AGE_RATING_FIELDS, parseAgeRatings, type GameAgeRating } from "./age-ratings";
import { igdbArtworkCatalog, type IgdbArtwork } from "./igdb-artwork";
import { RELEASE_METADATA_FIELDS, gameReleaseHistory, gameAlternativeTitles, type GameRelease, type AlternativeTitle } from "./release-data";

type Row = Record<string, unknown>;
const row = (v: unknown): Row => v && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const text = (v: unknown) => typeof v === "string" ? v.trim() : "";
const positive = (v: unknown): number | undefined => typeof v === "number" && Number.isSafeInteger(v) && v > 0 ? v : undefined;

export type GameConnection = { id: number; name: string; image?: string };
export type AtlasRoute = { kind: "all" | "platform" | "series" | "franchise" | "theme" | "genre" | "mode" | "perspective" | "company" | "hacks" | "romhacks" | "greats" | "coop"; id?: number; name: string; image?: string; baseGame?: GameSummary; includeSubsidiaries?:boolean; description?:string; related?:GameConnection[] };
export type AtlasFilters = { query: string; sort: "discussed" | "rated" | "newest" | "oldest"; era: "all" | "before1990" | "1990" | "2000" | "2010" | "2020"; platform?: number; genre?: number; minimumRating?: number; minimumVotes?: number; };
// IGDB genre IDs; these are independent of Steam's tag IDs.
export const ATLAS_GENRES = [
  { id: 31, key: "games.tag.adventure" }, { id: 5, key: "games.studioCatalog.shooter" },
  { id: 12, key: "games.tag.rpg" }, { id: 15, key: "games.tag.strategy" },
  { id: 13, key: "games.tag.simulation" }, { id: 9, key: "games.tag.puzzle" },
  { id: 10, key: "games.studioCatalog.racing" }, { id: 14, key: "games.studioCatalog.sport" },
  { id: 8, key: "games.studioCatalog.platformer" }, { id: 4, key: "games.studioCatalog.fighting" },
] as const;
export const DEFAULT_ATLAS_FILTERS: AtlasFilters = { query: "", sort: "discussed", era: "all" };
export const ATLAS_PAGE_SIZE = 24;
export type AtlasGame = GameSummary & {
  igdbId: number; description: string; storyline: string; hero: string; screenshots: string[];
  release?: number; rating?: number; ratingCount: number; gameType?: number; gameTypeName?: string;
  userRating?: number; userRatingCount?: number; criticRating?: number; criticRatingCount?: number;
  platformLinks: GameConnection[]; genres: GameConnection[]; themes: GameConnection[];
  series: GameConnection[]; franchises: GameConnection[]; developers: GameConnection[];
  publishers: GameConnection[]; modes: GameConnection[]; perspectives: GameConnection[];
  related: GameSummary[]; parent?: GameSummary; projectUrl?: string; url: string;
  videos?: { id: string; title: string }[];
  releaseHistory?: GameRelease[]; alternativeTitles?: AlternativeTitle[];
  externalIds?: { source: number; uid: string }[];
  ageRatings?: GameAgeRating[];
  artwork?: IgdbArtwork[];
};

export function igdbImage(value: unknown, size: "cover_big_2x" | "screenshot_huge" | "logo_med" = "cover_big_2x"): string {
  const id = text(row(value).image_id);
  return /^[a-zA-Z0-9_-]{1,80}$/.test(id) ? `https://images.igdb.com/igdb/image/upload/t_${size}/${id}.${size === "logo_med" ? "png" : "jpg"}` : "";
}
export function isIgdbImage(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try { const url = new URL(value); return url.protocol === "https:" && url.hostname === "images.igdb.com" && /^\/igdb\/image\/upload\/t_[a-z0-9_]+\/[a-zA-Z0-9_-]+\.jpg$/.test(url.pathname); } catch { return false; }
}
export function igdbSteamId(value: unknown): number | undefined {
  return igdbSteamIds(value)[0];
}
export function igdbExternalIds(value: unknown): { source: number; uid: string }[] {
  return array(row(value).external_games).slice(0, 512).flatMap(external => {
    const item = row(external), source = positive(item.external_game_source) ?? positive(row(item.external_game_source).id);
    const uid = text(item.uid);
    return source && uid && uid.length <= 256 && !/[\x00-\x1f]/.test(uid) ? [{ source, uid }] : [];
  });
}
export function igdbSteamIds(value: unknown): number[] {
  const ids: number[] = [];
  for (const external of array(row(value).external_games)) {
    const e = row(external), source = row(e.external_game_source);
    // Check the source and UID on the SAME external record; a cross-array match is insufficient.
    if ((e.external_game_source === 1 || source.id === 1) && /^\d+$/.test(text(e.uid))) {
      const id = positive(Number(e.uid)); if (id) ids.push(id);
    }
  }
  return [...new Set(ids)];
}
function connections(value: unknown): GameConnection[] {
  return [...new Map(array(value).flatMap(item => {
    const v = row(item), id = positive(v.id), name = text(v.name);
    return id && name ? [[id, { id, name, image: igdbImage(v.platform_logo ?? v.logo, "logo_med") || undefined }] as const] : [];
  })).values()];
}
export function parseAtlasSummary(value: unknown): GameSummary | null {
  const v = row(value), igdbId = positive(v.id), name = text(v.name);
  if (!igdbId || !name) return null;
  const steamId = igdbSteamId(v), portrait = igdbImage(v.cover);
  const capsule = igdbImage(array(v.artworks)[0], "screenshot_huge") || igdbImage(array(v.screenshots)[0], "screenshot_huge") || portrait;
  return { id: steamId ? `steam:${steamId}` : `igdb:${igdbId}`, igdbId, ...(steamId ? { steamId } : {}), name, capsule, portrait: portrait || undefined, platforms: connections(v.platforms).map(p => p.name),
    ...(typeof v.game_type === "number" && Number.isSafeInteger(v.game_type) && v.game_type >= 0 ? { gameType: v.game_type } : {}),
    ...(positive(v.total_rating_count) ? { igdbRatingCount: positive(v.total_rating_count) } : {}),
    ...(positive(v.first_release_date) ? { releaseTimestamp: positive(v.first_release_date) } : {}),
    ...(typeof v.cachedAt === "number" && Number.isFinite(v.cachedAt) && v.cachedAt > 0 ? { cachedAt: v.cachedAt } : {}) };
}
export function parseAtlasGame(value: unknown): AtlasGame {
  const v = row(value), summary = parseAtlasSummary(v);
  if (!summary?.igdbId) throw new Error("Invalid game record");
  const companies = array(v.involved_companies).map(row);
  const ratingCount = Number(v.total_rating_count);
  const rating = typeof v.total_rating === "number" && v.total_rating >= 0 && v.total_rating <= 100 && ratingCount > 0 ? v.total_rating : undefined;
  const release = typeof v.first_release_date === "number" && Number.isFinite(v.first_release_date) ? v.first_release_date : undefined;
  const screenshots = array(v.screenshots).map(image => igdbImage(image, "screenshot_huge")).filter(Boolean);
  const score = (value: unknown, count: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 && positive(count) ? value : undefined;
  return { ...summary, igdbId: summary.igdbId, description: text(v.summary), storyline: text(v.storyline), hero: igdbImage(array(v.artworks)[0], "screenshot_huge") || screenshots[0] || summary.capsule,
    screenshots, release, rating, ratingCount: Number.isSafeInteger(ratingCount) && ratingCount > 0 ? ratingCount : 0, gameType: typeof v.game_type === "number" ? v.game_type : typeof row(v.game_type).id === "number" ? row(v.game_type).id as number : undefined, gameTypeName: text(row(v.game_type).type) || undefined,
    releaseHistory: gameReleaseHistory(v.release_dates), alternativeTitles: gameAlternativeTitles(v.alternative_names),
    externalIds: igdbExternalIds(v),
    ageRatings: parseAgeRatings(v.age_ratings),
    artwork: igdbArtworkCatalog(v),
    links: [{name:"IGDB",url:`https://www.igdb.com/games/${encodeURIComponent(text(v.slug) || String(summary.igdbId))}`},...websiteGameLinks(v.websites)],
    userRating: score(v.rating, v.rating_count), userRatingCount: positive(v.rating_count), criticRating: score(v.aggregated_rating, v.aggregated_rating_count), criticRatingCount: positive(v.aggregated_rating_count),
    platformLinks: connections(v.platforms), genres: connections(v.genres), themes: connections(v.themes), series: connections(v.collections), franchises: connections(v.franchises),
    developers: connections(companies.filter(c => c.developer === true).map(c => c.company)), publishers: connections(companies.filter(c => c.publisher === true).map(c => c.company)), modes: connections(v.game_modes), perspectives: connections(v.player_perspectives),
    related: [...new Map(array(v.similar_games).map(parseAtlasSummary).filter((g): g is GameSummary => !!g && g.igdbId !== summary.igdbId).map(g => [g.id, { ...g, cachedAt: summary.cachedAt }])).values()],
    parent: parseAtlasSummary(v.parent_game) ? { ...parseAtlasSummary(v.parent_game)!, cachedAt: summary.cachedAt } : undefined,
    projectUrl: array(v.websites).map(row).filter(site => site.type === 1 || row(site.type).id === 1).map(site => safeProjectUrl(site.url)).find(Boolean),
    videos: [...new Map(array(v.videos).map(row).filter(video => /^[a-zA-Z0-9_-]{11}$/.test(text(video.video_id))).map(video => [text(video.video_id), { id: text(video.video_id), title: text(video.name).slice(0, 200) || summary.name }])).values()].slice(0, 8),
    url: `https://www.igdb.com/games/${encodeURIComponent(text(v.slug) || String(summary.igdbId))}` };
}

export function safeProjectUrl(value: unknown): string | undefined {
  try { const url = new URL(text(value)); return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined; } catch { return undefined; }
}
export const ROM_HACK_PLATFORMS = [4,5,7,18,19,20,21,22,23,24,29,32,33,35,38,64] as const;
export const ATLAS_SUMMARY_FIELDS = "name,slug,summary,cover.image_id,screenshots.image_id,artworks.image_id,first_release_date,platforms.name,platforms.abbreviation,platforms.platform_logo.image_id,total_rating,total_rating_count,game_type,external_games.external_game_source,external_games.uid,parent_game.name,parent_game.cover.image_id,parent_game.platforms.name";
export const ATLAS_DETAIL_FIELDS = `${ATLAS_SUMMARY_FIELDS},cover.width,cover.height,artworks.width,artworks.height,screenshots.width,screenshots.height,rating,rating_count,aggregated_rating,aggregated_rating_count,storyline,genres.name,themes.name,game_modes.name,player_perspectives.name,collections.name,franchises.name,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,similar_games.name,similar_games.cover.image_id,similar_games.platforms.name,similar_games.external_games.external_game_source,similar_games.external_games.uid,parent_game.external_games.external_game_source,parent_game.external_games.uid,websites.url,websites.type,videos.name,videos.video_id,${RELEASE_METADATA_FIELDS},${IGDB_AGE_RATING_FIELDS}`;
const fields = { platform: "platforms", series: "collections", franchise: "franchises", theme: "themes", genre: "genres", mode: "game_modes", perspective: "player_perspectives", company: "involved_companies.company" } as const;
export function atlasQuery(route: AtlasRoute, filters: AtlasFilters, offset = 0): string {
  const clauses = ["version_parent = null", "cover != null"];
  if (route.kind === "romhacks") clauses.push("game_type = 5", "parent_game != null", `parent_game.platforms = (${ROM_HACK_PLATFORMS.join(",")})`, `platforms = (${ROM_HACK_PLATFORMS.join(",")})`);
  else if (route.kind === "hacks") clauses.push("game_type = 5");
  else if (route.kind === "greats" || route.kind === "coop") {
    clauses.push("game_type = (0,8,9)", "total_rating_count >= 100", `first_release_date < ${Math.floor(Date.now() / 86_400_000) * 86_400}`);
    if (route.kind === "coop") clauses.push("game_modes = (3)");
  }
  else if (route.kind !== "all") { if (!positive(route.id)) throw new Error("Invalid relationship ID"); clauses.push(route.kind === "company" ? companyCatalogClause(route.id!,route.includeSubsidiaries!==false) : `${fields[route.kind]} = (${route.id})`); }
  if (route.baseGame) {
    if (!positive(route.baseGame.igdbId) || !["hacks", "romhacks"].includes(route.kind)) throw new Error("Invalid base game");
    clauses.push(`parent_game = ${route.baseGame.igdbId}`);
  }
  if (filters.platform !== undefined) {
    const allowed = ["greats", "coop", "company"].includes(route.kind) ? GAME_PLATFORMS.map(platform => platform.id) : ROM_HACK_PLATFORMS;
    if (!(allowed as readonly number[]).includes(filters.platform)) throw new Error("Invalid collection platform");
    clauses.push(`platforms = (${filters.platform})`);
  }
  if (filters.era !== "all") {
    const start = filters.era === "before1990" ? 1950 : Number(filters.era), end = filters.era === "before1990" ? 1990 : start + 10;
    if (![1950, 1990, 2000, 2010, 2020].includes(start)) throw new Error("Invalid era");
    clauses.push(`first_release_date >= ${Date.UTC(start, 0, 1) / 1000}`, `first_release_date < ${Date.UTC(end, 0, 1) / 1000}`);
  }
  const query = filters.query.trim().slice(0, 160).replace(/["\\\r\n\x00-\x1f]/g, " ");
  const sort = { discussed: "total_rating_count desc", rated: "total_rating desc", newest: "first_release_date desc", oldest: "first_release_date asc" }[filters.sort];
  if (!sort) throw new Error("Invalid sort");
  if (route.kind === "company") {
    if (filters.genre !== undefined) {
      if (!ATLAS_GENRES.some(genre => genre.id === filters.genre)) throw new Error("Invalid collection genre");
      clauses.push(`genres = (${filters.genre})`);
    }
    if (filters.minimumRating !== undefined) {
      if (![50, 70, 80, 90].includes(filters.minimumRating)) throw new Error("Invalid minimum rating");
      clauses.push(`total_rating >= ${filters.minimumRating}`);
    }
    if (filters.minimumVotes !== undefined && ![5, 25, 100, 500].includes(filters.minimumVotes)) throw new Error("Invalid minimum votes");
    const votes = Math.max(filters.minimumVotes ?? 0, filters.sort === "rated" || filters.minimumRating !== undefined ? 5 : 0);
    if (votes) clauses.push(`total_rating_count >= ${votes}`);
    // A title filter keeps the selected sort meaningful while searching a studio.
    if (query) clauses.push(`name ~ *"${query}"*`);
  } else if (filters.sort === "rated" && !query) clauses.push("total_rating_count >= 5");
  const mediaFields = ["hacks", "romhacks"].includes(route.kind) ? ",websites.url,websites.type,videos.name,videos.video_id" : "";
  return `${query && route.kind !== "company" ? `search "${query}";` : `sort ${sort};`} fields ${ATLAS_SUMMARY_FIELDS}${mediaFields}; where ${clauses.join(" & ")}; limit ${ATLAS_PAGE_SIZE}; offset ${Math.max(0, Math.floor(Number.isFinite(offset) ? offset : 0))};`;
}
