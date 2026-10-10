export type TarkovSeason = { season: string; start: number; end: number };
export type TarkovWipe = { name: string; start: number };
export const TARKOV_SEASONS = "https://raw.githubusercontent.com/the-hideout/tarkov-dev/main/src/data/season-details.json";
export const TARKOV_WIPES = "https://raw.githubusercontent.com/the-hideout/tarkov-dev/main/src/data/wipe-details.json";
export const isTarkov = (game: { steamId?: number; igdbId?: number }) => game.igdbId === 15536;
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
function date(v: unknown) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.000Z$/.test(v)) throw Error("Invalid Tarkov date");
  const at = Date.parse(v);
  if (!Number.isFinite(at) || new Date(at).toISOString() !== v || at < Date.UTC(2016, 0, 1) || at > Date.UTC(2100, 0, 1)) throw Error("Invalid Tarkov date");
  return at;
}
function rows(v: unknown) { if (!Array.isArray(v) || v.length > 200) throw Error("Invalid Tarkov schedule"); return v.map(object); }
export function parseTarkovSeasons(raw: unknown): TarkovSeason[] {
  const seasons = rows(raw).map(v => {
    if (typeof v.season !== "string" || !/^\d{1,3}$/.test(v.season)) throw Error("Invalid Tarkov season");
    const start = date(v.start), end = date(v.end);
    if (end <= start) throw Error("Invalid Tarkov season interval");
    return { season: v.season, start, end };
  }).sort((a, b) => a.start - b.start);
  if (new Set(seasons.map(s => s.season)).size !== seasons.length || seasons.some((s, i) => i > 0 && s.start < seasons[i - 1].end)) throw Error("Conflicting Tarkov seasons");
  return seasons;
}
export function parseTarkovWipes(raw: unknown): TarkovWipe[] {
  const wipes = rows(raw).map(v => {
    if (typeof v.name !== "string" || !/^\d+(?:\.\d+){1,4}$/.test(v.name) || v.name.length > 30) throw Error("Invalid Tarkov patch");
    return { name: v.name, start: date(v.start) };
  }).sort((a, b) => b.start - a.start);
  if (new Set(wipes.map(w => w.name)).size !== wipes.length || new Set(wipes.map(w => w.start)).size !== wipes.length) throw Error("Duplicate Tarkov wipe");
  return wipes;
}
export function tarkovSeasonAt(seasons: TarkovSeason[], now: number) {
  const current = seasons.find(s => s.start <= now && now < s.end);
  const upcoming = seasons.find(s => s.start > now);
  return current ? { kind: "active" as const, season: current, target: current.end } : upcoming ? { kind: "upcoming" as const, season: upcoming, target: upcoming.start } : null;
}
export function tarkovRemaining(target: number, now: number) {
  const total = Math.max(0, Math.ceil((target - now) / 60_000));
  return { days: Math.floor(total / 1440), hours: Math.floor(total % 1440 / 60), minutes: total % 60 };
}
