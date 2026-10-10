import type { GameSummary } from "./types";

export const VALORANT_API = "https://valorant-api.com/v1";
export const VALORANT_META = "https://op.gg/valorant/statistics";
export const VALORANT_NEWS = "https://playvalorant.com/en-us/news/game-updates/";
export const VALORANT_ROLES = ["Duelist", "Controller", "Initiator", "Sentinel"] as const;
export type ValorantRole = typeof VALORANT_ROLES[number];
type Row = Record<string, unknown>;
const row = (v: unknown): Row => v && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
const text = (v: unknown, max = 200) => typeof v === "string" ? v.trim().slice(0, max) : "";
const number = (v: unknown, max = 1e12): number | undefined => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined;
const uuid = (v: unknown) => typeof v === "string" && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(v) ? v.toLowerCase() : "";
export function isValorant(game: Pick<GameSummary, "id" | "igdbId">) {
  return game.id === "riot:valorant:live" || (game.id === "igdb:126459" && game.igdbId === 126459);
}
export function valorantLocale(language: string) {
  return ({ ar: "ar-AE", de: "de-DE", es: "es-ES", fr: "fr-FR", it: "it-IT", ja: "ja-JP", ko: "ko-KR", pl: "pl-PL", pt: "pt-BR", ru: "ru-RU", tr: "tr-TR", vi: "vi-VN", zh: "zh-CN" } as Record<string, string>)[language] ?? "en-US";
}
export function valorantMedia(value: unknown, video = false): string {
  try {
    const url = new URL(text(value, 2083));
    if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
    if (video) return url.hostname === "cmsassets.rgpub.io" && url.pathname.startsWith("/sanity/files/") && url.pathname.endsWith(".mp4") ? url.href : "";
    return ["media.valorant-api.com", "c-valorant-api.op.gg"].includes(url.hostname) && /\.(png|svg|webp|jpg)$/i.test(url.pathname) ? url.href : "";
  } catch { return ""; }
}
function list(raw: unknown, max: number): unknown[] {
  const v = row(raw);
  if (v.status !== 200 || !Array.isArray(v.data) || !v.data.length || v.data.length > max) throw Error("VALORANT reference unavailable");
  return v.data;
}
export type ValorantAbility = { slot: string; name: string; description: string; icon: string };
export type ValorantAgent = { id: string; name: string; description: string; icon: string; portrait: string; background: string; color: string; role: ValorantRole; roleName: string; roleIcon: string; abilities: ValorantAbility[] };
const roleIds: Record<string, ValorantRole> = { "dbe8757e-9e92-4ed4-b39f-9dfc589691d4": "Duelist", "4ee40330-ecdd-4f2f-98a8-eb1243428373": "Controller", "1b47567f-8f7b-444b-aae3-b0c634622d10": "Initiator", "5fc02f99-4091-4486-a531-98459a3e95e9": "Sentinel" };
export function parseValorantAgents(raw: unknown): ValorantAgent[] {
  const seen = new Set<string>();
  const agents = list(raw, 120).flatMap(value => {
    const v = row(value), id = uuid(v.uuid), r = row(v.role), role = roleIds[uuid(r.uuid)];
    if (!id || seen.has(id) || v.isPlayableCharacter !== true || !role || !text(v.displayName)) return [];
    seen.add(id);
    const color = Array.isArray(v.backgroundGradientColors) ? text(v.backgroundGradientColors[0]) : "";
    const abilities = (Array.isArray(v.abilities) ? v.abilities.slice(0, 12) : []).flatMap(value => { const a = row(value); return text(a.displayName) ? [{ slot: text(a.slot), name: text(a.displayName), description: text(a.description, 2500), icon: valorantMedia(a.displayIcon) }] : []; });
    return [{ id, name: text(v.displayName), description: text(v.description, 1200), icon: valorantMedia(v.displayIcon), portrait: valorantMedia(v.fullPortraitV2) || valorantMedia(v.fullPortrait), background: valorantMedia(v.background), color: /^[\da-f]{8}$/i.test(color) ? `#${color.slice(0, 6)}` : "#777777", role, roleName: text(r.displayName), roleIcon: valorantMedia(r.displayIcon), abilities }];
  });
  if (!agents.length) throw Error("VALORANT agents unavailable");
  return agents;
}
export type ValorantMap = { id: string; name: string; image: string; thumbnail: string; minimap: string; description: string; callouts: { name: string; x: number; y: number }[] };
export function parseValorantMaps(raw: unknown): ValorantMap[] {
  const seen = new Set<string>();
  return list(raw, 100).flatMap(value => {
    const v = row(value), id = uuid(v.uuid);
    // The tactical atlas requires a real minimap; Range/temporary arenas lack one.
    if (!id || seen.has(id) || !text(v.displayName) || !valorantMedia(v.displayIcon)) return [];
    seen.add(id);
    const callouts = (Array.isArray(v.callouts) ? v.callouts.slice(0, 100) : []).flatMap(value => {
      const c = row(value), point = row(c.location), name = `${text(c.superRegionName)} ${text(c.regionName)}`.trim();
      // Game world X/Y axes are transposed in the provider's minimap transform.
      const x = Number(point.y) * Number(v.xMultiplier) + Number(v.xScalarToAdd), y = Number(point.x) * Number(v.yMultiplier) + Number(v.yScalarToAdd);
      return name && Number.isFinite(x) && Number.isFinite(y) && x >= 0 && x <= 1 && y >= 0 && y <= 1 ? [{ name, x, y }] : [];
    });
    return [{ id, name: text(v.displayName), image: valorantMedia(v.splash), thumbnail: valorantMedia(v.listViewIcon), minimap: valorantMedia(v.displayIcon), description: text(v.narrativeDescription, 1200), callouts }];
  }).sort((a, b) => a.name.localeCompare(b.name));
}
export type ValorantWeapon = { id: string; name: string; image: string; category: string; cost: number; magazine: number; fireRate: number; reload: number; damage: { min: number; max: number; head: number; body: number; legs: number }[] };
export function parseValorantWeapons(raw: unknown): ValorantWeapon[] {
  return list(raw, 60).flatMap(value => {
    const v = row(value), stats = row(v.weaponStats), shop = row(v.shopData), id = uuid(v.uuid);
    const cost = number(shop.cost, 20000), magazine = number(stats.magazineSize, 500), fireRate = number(stats.fireRate, 100), reload = number(stats.reloadTimeSeconds, 30);
    if (!id || !text(v.displayName) || cost === undefined || magazine === undefined || fireRate === undefined || reload === undefined) return [];
    const damage = (Array.isArray(stats.damageRanges) ? stats.damageRanges.slice(0, 10) : []).flatMap(value => {
      const d = row(value), min = number(d.rangeStartMeters, 1000), max = number(d.rangeEndMeters, 1000), head = number(d.headDamage, 2000), body = number(d.bodyDamage, 2000), legs = number(d.legDamage, 2000);
      return min !== undefined && max !== undefined && max > min && head !== undefined && body !== undefined && legs !== undefined ? [{ min, max, head, body, legs }] : [];
    });
    return [{ id, name: text(v.displayName), image: valorantMedia(v.displayIcon), category: text(shop.categoryText), cost, magazine, fireRate, reload, damage }];
  }).sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name));
}
export type ValorantStat = { id: string; games: number; win: number; pick: number; kd?: number };
export type ValorantOption = { value: string; label: string; icon: string };
export type ValorantMeta = { patch: string; tier: string; map: string; ranks: ValorantOption[]; maps: ValorantOption[]; rows: ValorantStat[]; videos: Record<string, Record<string, string>> };
export type ValorantFilters = { tier: string; map: string };
export function valorantMetaUrl(filters: ValorantFilters) {
  const params = new URLSearchParams({ queueId: "competitive" });
  if (filters.tier && /^[a-z_]{1,24}$/.test(filters.tier)) params.set("tier", filters.tier);
  if (filters.map && /^[\p{L} \d-]{1,40}$/u.test(filters.map)) params.set("map", filters.map);
  return `${VALORANT_META}?${params}`;
}
/** Read public server-rendered data as JSON only. Never execute provider scripts. */
export function parseValorantMeta(html: unknown, expected: ValorantFilters): ValorantMeta {
  if (typeof html !== "string" || html.length > 4_000_000) throw Error("Invalid VALORANT meta page");
  let flight = "";
  for (const match of html.matchAll(/self\.__next_f\.push\((\[[\s\S]*?\])\)<\/script>/g)) {
    try { const item = JSON.parse(match[1]); if (item[0] === 1 && typeof item[1] === "string") flight += item[1]; } catch { /* Unrelated bootstrap chunk. */ }
  }
  let filters: Row | undefined, stats: Row | undefined;
  const visit = (value: unknown, depth = 0) => {
    if (!value || typeof value !== "object" || depth > 35) return;
    const v = row(value);
    if (Array.isArray(v.tierOptions) && v.queueId === "competitive") filters = v;
    if (Array.isArray(v.data) && Array.isArray(v.characters) && number(v.totalGameCount) !== undefined) stats = v;
    for (const child of Object.values(value)) visit(child, depth + 1);
  };
  for (const line of flight.split("\n")) {
    const json = line.slice(line.indexOf(":") + 1);
    if (!json.startsWith("[")) continue;
    try { visit(JSON.parse(json)); } catch { /* Text/import frames are not JSON trees. */ }
  }
  if (!filters || !stats || filters.tier !== expected.tier || filters.mapName !== expected.map || !/^\d{1,2}\.\d{1,2}$/.test(text(filters.version))) throw Error("VALORANT meta scope unavailable");
  const total = number(stats.totalGameCount)!;
  const seen = new Set<string>(), rows: ValorantStat[] = [];
  for (const value of (stats.data as unknown[]).slice(0, 120)) {
    const v = row(value), id = uuid(v.characterId), games = number(v.gameCount), wins = number(v.wins), kills = number(v.kills), deaths = number(v.deaths);
    if (!id || seen.has(id) || games === undefined || !games || wins === undefined || wins > games || games > total) continue;
    seen.add(id); rows.push({ id, games, win: wins / games * 100, pick: games / total * 100, kd: kills !== undefined && deaths ? kills / deaths : undefined });
  }
  if (total > 0 && !rows.length) throw Error("VALORANT meta records unavailable");
  const options = (value: unknown): ValorantOption[] => Array.isArray(value) ? value.slice(0, 60).flatMap(item => { const v = row(item); return text(v.label) && typeof v.value === "string" ? [{ value: text(v.value, 40), label: text(v.label, 40), icon: valorantMedia(v.icon) }] : []; }) : [];
  const videos: ValorantMeta["videos"] = {};
  for (const value of (stats.characters as unknown[]).slice(0, 120)) { const c = row(value), id = uuid(c.characterId); if (id && Array.isArray(c.abilities)) videos[id] = Object.fromEntries(c.abilities.slice(0, 12).map(value => { const a = row(value); return [text(a.slot), valorantMedia(a.videoUrl, true)]; })); }
  return { patch: text(filters.version), tier: expected.tier, map: expected.map, ranks: options(filters.tierOptions), maps: options(filters.mapOptions), rows, videos };
}
export function rankValorantAgents(agents: ValorantAgent[], meta: ValorantMeta | null, role: string, query: string, sort: string) {
  const needle = query.normalize("NFKC").trim().toLocaleLowerCase(), stats = new Map(meta?.rows.map(s => [s.id, s]) ?? []);
  return agents.filter(a => (!role || a.role === role) && a.name.toLocaleLowerCase().includes(needle)).map(agent => ({ agent, stats: stats.get(agent.id) })).sort((a, b) => {
    // A tiny sample cannot take the top spot over a well-observed agent.
    const aEnough = !!a.stats && a.stats.games >= 200, bEnough = !!b.stats && b.stats.games >= 200;
    return Number(bEnough) - Number(aEnough) || (aEnough && bEnough ? (sort === "pick" ? b.stats!.pick - a.stats!.pick : b.stats!.win - a.stats!.win) : 0) || a.agent.name.localeCompare(b.agent.name);
  });
}
