import type { GameSummary } from "./types";

export const LEAGUE_ROLES = ["top", "jungle", "mid", "adc", "support"] as const;
export type LeagueRole = typeof LEAGUE_ROLES[number];
export const DRAGON = "https://ddragon.leagueoflegends.com";
export const LEAGUE_MCP = "https://mcp-api.op.gg/mcp";
export const roleIcon = (role: LeagueRole) => `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-champ-select/global/default/svg/position-${({ top: "top", jungle: "jungle", mid: "middle", adc: "bottom", support: "utility" })[role]}.svg`;
export const isLeague = (game: Pick<GameSummary, "id">) => game.id === "igdb:115" || game.id === "riot:league_of_legends:live";
export const leagueLocale = (language: string) => ({ ar: "ar_AE", de: "de_DE", es: "es_ES", fr: "fr_FR", it: "it_IT", ja: "ja_JP", ko: "ko_KR", pl: "pl_PL", pt: "pt_BR", ru: "ru_RU", tr: "tr_TR", vi: "vi_VN", zh: "zh_CN" } as Record<string, string>)[language] ?? "en_US";
export const leagueKey = (value: unknown) => typeof value === "string" && /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(value) ? value : "";
export const leaguePatch = (value: unknown) => typeof value === "string" && /^\d{1,3}\.\d{1,3}(?:\.\d{1,3})?$/.test(value) ? value : "";
/** Riot's public 2026 patch names differ from the 16.x provider/asset versions. */
export const leagueDisplayPatch = (patch: string) => /^16\.\d+(?:\.\d+)?$/.test(patch) ? `26.${patch.split(".")[1]}` : patch;
export const row = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const list = (value: unknown, max = 500): unknown[] => Array.isArray(value) && value.length <= max ? value : [];
export const leagueText = (value: unknown, max = 2500) => typeof value === "string" ? value.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim().slice(0, max) : "";
const num = (v: unknown, max = 100_000_000) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : null;
const integer = (v: unknown) => num(v) !== null && Number.isInteger(v) ? v as number : null;
const rate = (v: unknown) => num(v, 1);
export const normalizeChampion = (name: string) => name.normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
export type LeagueChampion = { id: number; key: string; name: string; title: string; tags: string[]; difficulty: number; portrait: string; splash: string };
export function parseLeagueCatalog(raw: unknown, patch: string): LeagueChampion[] {
  if (!leaguePatch(patch) || row(raw).version !== patch) throw Error("Mismatched champion patch");
  const values = Object.values(row(row(raw).data));
  if (!values.length || values.length > 300) throw Error("Invalid champion catalog");
  const seen = new Set<number>();
  const result = values.flatMap(value => {
    const item = row(value), key = leagueKey(item.id), id = integer(Number(item.key)), name = leagueText(item.name, 100);
    if (!key || !id || !name || seen.has(id)) return []; seen.add(id);
    return [{ id, key, name, title: leagueText(item.title, 180), tags: list(item.tags, 6).map(v => leagueText(v, 40)), difficulty: num(row(item.info).difficulty, 10) ?? 0, portrait: `${DRAGON}/cdn/${patch}/img/champion/${key}.png`, splash: `${DRAGON}/cdn/img/champion/splash/${key}_0.jpg` }];
  });
  if (!result.length) throw Error("No champions available");
  return result;
}
export type LeagueMeta = { champion: string; role: LeagueRole; tier: number; rank: number; games: number; winRate: number; pickRate: number; banRate: number };
export function parseLeagueMeta(raw: unknown): LeagueMeta[] {
  const positions = row(row(row(raw).data).positions), result: LeagueMeta[] = [];
  for (const role of LEAGUE_ROLES) {
    const seen = new Set<string>();
    for (const entry of list(positions[role], 300)) {
      const item = row(entry), champion = leagueText(item.champion, 100), games = integer(item.play), wins = integer(item.win), tier = integer(item.tier), rank = integer(item.rank), pickRate = rate(item.pick_rate), banRate = rate(item.ban_rate);
      if (!champion || seen.has(champion) || !games || wins === null || wins > games || !tier || tier > 5 || !rank || pickRate === null || banRate === null || item.is_rip === true) continue;
      seen.add(champion); result.push({ champion, role, games, tier, rank, winRate: wins / games, pickRate, banRate });
    }
  }
  if (!result.length) throw Error("Meta unavailable");
  return result;
}
export function matchLeagueChampion(champions: LeagueChampion[], name: string) {
  const normalized = normalizeChampion(name);
  return champions.find(champion => normalizeChampion(champion.name) === normalized || normalizeChampion(champion.key) === normalized || normalizeChampion(leagueApiName(champion)) === normalized);
}
export type LeagueAbility = { key: string; name: string; description: string; image: string; cooldown?: string };
export type LeagueKit = { abilities: LeagueAbility[]; tips: string[]; enemyTips: string[]; lore: string; skins: { num: number; name: string }[] };
export function parseLeagueKit(raw: unknown, champion: LeagueChampion, patch: string): LeagueKit {
  const data = row(row(row(raw).data)[champion.key]);
  if (data.id !== champion.key || row(raw).version !== patch) throw Error("Champion identity mismatch");
  const image = (item: unknown, folder: string) => {
    const file = row(row(item).image).full;
    return typeof file === "string" && /^[A-Za-z0-9_.-]+\.png$/.test(file) ? `${DRAGON}/cdn/${patch}/img/${folder}/${file}` : "";
  };
  const passive = row(data.passive);
  const abilities = [{ key: "P", name: leagueText(passive.name, 100), description: leagueText(passive.description), image: image(passive, "passive") }, ...list(data.spells, 4).map((v, index) => { const s = row(v); return { key: ["Q", "W", "E", "R"][index]!, name: leagueText(s.name, 100), description: leagueText(s.description), image: image(s, "spell"), cooldown: leagueText(s.cooldownBurn, 60) }; })];
  if (abilities.length !== 5 || abilities.some(a => !a.name)) throw Error("Incomplete champion kit");
  return { abilities, lore: leagueText(data.lore, 5000), tips: list(data.allytips, 10).map(v => leagueText(v)), enemyTips: list(data.enemytips, 10).map(v => leagueText(v)), skins: list(data.skins, 100).flatMap(v => { const s = row(v), n = integer(s.num); return n !== null ? [{ num: n, name: leagueText(s.name, 100) }] : []; }) };
}
export type LeagueAssets = Record<number, { name: string; image: string; description: string }>;
export function parseLeagueAssets(raw: unknown, patch: string, kind: "item" | "spell" | "rune"): LeagueAssets {
  const result: LeagueAssets = {};
  const items = kind === "rune" ? list(raw, 10).flatMap(p => list(row(p).slots, 10).flatMap(s => list(row(s).runes, 10))) : Object.entries(row(row(raw).data)).map(([id, item]) => ({ ...row(item), numericId: kind === "item" ? id : row(item).key }));
  for (const v of items) {
    const item = row(v), id = integer(Number(kind === "rune" ? item.id : item.numericId)), name = leagueText(item.name, 100);
    const path = kind === "rune" ? item.icon : row(item.image).full;
    if (!id || !name || typeof path !== "string" || path.includes("..") || !/^[a-zA-Z0-9_/.-]+\.png$/.test(path)) continue;
    result[id] = { name, image: kind === "rune" ? `${DRAGON}/cdn/img/${path}` : `${DRAGON}/cdn/${patch}/img/${kind}/${path}`, description: leagueText(item.plaintext || item.shortDesc || item.description) };
  }
  if (!Object.keys(result).length) throw Error("League icons unavailable");
  return result;
}
export type LeagueBuildGroup = { ids: number[]; games: number; wins: number; pickRate: number | null };
export type LeagueCounter = { id: number; name: string; games: number; winRate: number };
export type LeagueBuild = { patch: string; sourceAt: number; core: LeagueBuildGroup | null; boots: LeagueBuildGroup | null; start: LeagueBuildGroup | null; spells: LeagueBuildGroup | null; runes: LeagueBuildGroup | null; skillOrder: string[]; skillMax: string[]; strong: LeagueCounter[]; weak: LeagueCounter[]; videos: { id: string; name: string }[] };
function buildGroup(raw: unknown, ids?: unknown): LeagueBuildGroup | null {
  const s = row(raw), games = integer(s.play), wins = integer(s.win), keys = list(ids ?? s.ids, 12).map(integer);
  return games && wins !== null && wins <= games && keys.length && keys.every((k): k is number => k !== null && k > 0) ? { ids: keys, games, wins, pickRate: rate(s.pick_rate) } : null;
}
export function parseLeagueBuild(raw: unknown, champion: LeagueChampion, role: LeagueRole): LeagueBuild {
  const root = row(raw), data = row(root.data);
  if (row(data.summary).id !== champion.id || String(root.position).toLowerCase() !== role) throw Error("Build identity mismatch");
  const trends = row(row(data.trends).win), patch = leaguePatch(trends.version), sourceAt = Date.parse(String(trends.created_at));
  const counters = (raw: unknown): LeagueCounter[] => list(raw, 20).flatMap(v => { const c = row(v), id = integer(c.champion_id), games = integer(c.play), winRate = rate(c.my_win_rate); return id && id !== champion.id && games && winRate !== null ? [{ id, name: leagueText(c.champion_name, 100), games, winRate }] : []; });
  const keys = (v: unknown, max: number) => list(v, max).filter((k): k is string => typeof k === "string" && /^[QWER]$/.test(k));
  return { patch, sourceAt: Number.isFinite(sourceAt) ? sourceAt : 0, core: buildGroup(data.core_items), boots: buildGroup(data.boots), start: buildGroup(data.starter_items), spells: buildGroup(data.summoner_spells), runes: buildGroup(data.runes, [...list(row(data.runes).primary_rune_ids, 4), ...list(row(data.runes).secondary_rune_ids, 2)]), skillOrder: keys(row(data.skills).order, 18), skillMax: keys(row(data.skill_masteries).ids, 4), strong: counters(data.strong_counters), weak: counters(data.weak_counters), videos: list(data.skill_combos, 10).flatMap(v => { const s = row(v); try { const u = new URL(String(s.video_url)), id = u.searchParams.get("v"); return u.protocol === "https:" && ["www.youtube.com", "youtube.com"].includes(u.hostname) && u.pathname === "/watch" && id && /^[A-Za-z0-9_-]{11}$/.test(id) ? [{ id, name: leagueText(s.name, 160) }] : []; } catch { return []; } }) };
}
export function leagueApiName(champion: LeagueChampion) {
  const names: Record<string, string> = { MonkeyKing: "WUKONG", Chogath: "CHO_GATH", Kaisa: "KAI_SA", Khazix: "KHA_ZIX", KogMaw: "KOG_MAW", RekSai: "REK_SAI", Velkoz: "VEL_KOZ", Belveth: "BEL_VETH", DrMundo: "DR_MUNDO", JarvanIV: "JARVAN_IV", KSante: "K_SANTE", Nunu: "NUNU_WILLUMP", Renata: "RENATA_GLASC", MissFortune: "MISS_FORTUNE", MasterYi: "MASTER_YI", LeeSin: "LEE_SIN", TwistedFate: "TWISTED_FATE", XinZhao: "XIN_ZHAO", TahmKench: "TAHM_KENCH", AurelionSol: "AURELION_SOL" };
  return names[champion.key] ?? champion.key.toUpperCase();
}
