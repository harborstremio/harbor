import type { GameSummary } from "./types";
import type { AtlasGame } from "./igdb-data";
import { WARHAMMER_CONNECTIONS, isKnownWarhammerMisclassification } from "./warhammer-data";

export const WARHAMMER_TV_API = "https://zapp-gw.web.app/beacon";
// Public catalog identities published by warhammertv.com/series/25010.
// The settings are separate seasons in Loremasters, not one shared chronology.
export const WARHAMMER_SETTINGS = [
  { id: "40k", name: "Warhammer 40,000", season: 1, guide: "https://warhammer40000.com/the-setting/" },
  { id: "sigmar", name: "Age of Sigmar", season: 2, guide: "https://ageofsigmar.com/explore-the-mortal-realms/" },
  { id: "heresy", name: "The Horus Heresy", season: 3, guide: "https://start-warhammer.com/thehorusheresy/" },
  { id: "oldworld", name: "The Old World", season: 4, guide: "https://start-warhammer.com/theoldworld/" },
] as const;
export type WarhammerSetting = typeof WARHAMMER_SETTINGS[number]["id"];
export type WarhammerScreen = { id: string; title: string; summary: string; image: string; url: string; minutes?: number; free: boolean; kind: "series" | "episode"; keywords: string };
export type WarhammerFeed = { items: WarhammerScreen[]; observedAt: number; partial: boolean };
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const text = (value: unknown, max = 900) => typeof value === "string" ? value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, max) : "";

export function isWarhammerGame(game: GameSummary, atlas?: AtlasGame | null) {
  if (WARHAMMER_CONNECTIONS.some(item => item.steamId === game.steamId || item.id === game.igdbId)) return true;
  return !!atlas?.franchises.some(item => item.id === 6) && !isKnownWarhammerMisclassification(atlas.igdbId);
}
export function warhammerTvUrl(kind: "animations" | WarhammerSetting) {
  if (kind === "animations") return `${WARHAMMER_TV_API}/filtered-playlists/34/assets?layout_id=444&loadPlaylist=true&include_total=true&limit=100`;
  const setting = WARHAMMER_SETTINGS.find(value => value.id === kind);
  if (!setting) throw Error("Invalid Warhammer setting");
  return `${WARHAMMER_TV_API}/series/25010/episodes?seasonNum=${setting.season}&layout_id=363&loadPlaylist=true&include_total=true&limit=100`;
}
export function warhammerTvImage(value: unknown) {
  try { const url = new URL(String(value)); return url.protocol === "https:" && url.hostname === "beacon.playback.api.brightcove.com" && url.pathname.startsWith("/gamesworkshop/uploads/") && !url.username && !url.password ? url.href : ""; } catch { return ""; }
}
export function parseWarhammerFeed(value: unknown, kind: "animations" | WarhammerSetting, observedAt = Date.now()): WarhammerFeed {
  const root = record(value), setting = WARHAMMER_SETTINGS.find(item => item.id === kind);
  if (!Array.isArray(root.entry) || root.entry.length > 100 || (kind === "animations" ? root.id !== "34-assets" : record(root.extensions).season_original_name !== setting?.name)) throw Error("Warhammer catalog identity changed");
  const items: WarhammerScreen[] = [], seen = new Set<string>();
  for (const raw of root.entry) {
    const row = record(raw), ext = record(row.extensions), id = text(row.id, 20), title = text(row.title, 180), type = record(row.type).value;
    if (!/^\d{1,12}$/.test(id) || !title || seen.has(id) || !["series", "episodes", "movies"].includes(String(type))) continue;
    if (setting && (ext.series_id !== 25010 || ext.season_original_name !== setting.name)) continue;
    const images = Array.isArray(row.media_group) ? row.media_group.flatMap(group => Array.isArray(record(group).media_item) ? record(group).media_item as unknown[] : []) : [];
    const image = images.map(item => warhammerTvImage(record(item).src)).find(Boolean) ?? "";
    let url = type === "series" ? `https://warhammertv.com/series/${id}` : "";
    if (!url) {
      try {
        const link = new URL(String(record(row.link).href));
        if (link.origin === new URL(WARHAMMER_TV_API).origin && new RegExp(`^/beacon/video-preload/${id}/streams/\\d+$`).test(link.pathname) && !link.username && !link.password) {
          // Link to the publisher's player, never request a protected stream.
          url = `https://warhammertv.com/player?self-link=${encodeURIComponent(`${link.origin}${link.pathname}?overrideType=${type}`)}`;
        }
      } catch { /* Malformed independent entries do not replace good cards. */ }
    }
    if (!url) continue;
    seen.add(id);
    items.push({ id, title, image, url, summary: text(row.summary, 700), free: ext.free === true, kind: type === "series" ? "series" : "episode", keywords: text(ext.seo_keywords, 1500), minutes: typeof ext.length === "number" && ext.length > 0 && ext.length < 600 ? ext.length : undefined });
  }
  if (root.entry.length && !items.length) throw Error("Warhammer catalog unavailable");
  return { items, observedAt, partial: items.length !== root.entry.length || root.entry.length === 100 };
}

// Exact screen identities; Secret Level is an anthology, only episode 5 is 40K.
export const WARHAMMER_SECRET_LEVEL = { kind: "series" as const, id: "tt33204697", name: "Secret Level", poster: "https://images.metahub.space/poster/medium/tt33204697/img" };
export const WARHAMMER_ULTRAMARINES = { kind: "movie" as const, id: "tt1679332", name: "Ultramarines: A Warhammer 40,000 Movie", poster: "https://images.metahub.space/poster/medium/tt1679332/img" };
export const WARHAMMER_SECRET_TRAILER = { id: "YMZffM5bKmg", title: "Secret Level Trailer | Warhammer 40,000", creator: "Warhammer", gameName: "Secret Level", gameId: 185252 };
