import { gameReleaseHistory, gameAlternativeTitles } from "./release-data";
import { MAX_GAME_LINKS, validGameLinkUrl } from "./library-links";
import { ageRatingRecords } from "./age-ratings";
import { igdbImageRecord as asset } from "./igdb-artwork";
type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const id = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
const text = (value: unknown, max = 500) => typeof value === "string" ? value.slice(0, max) : undefined;
const list = (value: unknown, limit = 100) => Array.isArray(value) ? value.slice(0, limit) : [];

function connection(value: unknown, depth = 0): Row | undefined {
  const v = row(value), identity = id(v.id), name = text(v.name);
  if (!identity || !name?.trim()) return undefined;
  return { id: identity, name, ...(asset(v.logo) ? { logo: asset(v.logo) } : {}),
    ...(asset(v.platform_logo) ? { platform_logo: asset(v.platform_logo) } : {}),
    ...(text(v.description, 12000) ? { description: text(v.description, 12000) } : {}),
    ...(depth < 2 && connection(v.parent, depth + 1) ? { parent: connection(v.parent, depth + 1) } : {}) };
}
function game(value: unknown, nested = false): Row | null {
  const v = row(value), identity = id(v.id), name = text(v.name);
  if (!identity) return null;
  const companies = list(v.involved_companies, 50).flatMap(item => {
    const c = row(item), company = connection(c.company);
    return company ? [{ company, developer: c.developer === true, publisher: c.publisher === true, ...(c.supporting === true ? {supporting:true} : {}), ...(c.porting === true ? {porting:true} : {}) }] : [];
  });
  // Company-search queries deliberately request no game name. An ID-only response
  // still cannot masquerade as an empty but successful company search.
  if (!name?.trim() && !companies.length) return null;
  const result: Row = { id: identity, ...(name ? { name } : {}), ...(companies.length ? { involved_companies: companies } : {}) };
  for (const key of ["slug", "summary", "storyline"]) if (typeof v[key] === "string") result[key] = text(v[key], key === "slug" ? 500 : 50000);
  for (const key of ["first_release_date", "total_rating", "total_rating_count", "rating", "rating_count", "aggregated_rating", "aggregated_rating_count", "game_type"]) if (typeof v[key] === "number" && Number.isFinite(v[key])) result[key] = v[key];
  const typeId=row(v.game_type).id;
  if (typeof typeId==="number" && Number.isSafeInteger(typeId) && typeId>=0 && text(row(v.game_type).type,100)?.trim()) result.game_type={id:typeId,type:text(row(v.game_type).type,100)};
  if (asset(v.cover)) result.cover = asset(v.cover);
  if (Array.isArray(v.age_ratings)) result.age_ratings = ageRatingRecords(v.age_ratings);
  for (const key of ["artworks", "screenshots"]) if (Array.isArray(v[key])) result[key] = list(v[key]).flatMap(value => asset(value) ?? []);
  for (const key of ["platforms", "genres", "themes", "keywords", "collections", "franchises", "game_modes", "player_perspectives"]) {
    if (Array.isArray(v[key])) result[key] = list(v[key]).flatMap(value => connection(value) ?? []);
  }
  if (Array.isArray(v.external_games)) result.external_games = list(v.external_games).flatMap(item => {
    const external = row(item), source = id(external.external_game_source) ?? id(row(external.external_game_source).id), uid = text(external.uid, 200);
    return source && uid ? [{ external_game_source: source, uid }] : [];
  });
  if (Array.isArray(v.websites)) result.websites = list(v.websites, MAX_GAME_LINKS).flatMap(item => {
    const site=row(item), type=id(site.type)??id(row(site.type).id);
    return validGameLinkUrl(site.url) ? [{ ...(type ? {type} : {}), url:site.url }] : [];
  });
  if (Array.isArray(v.videos)) result.videos = list(v.videos, 8).flatMap(item => {
    const video = row(item), videoId = text(video.video_id, 20);
    return videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? [{ video_id: videoId, name: text(video.name, 200) ?? "" }] : [];
  });
  if (Array.isArray(v.release_dates)) result.release_dates = gameReleaseHistory(v.release_dates).map(release => ({
    id: release.id, platform: release.platform, human: release.label,
    ...(release.date !== undefined ? { date: release.date } : {}),
    ...(release.dateFormatName ? { date_format: { id:release.dateFormat, format:release.dateFormatName } } : release.dateFormat !== undefined ? { date_format: release.dateFormat } : {}),
    ...(release.region ? { release_region: { id: release.region.id, region: release.region.name } } : {}),
    ...(release.status ? { status: release.status } : {}),
  }));
  if (Array.isArray(v.alternative_names)) result.alternative_names = gameAlternativeTitles(v.alternative_names);
  if (!nested) {
    if (Array.isArray(v.similar_games)) result.similar_games = list(v.similar_games).flatMap(value => game(value, true) ?? []);
    const parent = game(v.parent_game, true); if (parent) result.parent_game = parent;
  }
  return result;
}

/** Public IGDB fields only. Rebuild media URLs from validated image identities. */
export function decodeIgdbRows(value: unknown): unknown[] | null {
  if (!Array.isArray(value) || value.length > 100) return null;
  const rows = value.map(value => game(value));
  return rows.every(value => value !== null) ? rows : null;
}
