import type { AtlasGame } from "./igdb-data";
import type { GameDetail, GameSummary } from "./types";

export const STEAM_REVIEW_VERDICTS = ["Overwhelmingly Negative", "Very Negative", "Negative", "Mostly Negative", "Mixed", "Mostly Positive", "Positive", "Very Positive", "Overwhelmingly Positive"] as const;
export type SteamReviewVerdict = typeof STEAM_REVIEW_VERDICTS[number];
export function steamReviewVerdict(value: unknown): SteamReviewVerdict | undefined {
  return STEAM_REVIEW_VERDICTS.find(verdict => verdict === value);
}
export type SteamReviewSummary = { positive: number; count: number; verdict?: SteamReviewVerdict };
/** The verdict and percentage must describe the same Steam review sample. */
export function parseSteamReviewSummary(value: unknown): SteamReviewSummary | undefined {
  if (!value || typeof value !== "object") return;
  const summary = value as Record<string, unknown>, positive = summary.percent_positive, count = summary.review_count;
  if (typeof positive !== "number" || !Number.isInteger(positive) || positive < 0 || positive > 100 || typeof count !== "number" || !Number.isSafeInteger(count) || count <= 0) return;
  return { positive, count, verdict: steamReviewVerdict(summary.review_score_label) };
}
export type GameRating = {
  source: "steam" | "metacritic" | "igdb-users" | "igdb-critics";
  kind: "positive-reviews" | "score"; score: number; count?: number; url: string; cachedAt?: number; verdict?: SteamReviewVerdict;
};
export function parseMetacritic(value: unknown): { score: number; url: string } | undefined {
  if (!value || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  if (typeof record.score !== "number" || !Number.isInteger(record.score) || record.score < 0 || record.score > 100 || typeof record.url !== "string") return;
  try {
    const url = new URL(record.url);
    if (!["http:", "https:"].includes(url.protocol) || !["metacritic.com", "www.metacritic.com"].includes(url.hostname) || url.username || url.password || !url.pathname.startsWith("/game/")) return;
    url.protocol = "https:"; return { score: record.score, url: url.href };
  } catch { return; }
}
type ReviewSummary = GameSummary & { reviews?: SteamReviewSummary };
export function combineGameRatings(game: GameSummary, steam?: GameDetail | null, atlas?: AtlasGame | null, reviews?: ReviewSummary | null): GameRating[] {
  const result: GameRating[] = [];
  if (game.steamId && reviews?.steamId === game.steamId && reviews.reviews && Number.isFinite(reviews.reviews.positive) && reviews.reviews.positive >= 0 && reviews.reviews.positive <= 100 && Number.isSafeInteger(reviews.reviews.count) && reviews.reviews.count > 0)
    result.push({ source: "steam", kind: "positive-reviews", score: reviews.reviews.positive, count: reviews.reviews.count, verdict: steamReviewVerdict(reviews.reviews.verdict), url: `https://store.steampowered.com/app/${game.steamId}/#app_reviews_hash`, cachedAt: reviews.cachedAt });
  const critic = game.steamId && steam?.steamId === game.steamId ? parseMetacritic(steam.metacritic) : undefined;
  if (critic) result.push({ source: "metacritic", kind: "score", ...critic, cachedAt: steam?.cachedAt });
  if (atlas && (game.igdbId ? game.igdbId === atlas.igdbId : game.steamId !== undefined && game.steamId === atlas.steamId)) {
    for (const [source, score, count] of [["igdb-users", atlas.userRating, atlas.userRatingCount], ["igdb-critics", atlas.criticRating, atlas.criticRatingCount]] as const)
      if (score !== undefined && Number.isFinite(score) && score >= 0 && score <= 100 && count !== undefined && Number.isSafeInteger(count) && count > 0)
        result.push({ source, kind: "score", score, count, url: atlas.url, cachedAt: atlas.cachedAt });
  }
  return result;
}
