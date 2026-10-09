import type { GameRating } from "./detail-extras-data";

export type AgeRatingAgency = "ESRB" | "PEGI";
export type GameAgeRating = { agency: AgeRatingAgency; rating: string; descriptors: string[] };
export const IGDB_AGE_RATING_FIELDS = "age_ratings.organization.name,age_ratings.rating_category.rating,age_ratings.rating_content_descriptions.description";
const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max: number) => typeof value === "string" && value.length <= max && !/[\x00-\x1f\x7f]/.test(value) ? value.trim() : "";

/** Current IGDB organization/category records; legacy numeric ratings are not guesses. */
export function parseAgeRatings(value: unknown): GameAgeRating[] {
  if (!Array.isArray(value) || value.length > 64) return [];
  const ratings = new Map<string, GameAgeRating>();
  for (const item of value) {
    const raw = object(item), organization = object(raw.organization);
    const agency = organization.id === 1 ? "ESRB" : organization.id === 2 ? "PEGI" : null;
    const rating = text(object(raw.rating_category).rating, 32);
    if (!agency || organization.name !== agency || !rating) continue;
    const descriptions = Array.isArray(raw.rating_content_descriptions) ? raw.rating_content_descriptions.slice(0, 40) : [];
    const key = `${agency}:${rating}`;
    const descriptors = [...new Set([...(ratings.get(key)?.descriptors ?? []), ...descriptions.map(value => text(object(value).description, 300)).filter(Boolean)])].slice(0, 40);
    ratings.set(key, { agency, rating, descriptors });
  }
  return [...ratings.values()];
}

/** Keep the same public response shape so persisted and fresh records use one parser. */
export function ageRatingRecords(value: unknown) {
  return parseAgeRatings(value).map(item => ({
    organization: { id: item.agency === "ESRB" ? 1 : 2, name: item.agency },
    rating_category: { rating: item.rating },
    rating_content_descriptions: item.descriptors.map(description => ({ description })),
  }));
}

export function chooseAgeRatings(ratings: GameAgeRating[] | undefined, preferred: AgeRatingAgency, steam?: GameRating, igdbUrl?: string): GameRating[] {
  const own = ratings ?? [], selected = own.filter(item => item.agency === preferred);
  if (!selected.length && steam?.agency === preferred) return [steam];
  const candidates = selected.length ? selected : own;
  if (!candidates.length) return steam ? [steam] : [];
  return candidates.map(item => ({ ...item, image: "", interactive: "", ...(igdbUrl ? { source: { name: "IGDB", url: igdbUrl } } : {}) }));
}
