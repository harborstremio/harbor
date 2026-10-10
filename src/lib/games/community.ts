import { gameImage, plainGameText } from "./steam-data";

type Value = Record<string, unknown>;
const record = (value: unknown): Value => value && typeof value === "object" && !Array.isArray(value) ? value as Value : {};
const text = (value: unknown, max = 4000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const count = (value: unknown): number | undefined => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
const decimalId = (value: unknown) => typeof value === "string" && /^[1-9]\d{0,19}$/.test(value) ? value : "";

export type GameNews = { id: string; title: string; url: string; body: string; image: string; date: number };
export type GameReview = {
  id: string; author: string; body: string; date: number; updated: number; positive: boolean;
  minutes?: number; totalMinutes?: number; reviewCount?: number; helpful: number; purchased: boolean; free: boolean; earlyAccess: boolean; deck: boolean; refunded: boolean;
  response: string;
};
export type GameReviewSummary = { positive: number; negative: number; total: number };
export type GameReviewPage = { reviews: GameReview[]; cursor: string | null; total?: number; summary?: GameReviewSummary };
export type GameReviewFilters = {
  sort: "recent" | "helpful" | "updated";
  sentiment: "all" | "positive" | "negative";
  language: "english" | "all";
  hours: 0 | 10 | 100;
  purchase: "all" | "steam" | "other";
  deck: boolean;
};
export const INITIAL_REVIEW_FILTERS: GameReviewFilters = { sort: "recent", sentiment: "all", language: "english", hours: 0, purchase: "all", deck: false };

export type GameReviewAuthor = { name: string; avatar: string };
export function reviewAuthorRequest(steamId: string): string {
  if (!/^7656119\d{10}$/.test(steamId)) throw Error("Invalid reviewer ID");
  const account = BigInt(steamId) - 76561197960265728n;
  if (account < 0n || account > 0xffffffffn) throw Error("Invalid reviewer ID");
  return `https://steamcommunity.com/miniprofile/${account}/json/`;
}
export function parseReviewAuthor(value: unknown): GameReviewAuthor {
  const author = record(value);
  // Names are literal text; private/unavailable profiles keep an honest fallback.
  const name = text(author.persona_name, 160), candidate = gameImage(author.avatar_url);
  const imageUrl = candidate ? new URL(candidate) : null;
  const avatar = imageUrl && !imageUrl.username && !imageUrl.password ? candidate : "";
  if (!name) throw Error("Unavailable reviewer profile");
  return { name, avatar };
}

/** BBCode is rendered as text, never inserted as markup or used for executable links. */
export function communityText(value: unknown, max = 6000): string {
  return plainGameText(text(value, 24_000)
    .replace(/\[(?:img|previewyoutube|video)[^\]]*\][\s\S]*?\[\/(?:img|previewyoutube|video)\]/gi, " ")
    .replace(/\{STEAM_CLAN_IMAGE\}\/[^\s\]]+/g, "")
    .replace(/\[(?:\/?(?:p|h[1-6]|quote|list|olist|table|tr|td|th|hr)|\/?\*)[^\]]*\]/gi, "\n")
    .replace(/\[(?:\/?(?:b|i|u|s|url|code|spoiler))[^\]]*\]/gi, ""))
    .replace(/\\?\[\s*([A-Z][A-Z0-9 &/-]{1,40})\s*\\?\]/g, (_match, heading: string) => `\n${heading.trim()}\n`)
    .replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
}

export function steamNewsUrl(value: unknown): string {
  try {
    const url = new URL(text(value, 2000));
    if (url.protocol !== "https:" || url.username || url.password) return "";
    return ["store.steampowered.com", "steamcommunity.com", "steamstore-a.akamaihd.net"].includes(url.hostname) ? url.href : "";
  } catch { return ""; }
}

export function parseGameNews(value: unknown, appId: number): GameNews[] {
  const root = record(record(value).appnews);
  if (root.appid !== appId || !Array.isArray(root.newsitems)) throw Error("Invalid game news response");
  const seen = new Set<string>();
  return root.newsitems.slice(0, 12).flatMap(raw => {
    const item = record(raw), id = decimalId(item.gid), date = count(item.date), title = communityText(item.title, 220), url = steamNewsUrl(item.url);
    if (!id || !title || !url || !date || item.appid !== appId || item.feedname !== "steam_community_announcements" || seen.has(id)) return [];
    seen.add(id);
    const contents = text(item.contents, 24_000), clan = contents.match(/\{STEAM_CLAN_IMAGE\}\/(\d+\/[a-zA-Z0-9_.-]+\.(?:png|jpe?g|webp))/i);
    const inline = contents.match(/\[img\](https:\/\/[^\s\[]+)\[\/img\]/i)?.[1] ?? contents.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/i)?.[1];
    const image = gameImage(clan ? `https://clan.akamai.steamstatic.com/images/${clan[1]}` : inline);
    const body = communityText(contents, 1100).replace(/^For a fully localized version[^.!?]*[.!?]\s*/i, "").replace(/\s+/g, " ").trim().slice(0, 900);
    return [{ id, title, url, date, image, body }];
  }).sort((a, b) => b.date - a.date);
}

export function reviewRequest(appId: number, filters: GameReviewFilters, cursor = "*"): string {
  if (!Number.isSafeInteger(appId) || appId <= 0 || appId > 0xffffffff || cursor.length > 2048 || /[\x00-\x1f]/.test(cursor)) throw Error("Invalid review query");
  if (!["recent", "helpful", "updated"].includes(filters.sort) || !["all", "positive", "negative"].includes(filters.sentiment) || !["english", "all"].includes(filters.language) || ![0, 10, 100].includes(filters.hours) || !["all", "steam", "other"].includes(filters.purchase)) throw Error("Invalid review filters");
  const input = { appid: appId, filter: { helpful: 0, recent: 1, updated: 2 }[filters.sort], languages: [filters.language], day_range: 365, cursor,
    review_type: { all: 0, positive: 1, negative: 2 }[filters.sentiment], purchase_type: { steam: 0, all: 1, other: 2 }[filters.purchase],
    num_per_page: 6, ...(filters.hours ? { playtime_min_hours: filters.hours } : {}), ...(filters.deck ? { primarily_steam_deck: true } : {}) };
  return `https://api.steampowered.com/IUserReviewsService/GetAppReviews/v1/?input_json=${encodeURIComponent(JSON.stringify(input))}`;
}

export function parseGameReviews(value: unknown, previousCursor = "*"): GameReviewPage {
  const root = record(record(value).response);
  // An empty object is a provider failure, not evidence that the game has no reviews.
  if (!Array.isArray(root.reviews) && count(record(root.query_summary).num_reviews) !== 0) throw Error("Invalid game review response");
  const seen = new Set<string>();
  const reviews = (Array.isArray(root.reviews) ? root.reviews : []).slice(0, 100).flatMap(raw => {
    const item = record(raw), author = record(item.author), id = decimalId(item.recommendationid), steamId = text(author.steamid, 20);
    const date = count(item.timestamp_created), body = communityText(item.review);
    if (!id || !/^7656119\d{10}$/.test(steamId) || !date || !body || typeof item.voted_up !== "boolean" || seen.has(id)) return [];
    seen.add(id);
    return [{ id, author: steamId, body, date, updated: count(item.timestamp_updated) ?? date, positive: item.voted_up,
      minutes: count(author.playtime_at_review), totalMinutes: count(author.playtime_forever), reviewCount: count(author.num_reviews), helpful: count(item.votes_up) ?? 0, purchased: item.steam_purchase === true,
      free: item.received_for_free === true, earlyAccess: item.written_during_early_access === true, deck: item.primarily_steam_deck === true,
      refunded: item.refunded === true, response: communityText(item.developer_response, 2000) }];
  });
  const rawSummary = record(root.query_summary), positive = count(rawSummary.total_positive), negative = count(rawSummary.total_negative), total = count(rawSummary.total_reviews);
  const summary = positive !== undefined && negative !== undefined && total !== undefined && positive + negative === total ? { positive, negative, total } : undefined;
  const cursor = text(root.cursor, 2049);
  return { reviews, cursor: reviews.length && cursor && cursor !== previousCursor && cursor.length <= 2048 && !/[\x00-\x1f]/.test(cursor) ? cursor : null,
    total: count(root.total_matching), summary };
}

export function gameReviewUrl(review: GameReview, appId: number): string {
  return `https://steamcommunity.com/profiles/${review.author}/recommended/${appId}/`;
}
