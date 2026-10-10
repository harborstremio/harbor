export type TftChampion = { id: string; name: string; cost: number; code: number; portrait: string; icon: string; traits: { id: string; amount: number }[] };
export type TftLevel = { min: number; max?: number; values: Record<string, number> };
export type TftTrait = { id: string; name: string; icon: string; text: string; innate: Record<string, number>; levels: TftLevel[] };
export type TftSet = { id: string; name: string; champions: TftChampion[]; traits: TftTrait[] };
export type TftCatalog = { version: string; locale: string; defaultSet: string; sets: TftSet[] };
export type TftTeam = { id: string; name: string; units: string[] };
export type TftPlans = { draft: string[]; teams: TftTeam[] };
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown, max = 160) => typeof v === "string" ? v.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").trim().slice(0, max) : "";
const id = (v: unknown) => typeof v === "string" && /^[a-zA-Z0-9_]{1,100}$/.test(v) ? v : "";
const setId = (v: unknown) => typeof v === "string" && /^TFTSet\d{1,3}$/.test(v) ? v : "";
const integer = (v: unknown, min: number, max: number) => typeof v === "number" && Number.isInteger(v) && v >= min && v <= max;
export const isTft = (game: { steamId?: number; igdbId?: number }) => !game.steamId && game.igdbId === 120176;
export function tftVersion(raw: unknown): string {
  if (!Array.isArray(raw) || typeof raw[0] !== "string" || !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(raw[0])) throw Error("Invalid TFT data version");
  return raw[0].split(".").slice(0, 2).join(".");
}
export function tftLocale(language: string) {
  return ({ ar: "ar_ae", de: "de_de", es: "es_es", fr: "fr_fr", id: "id_id", it: "it_it", ja: "ja_jp", ko: "ko_kr", pl: "pl_pl", pt: "pt_br", ru: "ru_ru", tr: "tr_tr", vi: "vi_vn", zh: "zh_cn" } as Record<string, string>)[language.split(/[-_]/)[0]] ?? "default";
}
export function tftAsset(path: unknown, version: string): string {
  if (!/^\d{1,3}\.\d{1,3}$/.test(version) || typeof path !== "string" || !/^\/lol-game-data\/assets\/[a-zA-Z0-9_./-]+\.(png|jpg|jpeg|webp)$/i.test(path) || path.includes("..")) return "";
  return `https://raw.communitydragon.org/${version}/plugins/rcp-be-lol-game-data/global/default/${path.slice("/lol-game-data/assets/".length).toLowerCase()}`;
}
function constants(raw: unknown): Record<string, number> {
  const result: Record<string, number> = Object.create(null);
  if (Array.isArray(raw)) for (const item of raw.slice(0, 200)) { const v = object(item); if (id(v.name) && typeof v.value === "number" && Number.isFinite(v.value)) result[String(v.name).toLowerCase()] = v.value; }
  return result;
}
export function parseTftCatalog(setsRaw: unknown, championsRaw: unknown, traitsRaw: unknown, version: string, locale: string): TftCatalog {
  const metadata = object(object(setsRaw).LCTFTModeData), pools = object(championsRaw), defaultSet = setId(object(metadata.mDefaultTeamPlannerSet).SetName);
  if (!defaultSet || !Array.isArray(metadata.mActiveSets) || !Array.isArray(traitsRaw) || traitsRaw.length > 3000) throw Error("Incomplete TFT catalog");
  const sets: TftSet[] = [];
  for (const raw of metadata.mActiveSets) {
    const meta = object(raw), key = setId(meta.SetName), rows = pools[key];
    if (!key || !Array.isArray(rows) || sets.some(s => s.id === key)) continue;
    if (!rows.length || rows.length > 200) throw Error("Invalid TFT roster");
    // Zero is the planner's empty slot; client catalogs also include non-playable NPCs.
    const champions = rows.filter(raw => object(raw).team_planner_code !== 0).map(raw => {
      const c = object(raw), traits = c.traits;
      if (!id(c.character_id) || !text(c.display_name) || !integer(c.tier, 1, 10) || !integer(c.team_planner_code, 1, 4095) || !Array.isArray(traits) || !traits.length || traits.length > 12) throw Error("Invalid TFT champion");
      return { id: String(c.character_id), name: text(c.display_name), cost: c.tier as number, code: c.team_planner_code as number, portrait: tftAsset(c.squareSplashIconPath, version), icon: tftAsset(c.squareIconPath, version), traits: traits.map(raw => { const t = object(raw); if (!id(t.id) || !integer(t.amount, 1, 10)) throw Error("Invalid TFT contribution"); return { id: String(t.id), amount: t.amount as number }; }) };
    });
    if (!champions.length || new Set(champions.map(c => c.id)).size !== champions.length || new Set(champions.map(c => c.code)).size !== champions.length) throw Error("Ambiguous TFT identity");
    const needed = new Set(champions.flatMap(c => c.traits.map(t => t.id)));
    const traits = traitsRaw.filter(raw => object(raw).set === key && needed.has(String(object(raw).trait_id))).map(raw => {
      const t = object(raw); if (!id(t.trait_id) || !text(t.display_name) || !Array.isArray(t.conditional_trait_sets) || t.conditional_trait_sets.length > 30) throw Error("Invalid TFT trait");
      const levels = t.conditional_trait_sets.map(raw => { const level = object(raw); if (!integer(level.min_units, 0, 100) || level.max_units !== undefined && !integer(level.max_units, 0, 100)) throw Error("Invalid TFT threshold"); return { min: level.min_units as number, max: level.max_units as number | undefined, values: constants(level.constants) }; });
      return { id: String(t.trait_id), name: text(t.display_name), icon: tftAsset(t.icon_path, version), text: typeof t.tooltip_text === "string" ? t.tooltip_text.slice(0, 20000) : "", innate: Object.assign(Object.create(null), ...(Array.isArray(t.innate_trait_sets) ? t.innate_trait_sets.map(v => constants(object(v).constants)) : [])), levels };
    });
    if (new Set(traits.map(t => t.id)).size !== needed.size || traits.length !== needed.size) throw Error("Missing TFT trait references");
    sets.push({ id: key, name: text(meta.SetDisplayName) || key, champions, traits });
  }
  if (!sets.some(s => s.id === defaultSet)) throw Error("Current TFT set unavailable");
  return { version, locale, defaultSet, sets: sets.sort((a, b) => Number(b.id === defaultSet) - Number(a.id === defaultSet)) };
}
export function tftCounts(set: TftSet, units: string[]) {
  const counts = new Map<string, number>();
  for (const unit of new Set(units)) for (const trait of set.champions.find(c => c.id === unit)?.traits ?? []) counts.set(trait.id, (counts.get(trait.id) ?? 0) + trait.amount);
  return counts;
}
export function tftThresholds(trait: TftTrait) { return [...new Set(trait.levels.filter(l => l.min > 0 && (l.max === undefined || l.max >= l.min)).map(l => l.min))].sort((a, b) => a - b); }
export function encodeTftTeam(set: TftSet, units: string[]): string {
  if (!units.length || units.length > 10 || new Set(units).size !== units.length) throw Error("Invalid team");
  const codes = units.map(id => { const c = set.champions.find(c => c.id === id); if (!c) throw Error("Unknown champion"); return c.code.toString(16).padStart(3, "0"); });
  return `02${codes.join("").padEnd(30, "0")}${set.id}`;
}
export function decodeTftTeam(code: string, catalog: TftCatalog): { set: TftSet; units: string[] } {
  const match = /^02([0-9a-fA-F]{30})(TFTSet\d{1,3})$/.exec(code.trim());
  if (!match) throw Error("Invalid team code");
  const set = catalog.sets.find(s => s.id === match[2]); if (!set) throw Error("Unavailable set");
  const units: string[] = [];
  for (const value of match[1].match(/.{3}/g)!) { const code = parseInt(value, 16); if (!code) continue; const c = set.champions.find(c => c.code === code); if (!c || units.includes(c.id)) throw Error("Unknown or repeated champion"); units.push(c.id); }
  if (!units.length) throw Error("Empty team");
  return { set, units };
}
/** Render client reference text as plain text; runtime substitutions remain explicitly unknown. */
export function tftTraitReference(trait: TftTrait, count: number, stat: (key: string) => string) {
  let unresolved = false;
  const render = (value: string, values: Record<string, number>) => value.replace(/@([^@]+)@/g, (_, expression: string) => {
    const match = /^([a-zA-Z0-9_]+)(?:([*/])(\d+(?:\.\d+)?))?$/.exec(expression), base = match ? values[match[1].toLowerCase()] : undefined;
    if (base === undefined || match?.[2] === "/" && Number(match[3]) === 0) { unresolved = true; return "—"; }
    const number = match?.[2] === "*" ? base * Number(match[3]) : match?.[2] === "/" ? base / Number(match[3]) : base;
    return String(Math.round(number * 1000) / 1000);
  }).replace(/%i:([a-zA-Z0-9_]+)%/g, (_, key: string) => { const label = stat(key); if (!label) unresolved = true; return ` ${label || "—"} `; }).replace(/<br\s*\/?\s*>/gi, "\n").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  const active = [...trait.levels].reverse().find(l => count >= l.min && (l.max === undefined || count <= l.max)) ?? trait.levels[0];
  const rows = [...trait.text.matchAll(/<(?:row|expandRow)>([\s\S]*?)<\/(?:row|expandRow)>/gi)];
  const intro = render(trait.text.replace(/<(?:row|expandRow)>[\s\S]*?<\/(?:row|expandRow)>/gi, ""), { ...trait.innate, ...active?.values });
  const levels = trait.levels.map((l, i) => ({ min: l.min, text: render(rows.length === trait.levels.length ? rows[i][1] : rows.length === 1 && /<expandRow>/i.test(trait.text) ? rows[0][1] : "", { ...trait.innate, ...l.values, minunits: l.min, maxunits: l.max ?? l.min }) }));
  return { intro, levels, unresolved };
}
export const tftPlanKey = (profile: string, set: string) => `harbor.games.tft.teams:${encodeURIComponent(profile)}:${set}`;
export function parseTftPlans(raw: unknown): TftPlans {
  const v = object(raw), units = (u: unknown): string[] => Array.isArray(u) && u.length <= 10 && u.every(x => id(x)) && new Set(u).size === u.length ? u as string[] : [];
  return { draft: units(v.draft), teams: Array.isArray(v.teams) ? v.teams.slice(0, 20).flatMap(raw => { const t = object(raw); return id(t.id) && text(t.name, 60) ? [{ id: String(t.id), name: text(t.name, 60), units: units(t.units) }] : []; }).filter((t, i, a) => a.findIndex(x => x.id === t.id) === i) : [] };
}
export function readTftPlans(profile: string, set: string): TftPlans { try { const raw = localStorage.getItem(tftPlanKey(profile, set)); return raw && raw.length <= 50000 ? parseTftPlans(JSON.parse(raw)) : { draft: [], teams: [] }; } catch { return { draft: [], teams: [] }; } }
