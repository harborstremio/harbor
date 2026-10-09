export const FORTNITE_API = "https://api.fortnite.com/ecosystem/v1";
export const FORTNITE_MEDIA_API = "https://prod.fn-api.cc/v1/mnemonic";
export const FORTNITE_PAGE_SIZE = 6;
export const FORTNITE_TTL = 10 * 60_000;
export const FORTNITE_GENRES = ["shooter", "battle-royale", "adventure-rpg", "survival", "strategy", "sports-racing", "simulation-tycoon", "roleplaying-social", "roguelike", "party-mini-games", "music-rhythm", "horror", "deathrun-platformer"] as const;
export type FortniteGenre = typeof FORTNITE_GENRES[number];
export type FortniteRank = { code: string; rank: number };
export type FortniteRankings = { rows: FortniteRank[]; snapshot: string | null; available: boolean; total: number; next: string | null; previous: string | null };
export type FortniteIsland = { code: string; title: string; description: string; image?: string; thumbnail?: string; titles: Record<string, string>; descriptions: Record<string, string>; creator: string; players?: number };
export type FortniteActivity = { date: number; peak: number | null; players: number | null } | null;
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max = 300) => typeof value === "string" ? value.trim().slice(0, max) : "";
const count = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
export const fortniteCode = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{4}-\d{4}$/.test(value);
export function fortniteIslandUrl(code: string): string {
  if (!fortniteCode(code)) throw Error("Invalid island code");
  return `https://play.fn.gg/island/${code}`;
}
function cursor(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^[A-Za-z0-9+/=_-]{1,256}$/.test(value)) throw Error("Invalid island cursor");
  return value;
}
export function fortniteRankingsUrl(genre: string, page?: { cursor: string; before?: boolean; snapshot: string }): string {
  if (!(FORTNITE_GENRES as readonly string[]).includes(genre)) throw Error("Invalid island genre");
  const query = new URLSearchParams({ size: String(FORTNITE_PAGE_SIZE) });
  if (page) {
    if (!cursor(page.cursor) || !Number.isFinite(Date.parse(page.snapshot))) throw Error("Invalid island page");
    query.set(page.before ? "before" : "after", page.cursor); query.set("at", page.snapshot);
  }
  return `${FORTNITE_API}/genres/${genre}/rankings?${query}`;
}
export function parseFortniteRankings(raw: unknown): FortniteRankings {
  const value = record(raw), meta = record(value.meta), page = record(meta.page);
  if (!Array.isArray(value.data) || value.data.length > FORTNITE_PAGE_SIZE || typeof meta.snapshotAvailable !== "boolean" || count(meta.total) === undefined || meta.count !== value.data.length
    || (meta.snapshot !== null && (typeof meta.snapshot !== "string" || !Number.isFinite(Date.parse(meta.snapshot))))
    || (meta.snapshotAvailable && !meta.snapshot)) throw Error("Invalid Fortnite ranking response");
  const rows = value.data.map(item => {
    const row = record(item);
    if (!fortniteCode(row.islandCode) || !count(row.rank)) throw Error("Invalid island rank");
    return { code: row.islandCode, rank: row.rank as number };
  });
  if (new Set(rows.map(row => row.code)).size !== rows.length || rows.some((row, i) => row.rank > (meta.total as number) || (i > 0 && row.rank <= rows[i - 1]!.rank)) || (!meta.snapshotAvailable && rows.length)) throw Error("Conflicting island rankings");
  return { rows, snapshot: meta.snapshot as string | null, available: meta.snapshotAvailable, total: meta.total as number, next: cursor(page.nextCursor), previous: cursor(page.prevCursor) };
}
function imageUrl(value: unknown): string | undefined {
  try {
    const url = new URL(text(value, 2000));
    const allowed = /^cdn-\d{4}\.qstv\.on\.epicgames\.com$/.test(url.hostname) || ["cdn2.unrealengine.com", "cdn1.epicgames.com", "cdn.fn-api.cc"].includes(url.hostname);
    return url.protocol === "https:" && !url.username && !url.password && allowed ? url.href : undefined;
  } catch { return undefined; }
}
function translations(raw: unknown): Record<string, string> {
  return Object.fromEntries(Object.entries(record(raw)).slice(0, 40).filter(([key, value]) => /^[a-z]{2}(?:-[A-Z0-9]{2,3})?$/.test(key) && typeof value === "string" && value.trim()).map(([key, value]) => [key, text(value, 3000)]));
}
export function parseFortniteIsland(raw: unknown, code: string): FortniteIsland {
  const root = record(raw), data = record(root.data), metadata = record(data.metadata), images = record(data.images), matchmaking = record(data.matchmaking);
  if (!fortniteCode(code) || root.status !== 200 || root.mnemonic !== code || data.mnemonic !== code || data.linkType !== "valkyrie:application" || !text(data.title)
    || (metadata.code !== undefined && metadata.code !== code) || (metadata.moderationStatus !== undefined && metadata.moderationStatus !== "Approved")) throw Error("Island metadata identity mismatch");
  const players = count(record(matchmaking.v3).maxPlayers) ?? count(record(matchmaking.v2).maxPlayers) ?? count(record(matchmaking.v1).maxPlayers);
  return { code, title: text(data.title), description: text(data.description, 3000), creator: text(data.creator),
    image: imageUrl(images.full) ?? imageUrl(data.image), thumbnail: imageUrl(images.medium) ?? imageUrl(data.image),
    titles: translations(metadata.alt_title), descriptions: translations(metadata.alt_introduction), players: players && players <= 1000 ? players : undefined };
}
export function parseFortniteIslandBasics(raw: unknown, code: string): FortniteIsland {
  const data = record(raw);
  if (!fortniteCode(code) || data.code !== code || !text(data.title)) throw Error("Island metadata identity mismatch");
  return { code, title: text(data.title), creator: text(data.creatorCode), description: "", titles: {}, descriptions: {} };
}
export function localizeFortniteIsland(island: FortniteIsland, language: string) {
  const locale = language === "pt" ? "pt-BR" : language === "zh" ? "zh-CN" : language;
  return { ...island, title: island.titles[locale] || island.title, description: island.descriptions[locale] || island.description };
}
export function parseFortniteActivity(raw: unknown, now = Date.now()): FortniteActivity {
  const data = record(raw), today = Math.floor(now / 86_400_000) * 86_400_000;
  if (!Array.isArray(data.peakCCU) || !Array.isArray(data.uniquePlayers)) throw Error("Invalid island activity");
  const series = (rows: unknown[]) => new Map(rows.slice(0, 10).flatMap(item => {
    const row = record(item), date = typeof row.timestamp === "string" ? Date.parse(row.timestamp) : NaN;
    return Number.isFinite(date) && date % 86_400_000 === 0 && date < today && date >= today - 7 * 86_400_000 ? [[date, count(row.value) ?? null] as const] : [];
  }));
  const peaks = series(data.peakCCU), players = series(data.uniquePlayers), date = Math.max(...peaks.keys(), ...players.keys());
  return Number.isFinite(date) ? { date, peak: peaks.get(date) ?? null, players: players.get(date) ?? null } : null;
}
