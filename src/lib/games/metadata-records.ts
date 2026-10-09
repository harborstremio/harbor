import { gameDescriptionHtml, gameImage, steamSummary, steamScreenshotThumbnails } from "./steam-data";
import type { GameDetail, GameSummary } from "./types";
import { decodeIgdbRows } from "./igdb-records";
import { parseMetacritic, steamReviewVerdict } from "./rating-data";
import { gameLogoSource } from "./logo-art";
import { decodeRecommendationTagNames, decodeRecommendationTagProfile } from "./recommendation-tags";
import { decodeSteamStoreSearch } from "./steam-store-search";
import { gameLinks } from "./library-links";

const row = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown, max = 12000) => typeof v === "string" ? v.slice(0, max) : "";
const items = (v: unknown, max = 100): unknown[] => Array.isArray(v) ? v.slice(0, max) : [];
const names = (v: unknown) => items(v, 100).filter((s): s is string => typeof s === "string").map(s => s.slice(0, 400));
const number = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
const image = (v: unknown) => v === "/games/publisher/hades-ii-logo.png" ? v : gameImage(v);

function summary(value: unknown): GameSummary | null {
  const v = row(value), platforms = names(v.platforms), p = row(v.price);
  const game = steamSummary({ id: v.steamId, name: text(v.name, 500), header_image: image(v.capsule),
    windows_available: platforms.includes("Windows"), mac_available: platforms.includes("macOS"), linux_available: platforms.includes("Linux"),
    final_price: p.amount, currency: p.currency, discount_percent: p.discount });
  if (!game || v.id !== game.id) return null;
  return { ...game, ...(typeof v.adultContent === "boolean" ? { adultContent: v.adultContent } : {}), ...(image(v.portrait) ? { portrait: image(v.portrait) } : {}),
    ...(number(v.releaseTimestamp) !== undefined ? { releaseTimestamp: number(v.releaseTimestamp) } : {}), comingSoon: v.comingSoon === true };
}
function games(value: unknown) {
  if (!Array.isArray(value) || value.length > 100) return null;
  const parsed = value.map(summary);
  return parsed.every(game => game !== null) ? parsed : null;
}
function detail(value: unknown): GameDetail | null {
  const v = row(value), game = summary(v), requirements = row(v.requirements);
  if (!game?.steamId || typeof v.description !== "string" || !Array.isArray(v.screenshots)) return null;
  const screenshots = [...new Set(items(v.screenshots).map(image).filter(Boolean))];
  return { ...game, steamId: game.steamId, description: text(v.description), about: text(v.about, 100000), hero: image(v.hero) || game.capsule,
    libraryHero: image(v.libraryHero) || undefined, logo: gameLogoSource(game.steamId!, image(v.logo)), screenshots, screenshotThumbnails: steamScreenshotThumbnails(v.screenshotThumbnails, screenshots),
    trailers: items(v.trailers, 20).flatMap(raw => { const t = row(raw), url = image(t.url); return url ? [{ url, name: text(t.name, 400), poster: image(t.poster) }] : []; }),
    genres: names(v.genres), features: names(v.features), developers: names(v.developers), publishers: names(v.publishers), release: text(v.release, 100), comingSoon: v.comingSoon === true,
    featureCategories: items(v.featureCategories, 100).flatMap(value => { const category = row(value), name = text(category.name, 160); return Number.isSafeInteger(category.id) && Number(category.id) > 0 && Number(category.id) <= 4_294_967_295 && name ? [{ id: Number(category.id), name }] : []; }),
    aboutHtml: gameDescriptionHtml(v.aboutHtml), links: gameLinks(v.links),
    controller: text(v.controller, 40) || undefined, requirements: { minimum: text(requirements.minimum), recommended: text(requirements.recommended) }, languages: text(v.languages),
    achievements: number(v.achievements), recommendations: number(v.recommendations), metacritic: parseMetacritic(v.metacritic),
    achievementHighlights: items(v.achievementHighlights, 10).flatMap(raw => { const a = row(raw), icon = image(a.icon), name = text(a.name, 160); return icon && name ? [{ icon, name }] : []; }) };
}

/** Disk data gets the same identity/image restrictions as a new provider response. */
export function decodeGameMetadata(key: string, value: unknown): unknown | null {
  if(key.startsWith("steam-store-search:v1:"))return decodeSteamStoreSearch(key,value);
  if(key.startsWith("steam-release:")){
    const v=row(value),identity=Number(key.slice("steam-release:".length));
    return Number.isSafeInteger(identity)&&identity>0&&identity<=0xffffffff&&v.steamId===identity&&typeof v.release==="string"&&typeof v.comingSoon==="boolean"?{steamId:identity,release:text(v.release,100),comingSoon:v.comingSoon}:null;
  }
  if (key.startsWith("recommendation-tags:")) {
    const profile = decodeRecommendationTagProfile(value);
    return profile?.appid === Number(key.slice("recommendation-tags:".length)) ? profile : null;
  }
  if (key.startsWith("recommendation-tag-names:")) return decodeRecommendationTagNames(value);
  if (key.startsWith("igdb:games:v1:")) return decodeIgdbRows(value);
  const v = row(value);
  if (key.startsWith("game:")) { const game = detail(value); return game?.steamId === Number(key.slice(5)) ? game : null; }
  if (key.startsWith("discovery:")) {
    if (v.source !== "Steam" || !number(v.fetchedAt) || !Array.isArray(v.shelves) || v.shelves.length > 4) return null;
    const shelves = v.shelves.map(raw => { const shelf = row(raw), list = games(shelf.games); return ["top_sellers", "new_releases", "coming_soon", "specials"].includes(String(shelf.id)) && list ? { id: shelf.id, games: list } : null; });
    return shelves.every(Boolean) && shelves.some(shelf => shelf?.games.length) ? { shelves, source: "Steam", fetchedAt: v.fetchedAt, enriched: v.enriched === true } : null;
  }
  if (key.startsWith("catalog:")) {
    const list = games(v.games);
    return list && Number.isSafeInteger(v.total) && Number(v.total) >= 0 && (v.nextOffset === null || Number.isSafeInteger(v.nextOffset) && Number(v.nextOffset) >= 0)
      ? { games: list, total: v.total, nextOffset: v.nextOffset } : null;
  }
  if (key === "chart:most-played" || /^chart:most-played:\d{1,3}$/.test(key)) {
    const list = games(v.games);
    if (!list) return null;
    const original = items(v.games), ranked = list.map((game, i) => ({ ...game, chartRank: number(row(original[i]).chartRank), peakPlayers: number(row(original[i]).peakPlayers) }));
    return ranked.every(game => Number.isSafeInteger(game.chartRank) && game.chartRank! > 0) ? { games: ranked, date: number(v.date), fetchedAt: number(v.fetchedAt) } : null;
  }
  if (key.startsWith("selection:") || key.startsWith("search:")) return games(value);
  if (key.startsWith("highlights:")) {
    const list = games(value);
    return list?.map((game, i) => { const original = row(items(value)[i]), reviews = row(original.reviews), positive = number(reviews.positive), count = number(reviews.count);
      return { ...game, libraryHero: image(original.libraryHero) || undefined, wideCapsule: image(original.wideCapsule) || undefined,
        ...(positive !== undefined && positive <= 100 && count !== undefined && count > 0 ? { reviews: { positive, count, verdict: steamReviewVerdict(reviews.verdict) } } : {}) }; }) ?? null;
  }
  if (key.startsWith("art:")) return Object.fromEntries(Object.entries(v).slice(0, 60).filter(([id]) => /^\d+$/.test(id)).map(([id, raw]) => {
    const a = row(raw); return [id, { libraryHero: image(a.libraryHero) || undefined, portrait: image(a.portrait) || undefined, wideCapsule: image(a.wideCapsule) || undefined }];
  }));
  return null;
}

export function savedMetadataAt(value: unknown): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  if (Array.isArray(value)) { const times = [number((value as { cachedAt?: unknown }).cachedAt), ...value.map(savedMetadataAt)].filter((n): n is number => n !== undefined); return times.length ? Math.min(...times) : undefined; }
  const v = row(value);
  const times = [number(v.cachedAt), savedMetadataAt(v.games ?? v.shelves)].filter((n): n is number => n !== undefined);
  return times.length ? Math.min(...times) : undefined;
}

export function markSavedMetadata<T>(value: T, at: number): T {
  if (Array.isArray(value)) return Object.assign(value.map(item => markSavedMetadata(item, at)), { cachedAt: at }) as T;
  if (!value || typeof value !== "object") return value;
  const v = row(value);
  return { ...v, cachedAt: at, ...(v.price ? { price: undefined } : {}),
    ...(Array.isArray(v.games) ? { games: markSavedMetadata(v.games, at) } : {}),
    ...(Array.isArray(v.shelves) ? { shelves: markSavedMetadata(v.shelves, at) } : {}) } as T;
}
