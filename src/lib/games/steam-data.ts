import type { GameArtwork, GameDetail, GameDiscovery, GameShelf, GameSummary } from "./types";
import { parseMetacritic } from "./rating-data";
import { gameLogoSource } from "./logo-art";
import { websiteGameLinks } from "./library-links";

type Value = Record<string, unknown>;
const record = (v: unknown): Value => v && typeof v === "object" && !Array.isArray(v) ? v as Value : {};
const text = (v: unknown): string => typeof v === "string" ? v.trim() : "";
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const names = (v: unknown) => list(v).map(text).filter(Boolean);
const NON_GAME = /^(?:Steam (?:Deck|Frame|Machine|Controller)|Valve Index)\b|\b(?:soundtrack|dedicated server)\b/i;

export function parseSteamPublishers(value: unknown): string[] {
  return [...new Set(list(record(value).publishers).map(item => text(record(item).name).slice(0,160)).filter(Boolean))];
}

export function gameImage(value: unknown): string {
  try {
    const url = new URL(text(value));
    return url.protocol === "https:" && /(?:^|\.)(?:steamstatic\.com|steamcdn-a\.akamaihd\.net|steampowered\.com)$/.test(url.hostname) ? url.href : "";
  } catch { return ""; }
}

export function plainGameText(value: unknown): string {
  return text(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<(?:br|\/p|\/li|\/h\d)\s*\/?>/gi, "\n").replace(/<[^>]*>/g, "")
    .replace(/&(?:amp|quot|apos|lt|gt|nbsp);|&#(?:39|039);/g, entity => ({ "&amp;": "&", "&quot;": '"', "&apos;": "'", "&#39;": "'", "&#039;": "'", "&lt;": "<", "&gt;": ">", "&nbsp;": " " }[entity] ?? entity))
    .replace(/\n\s*\n/g, "\n").trim();
}

/** Retain complete publisher markup; presentation must sanitize it. */
export function gameDescriptionHtml(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim() || value.length > 512 * 1024) return undefined;
  return new TextEncoder().encode(value).byteLength <= 512 * 1024 ? value : undefined;
}

export function steamSummary(value: unknown): GameSummary | null {
  const v = record(value), steamId = Number(v.id ?? v.steam_appid);
  const name = text(v.name), capsule = gameImage(v.large_capsule_image ?? v.header_image ?? v.tiny_image);
  if (!Number.isSafeInteger(steamId) || steamId <= 0 || !name || !capsule || NON_GAME.test(name) || (typeof v.type === "number" && v.type !== 0)) return null;
  const platforms = record(v.platforms);
  const price = record(v.price_overview);
  const amount = Number(price.final ?? v.final_price), currency = text(price.currency ?? v.currency);
  return { id: `steam:${steamId}`, steamId, name, capsule,
    platforms: [(v.windows_available ?? platforms.windows) ? "Windows" : "", (v.mac_available ?? platforms.mac) ? "macOS" : "", (v.linux_available ?? platforms.linux) ? "Linux" : ""].filter(Boolean),
    ...(Number.isFinite(amount) && amount >= 0 && /^[A-Z]{3}$/.test(currency) ? { price: { amount, currency, discount: Number(price.discount_percent ?? v.discount_percent) || 0 } } : {}) };
}

export function parseSteamDiscovery(value: unknown, fetchedAt = Date.now()): GameDiscovery {
  const root = record(value);
  const shelves = (["top_sellers", "new_releases", "coming_soon", "specials"] as GameShelf["id"][]).map(id => {
    const games = list(record(root[id]).items).map(steamSummary).filter((v): v is GameSummary => !!v)
      .map(game => id === "coming_soon" && game.price?.amount === 0 ? { ...game, price: undefined } : game);
    return { id, games: [...new Map(games.map(game => [game.id, game])).values()] };
  });
  if (!shelves.some(shelf => shelf.games.length)) throw new Error("Steam returned no game collections");
  return { shelves, fetchedAt, source: "Steam" };
}

export function parseSteamDetail(value: unknown, steamId: number): GameDetail {
  const response = record(record(value)[String(steamId)]), data = record(response.data);
  const base = steamSummary(data);
  if (response.success !== true || !base || data.type !== "game" || base.steamId !== steamId) throw new Error("Game details unavailable");
  const release = record(data.release_date), requirements = record(data.pc_requirements);
  const screenshotRows = list(data.screenshots).slice(0, 100).map(record);
  const screenshots = [...new Set(screenshotRows.map(row => gameImage(row.path_full)).filter(Boolean))];
  const screenshotThumbnails = steamScreenshotThumbnails(Object.fromEntries(screenshotRows.map(row => [gameImage(row.path_full), row.path_thumbnail])), screenshots);
  return { ...base, steamId, description: plainGameText(data.short_description), about: plainGameText(data.about_the_game), hero: gameImage(record(list(data.screenshots)[0]).path_full) || base.capsule, logo: gameLogoSource(steamId),
    aboutHtml: gameDescriptionHtml(data.about_the_game),
    screenshots, screenshotThumbnails,
    trailers: list(data.movies).flatMap(movie => { const m = record(movie), url = gameImage(m.hls_h264 ?? record(m.webm).max ?? record(m.mp4).max); return url ? [{ name: text(m.name), poster: gameImage(m.thumbnail), url }] : []; }),
    genres: list(data.genres).map(v => text(record(v).description)).filter(Boolean),
    features: list(data.categories).map(v => text(record(v).description)).filter(Boolean),
    featureCategories: list(data.categories).slice(0, 100).flatMap(value => { const category = record(value), name = text(category.description).slice(0, 160); return Number.isSafeInteger(category.id) && Number(category.id) > 0 && Number(category.id) <= 4_294_967_295 && name ? [{ id: Number(category.id), name }] : []; }),
    developers: names(data.developers), publishers: names(data.publishers), release: text(release.date), comingSoon: release.coming_soon === true,
    controller: text(data.controller_support) || undefined,
    requirements: { minimum: plainGameText(requirements.minimum), recommended: plainGameText(requirements.recommended) }, languages: plainGameText(data.supported_languages),
    achievements: typeof record(data.achievements).total === "number" ? Number(record(data.achievements).total) : undefined,
    achievementHighlights: list(record(data.achievements).highlighted).slice(0, 10).flatMap(raw => { const item = record(raw), name = text(item.localized_name || item.name).slice(0, 160), icon = gameImage(item.path); return name && icon ? [{ name, icon }] : []; }),
    recommendations: typeof record(data.recommendations).total === "number" ? Number(record(data.recommendations).total) : undefined,
    metacritic: parseMetacritic(data.metacritic), links: websiteGameLinks([data.website]) };
}

/** Keep thumbnail identities tied to the validated full images, including disk reloads. */
export function steamScreenshotThumbnails(value: unknown, screenshots: readonly string[]): Record<string, string> {
  const source = record(value);
  return Object.fromEntries(screenshots.slice(0, 100).flatMap(full => {
    const thumbnail = Object.hasOwn(source, full) ? gameImage(source[full]) : "";
    return thumbnail ? [[full, thumbnail]] : [];
  }));
}

export function parseSteamArtwork(value: unknown, steamId: number): GameArtwork {
  const item = list(record(record(value).response).store_items).map(record).find(item => item.appid === steamId && item.success === 1);
  const assets = record(item?.assets);
  const format = text(assets.asset_url_format);
  if (!format.startsWith(`steam/apps/${steamId}/`) || !format.includes("${FILENAME}")) return {};
  const result: GameArtwork = {};
  for (const [key, value] of Object.entries({ libraryHero: assets.library_hero_2x ?? assets.library_hero, portrait: assets.library_capsule, wideCapsule: assets.main_capsule_2x ?? assets.main_capsule })) {
    const path = text(value);
    if (!path || path.includes("..") || path.includes(":")) continue;
    const url = gameImage(`https://shared.akamai.steamstatic.com/store_item_assets/${format.replace("${FILENAME}", path)}`);
    if (url) result[key as keyof GameArtwork] = url;
  }
  return result;
}

/** Only extract numeric app identities. Remote search markup is never injected into Harbor. */
export function parseSteamSearchIds(value: unknown): number[] {
  const root = record(value);
  if (root.success !== 1 || typeof root.results_html !== "string") throw new Error("Invalid Steam search response");
  return [...new Set([...root.results_html.matchAll(/data-ds-appid="(\d+)"/g)].map(match => Number(match[1])))].filter(id => Number.isSafeInteger(id) && id > 0).slice(0, 30);
}

export function parseSteamStoreItems(value: unknown, orderedIds: number[]): GameSummary[] {
  const items = list(record(record(value).response).store_items).map(record);
  if (!items.length) throw new Error("Steam returned no item metadata");
  return orderedIds.flatMap(id => {
    const item = items.find(candidate => candidate.appid === id && candidate.success === 1);
    if (!item || item.type !== 0 || item.item_type !== 0 || item.visible === false) return [];
    const art = parseSteamArtwork(value, id);
    const purchase = record(item.best_purchase_option);
    const comingSoon = record(item.release).is_coming_soon === true;
    const summary = steamSummary({ id, type: 0, name: item.name,
      header_image: art.wideCapsule, platforms: item.platforms,
      final_price: purchase.final_price_in_cents ?? (!comingSoon && item.is_free === true ? 0 : undefined), currency: "USD", discount_percent: purchase.discount_pct });
    const releaseTimestamp = record(item.release).steam_release_date;
    const descriptors = item.content_descriptorids;
    const adultContent = descriptors === undefined ? false : Array.isArray(descriptors) && descriptors.every(id => Number.isInteger(id) && id > 0) ? descriptors.some(id => id === 3 || id === 4) : undefined;
    return summary ? [{ ...summary, adultContent, comingSoon, ...(typeof releaseTimestamp === "number" && Number.isSafeInteger(releaseTimestamp) && releaseTimestamp > 0 ? { releaseTimestamp } : {}), ...(art.portrait ? { portrait: art.portrait } : {}) }] : [];
  });
}

export function isRecentGameRelease(game: GameSummary, now = Date.now()): boolean {
  return !game.comingSoon && !!game.releaseTimestamp && game.releaseTimestamp * 1000 <= now && game.releaseTimestamp * 1000 >= now - 90 * 86400_000;
}

/** Publisher supplied short videos; never derive a trailer from another game's path. */
export function parseSteamMicrotrailer(value: unknown, steamId: number): string {
  const item = list(record(record(value).response).store_items).map(record).find(v => v.appid === steamId && v.success === 1);
  for (const trailer of list(record(item?.trailers).highlights)) {
    const clip = list(record(trailer).microtrailer).map(record).find(v => v.type === "video/webm");
    const path = text(clip?.filename);
    if (path.startsWith(`${steamId}/`) && /^[a-zA-Z0-9_./-]+\.webm$/.test(path) && !path.includes("..")) {
      return `https://video.akamai.steamstatic.com/store_trailers/${path}`;
    }
  }
  return "";
}
