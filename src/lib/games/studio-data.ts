import { igdbImage, parseAtlasGame, type AtlasGame, type GameConnection } from "./igdb-data";
import { savedMetadataAt } from "./metadata-records";

export type StudioProfile = GameConnection & { description: string; parent?: GameConnection; children: GameConnection[]; games: AtlasGame[]; cachedAt?: number };
type RecordValue = Record<string, unknown>;
const row = (v: unknown): RecordValue => v && typeof v === "object" && !Array.isArray(v) ? v as RecordValue : {};
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
function company(v: unknown): GameConnection | null {
  const c = row(v);
  return Number.isSafeInteger(c.id) && Number(c.id) > 0 && typeof c.name === "string" && c.name.trim()
    ? { id: Number(c.id), name: c.name.slice(0, 180), image: igdbImage(c.logo, "logo_med") || undefined } : null;
}
function companyLineage(rows: unknown[]): RecordValue[] {
  return rows.flatMap(game => list(row(game).involved_companies).flatMap(value => {
    const c = row(row(value).company);
    return [c, row(c.parent), row(row(c.parent).parent)];
  }));
}
export function parseStudioProfile(rows: unknown[], id: number): StudioProfile {
  const lineage = companyLineage(rows), raw = lineage.find(value => value.id === id), profile = company(raw);
  if (!profile) throw Error("Company unavailable");
  let children = [...new Map(lineage.filter(value => row(value.parent).id === id).flatMap(value => {
    const c = company(value); return c ? [[c.id, c] as const] : [];
  })).values()];
  const current2K = company(lineage.find(value => value.id === 20228));
  if (id === 139 && current2K) children = [current2K, ...children.filter(child => child.id !== 8 && child.id !== 20228)];
  const parent = company(raw?.parent) ?? (id === 20228 ? company(lineage.find(value => value.id === 139)) ?? { id:139,name:"Take-Two Interactive" } : undefined);
  return { ...profile, description: typeof raw?.description === "string" ? raw.description.slice(0, 2400) : "", parent, children, cachedAt: savedMetadataAt(rows),
    games: [...new Map(rows.map(parseAtlasGame).map(game => [game.id, game])).values()] };
}
export function studioSearchQuery(query: string): string {
  const term = query.trim().slice(0, 100).replace(/["\\*\r\n\x00-\x1f]/g, " ").trim();
  if (term.length < 2) throw Error("Studio search needs two characters");
  return `fields involved_companies.company.name,involved_companies.company.logo.image_id,involved_companies.company.parent.name,involved_companies.company.parent.logo.image_id; where (involved_companies.company.name ~ *"${term}"* | involved_companies.company.parent.name ~ *"${term}"*) & version_parent = null; sort total_rating_count desc; limit 50;`;
}
export function parseStudioSearch(rows: unknown[], query: string): GameConnection[] {
  const term = query.trim().toLocaleLowerCase();
  return [...new Map(companyLineage(rows).flatMap(value => {
    const c = company(value); return c && c.name.toLocaleLowerCase().includes(term) ? [[c.id, c] as const] : [];
  })).values()].sort((a, b) => Number(b.name.toLocaleLowerCase() === term) - Number(a.name.toLocaleLowerCase() === term) || a.name.localeCompare(b.name)).slice(0, 16);
}
export function parseStudioMarks(rows: unknown[], ids: readonly number[]): GameConnection[] {
  return [...new Map(companyLineage(rows).flatMap(value => {
    const c = company(value); return c && ids.includes(c.id) ? [[c.id, c] as const] : [];
  })).values()];
}
/** A publisher spread should show different series, not four editions of one game. */
export function studioShowcaseGames(games: AtlasGame[], limit = 4): AtlasGame[] {
  const picked: AtlasGame[] = [], series = new Set<string>();
  for (const game of games) {
    const key = game.name.toLocaleLowerCase().replace(/\b(\d+|[ivx]+)\b|[:–-].*/g, "").trim();
    if (series.has(key)) continue;
    picked.push(game); series.add(key);
    if (picked.length === limit) break;
  }
  return picked;
}
