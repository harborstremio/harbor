import { gameImage, plainGameText } from "./steam-data";

const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown) => typeof value === "string" ? plainGameText(value).slice(0, 1000) : "";
// Valve's ELanguage values. Unknown language IDs are omitted rather than mislabeled.
const LANGUAGE_CODES = ["en", "de", "fr", "it", "ko", "es-ES", "zh-CN", "zh-TW", "ru", "th", "ja", "pt-PT", "pl", "da", "nl", "fi", "nb", "sv", "hu", "cs", "ro", "tr", "pt-BR", "bg", "el", "ar", "uk", "es-419", "vi", "id"];

export type GameLanguage = { code: string; interface: boolean; audio: boolean; subtitles: boolean };
export type GameRating = { agency: string; rating: string; image: string; descriptors: string[]; interactive: string; source?: { name: string; url: string } };
export type GameDetailExtras = { languages: GameLanguage[]; rating?: GameRating; controller?: "full" | "partial"; deck?: "unknown" | "unsupported" | "playable" | "verified" };
export type PublicGameAchievement = { name: string; description: string; icon: string; percent?: number };
export type GameBroadcast = { appId: number; steamId: string; title: string; viewers: number; thumbnail: string; left: string; right: string; url: string };

export function detailExtrasRequest(appId: number): string {
  if (!Number.isSafeInteger(appId) || appId <= 0) throw Error("Invalid game ID");
  return `https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json=${encodeURIComponent(JSON.stringify({ ids: [{ appid: appId }], context: { language: "english", country_code: "US" }, data_request: { include_supported_languages: true, include_ratings: true } }))}`;
}

export function parseDetailExtras(value: unknown, appId: number): GameDetailExtras {
  const item = list(record(record(value).response).store_items).map(record).find(item => item.appid === appId && item.success === 1);
  if (!item) throw Error("Steam detail identity mismatch");
  const seen = new Set<string>();
  const languages = list(item.supported_languages).flatMap(raw => {
    const entry = record(raw), code = LANGUAGE_CODES[Number(entry.elanguage)];
    if (!code || entry.supported !== true || seen.has(code) || (typeof entry.eadditionallanguage === "number" && entry.eadditionallanguage !== -1)) return [];
    seen.add(code); return [{ code, interface: true, audio: entry.full_audio === true, subtitles: entry.subtitles === true }];
  });
  const raw = record(item.game_rating), imagePath = text(raw.image_url);
  const agency = /\/ESRB\//i.test(imagePath) ? "ESRB" : /\/PEGI\//i.test(imagePath) ? "PEGI" : /\/USK\//i.test(imagePath) ? "USK" : "";
  const image = gameImage(imagePath.startsWith("public/shared/images/game_ratings/") ? `https://store.akamai.steamstatic.com/${imagePath}` : imagePath);
  const rating = agency && image && text(raw.rating) ? { agency, rating: text(raw.rating).toUpperCase(), image, descriptors: list(raw.descriptors).map(text).filter(Boolean).slice(0, 20), interactive: text(raw.interactive_elements) } : undefined;
  const categories = list(record(item.categories).controller_categoryids);
  return { languages, rating, controller: categories.includes(28) ? "full" : categories.includes(18) ? "partial" : undefined };
}

export function parseDeckCompatibility(value: unknown, appId: number): NonNullable<GameDetailExtras["deck"]> {
  const data = record(value), results = record(data.results);
  if (data.success !== 1 || results.appid !== appId || ![0, 1, 2, 3].includes(Number(results.resolved_category))) throw Error("Deck compatibility unavailable");
  return (["unknown", "unsupported", "playable", "verified"] as const)[Number(results.resolved_category)]!;
}

export function requirementRows(value: string): { notes: string[]; specs: { label: string; value: string }[] } {
  const notes: string[] = [], specs: { label: string; value: string }[] = [];
  for (const line of value.split(/\n/).map(line => line.trim()).filter(Boolean)) {
    if (/^(Minimum|Recommended):?$/i.test(line)) continue;
    const spec = line.match(/^(OS|Processor|Memory|Graphics|DirectX|Network|Storage|Sound Card|Additional Notes|VR Support):\s*(.+)$/i);
    if (spec) specs.push({ label: spec[1]!, value: spec[2]! }); else notes.push(line);
  }
  return { notes, specs };
}

export function parsePublicAchievements(html: string, appId: number): PublicGameAchievement[] {
  if (!Number.isSafeInteger(appId) || appId <= 0 || html.length > 2 * 1024 * 1024) throw Error("Invalid achievement response");
  if (!new RegExp(`(?:store\\.steampowered\\.com/app/|steamcommunity\\.com/(?:app|stats)/)${appId}(?:/|["?])`).test(html)) throw Error("Achievement identity mismatch");
  const seen = new Set<string>();
  const rows = html.split(/<div\s+class=["']achieveRow\b[^"']*["'][^>]*>/i).slice(1, 2001);
  const items = rows.flatMap(row => {
    const name = text(row.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1]);
    const description = text(row.match(/<h5[^>]*>([\s\S]*?)<\/h5>/i)?.[1]);
    const icon = gameImage(row.match(/<img[^>]+src=["']([^"']+)/i)?.[1]);
    const percentValue = row.match(/class=["']achievePercent["'][^>]*>\s*([\d.]+)%/i)?.[1];
    const percent = percentValue === undefined ? undefined : Number(percentValue);
    if (!name || !icon || !icon.includes(`/apps/${appId}/`) || seen.has(name)) return [];
    seen.add(name);
    return [{ name, description, icon, ...(percent !== undefined && Number.isFinite(percent) && percent >= 0 && percent <= 100 ? { percent } : {}) }];
  });
  if (!items.length) throw Error("Public achievements unavailable");
  return items;
}

/** This is a global partner feed; the caller must match appId, never trust a query filter. */
export function parseGameBroadcasts(value: unknown): GameBroadcast[] {
  const data = record(value);
  if (data.success !== 1 || !Array.isArray(data.filtered)) throw Error("Broadcast feed unavailable");
  const seen = new Set<string>();
  return data.filtered.slice(0, 300).flatMap(raw => {
    const item = record(raw), appId = Number(item.appid), steamId = text(item.broadcaststeamid);
    const viewers = Number(item.viewer_count);
    let thumbnail = "";
    try { const url = new URL(text(item.thumbnail_http_address)); if (url.protocol === "https:" && url.hostname === "steambroadcast.akamaized.net" && url.pathname.startsWith(`/broadcast/${steamId}/`)) thumbnail = url.href; } catch { /* Missing preview is valid. */ }
    if (!Number.isSafeInteger(appId) || appId <= 0 || !/^7656119\d{10}$/.test(steamId) || !Number.isSafeInteger(viewers) || viewers < 0 || seen.has(steamId)) return [];
    seen.add(steamId);
    return [{ appId, steamId, title: text(item.store_title || item.title), viewers, thumbnail, left: gameImage(item.left_panel), right: gameImage(item.right_panel), url: `https://steamcommunity.com/broadcast/watch/${steamId}` }];
  }).sort((a, b) => b.viewers - a.viewers);
}
