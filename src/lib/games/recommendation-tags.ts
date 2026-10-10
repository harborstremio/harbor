/** Public Steam tag observations. Weights order tags; they are not match percentages. */
export type RecommendationTag = { id: number; weight: number };
export type RecommendationTagProfile = { appid: number; tags: RecommendationTag[]; cachedAt?: number };
export type RecommendationTagName = { id: number; name: string };
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const id = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 4_294_967_295;

export function decodeRecommendationTagProfile(value: unknown): RecommendationTagProfile | null {
  const raw = record(value);
  if (!id(raw.appid) || !Array.isArray(raw.tags) || raw.tags.length > 20) return null;
  const tags: RecommendationTag[] = [];
  for (const entry of raw.tags) {
    const tag = record(entry);
    if (!id(tag.id) || typeof tag.weight !== "number" || !Number.isFinite(tag.weight) || tag.weight <= 0) return null;
    if (!tags.some(previous => previous.id === tag.id)) tags.push({ id: tag.id, weight: tag.weight });
  }
  return { appid: raw.appid, tags: tags.sort((a,b) => b.weight-a.weight) };
}

export function parseRecommendationTagProfile(value: unknown, appid: number): RecommendationTagProfile {
  const items = record(record(value).response).store_items;
  const item = Array.isArray(items) ? items.map(record).find(item => item.appid === appid && item.success === 1 && item.item_type === 0) : undefined;
  if (!item || !Array.isArray(item.tags)) throw Error("Steam tags unavailable");
  const profile = decodeRecommendationTagProfile({ appid, tags: item.tags.slice(0,20).map(entry => { const tag = record(entry); return { id: tag.tagid, weight: tag.weight }; }) });
  if (!profile) throw Error("Invalid Steam tags");
  return profile;
}

export function decodeRecommendationTagNames(value: unknown): RecommendationTagName[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 2000) return null;
  const result: RecommendationTagName[] = [];
  for (const entry of value) {
    const tag = record(entry);
    if (!id(tag.id) || typeof tag.name !== "string" || !tag.name.trim() || tag.name.length > 120 || /[\u0000-\u001f\u007f]/.test(tag.name)) return null;
    if (!result.some(previous => previous.id === tag.id)) result.push({ id: tag.id, name: tag.name.trim() });
  }
  return result;
}

export function parseRecommendationTagNames(value: unknown): RecommendationTagName[] {
  const tags = record(record(value).response).tags;
  const names = decodeRecommendationTagNames(Array.isArray(tags) ? tags.map(entry => { const tag = record(entry); return { id: tag.tagid, name: tag.name }; }) : null);
  if (!names) throw Error("Steam tag names unavailable");
  return names;
}

const languages: Record<string,string> = { de:"german", es:"spanish", fr:"french", id:"indonesian", it:"italian", ja:"japanese", ko:"koreana", pl:"polish", pt:"brazilian", ru:"russian", tr:"turkish", vi:"vietnamese", zh:"schinese" };
export const recommendationTagLanguage = (language: string) => languages[language] ?? "english";

/** A transparent two-tag intersection, not an inferred taste or similarity score. */
export function recommendationTagPair(profile: RecommendationTagProfile, names: RecommendationTagName[]): RecommendationTagName[] {
  const byId = new Map(names.map(tag => [tag.id,tag]));
  const pair = profile.tags.slice().sort((a,b) => b.weight-a.weight).slice(0,2).map(tag => byId.get(tag.id));
  return pair.length === 2 && pair.every((tag): tag is RecommendationTagName => !!tag) ? pair : [];
}
