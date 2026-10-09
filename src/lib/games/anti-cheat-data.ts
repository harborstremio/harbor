import { plainGameText } from "./steam-data";

/** Attributed reports, never permission to attach an overlay. */
export type GameAntiCheat = {
  status: "reported" | "unknown";
  systems: string[];
  kernel: boolean | null;
  sourceUrl?: string;
  sourceName?: string;
};
export const UNKNOWN_ANTI_CHEAT: GameAntiCheat = { status: "unknown", systems: [], kernel: null };

export function parseSteamAntiCheat(html: string, appId: number): GameAntiCheat {
  if (!Number.isSafeInteger(appId) || appId <= 0 || html.length > 2 * 1024 * 1024) throw Error("Invalid anti-cheat response");
  const canonical = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']+)["']/i)?.[1];
  if (!canonical || !new RegExp(`^https://store\\.steampowered\\.com/app/${appId}(?:/|[?#]|$)`).test(canonical)) throw Error("Anti-cheat identity unavailable");
  const systems: string[] = [];
  let kernel: boolean | null = null;
  // Deliberately restrict matching to Valve's declaration; reviews, news and
  // recommended games may discuss an entirely different anti-cheat system.
  const block = html.match(/<div\b[^>]*class=["'][^"']*\banticheat_section\b[^"']*["'][^>]*>([\s\S]{0,6000}?)(?=<div\b[^>]*class=["'][^"']*(?:game_area_details_specs|DRM_notice)|<\/div>\s*<\/div>)/i)?.[1];
  if (block) {
    const name = plainGameText(block.match(/<div\b[^>]*class=["'][^"']*\banticheat_name\b[^"']*["'][^>]*>([\s\S]*?)(?:<span\b|<\/div>|$)/i)?.[1] ?? "").trim().slice(0, 160);
    if (name) systems.push(name);
    if (/Uses Kernel Level Anti-Cheat/i.test(plainGameText(block))) kernel = true;
  }
  if (/href=["']https?:\/\/store\.steampowered\.com\/search\/\?[^"']*category2=8(?:&(?:amp;)?[^"']*)?["']/i.test(html)
    || /class=["'](?:[^"']*\s)?label["'][^>]*>\s*Valve Anti-Cheat enabled\s*<\//i.test(html)) {
    if (!systems.some(name => /\bVAC\b|Valve Anti-Cheat/i.test(name))) systems.push("Valve Anti-Cheat (VAC)");
  }
  return { status: systems.length ? "reported" : "unknown", systems, kernel, sourceUrl: `https://store.steampowered.com/app/${appId}/?l=english`, sourceName: "Steam" };
}

export const COMMUNITY_ANTI_CHEAT_URL = "https://raw.githubusercontent.com/AreWeAntiCheatYet/AreWeAntiCheatYet/master/games.json";
const COMMUNITY_SOURCE_URL = "https://github.com/AreWeAntiCheatYet/AreWeAntiCheatYet/blob/master/games.json";

/** Match the actual Steam ID, never a similar title or third-party tournament client. */
export function parseCommunityAntiCheat(raw: unknown): Map<number, GameAntiCheat> {
  if (!Array.isArray(raw) || !raw.length || raw.length > 20_000) throw Error("Invalid anti-cheat directory");
  const games = new Map<number, GameAntiCheat>(), seen = new Set<number>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const id = item.storeIds?.steam;
    if (typeof id !== "string" || !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) continue;
    const appId = Number(id);
    // The directory occasionally assigns one ID to conflicting entries. Do not guess.
    if (seen.has(appId)) { games.delete(appId); continue; }
    seen.add(appId);
    if (!Array.isArray(item.anticheats) || item.anticheats.length > 16) continue;
    const systems: string[] = [];
    for (const value of item.anticheats) {
      if (typeof value !== "string") continue;
      const name = value.trim();
      if (!name || name.length > 100 || /[<>\u0000-\u001f]/.test(name) || /^(?:none|unknown|n\/a)$/i.test(name)) continue;
      if (!systems.some(system => system.toLowerCase() === name.toLowerCase())) systems.push(name);
    }
    if (systems.length) games.set(appId, { status: "reported", systems, kernel: null, sourceName: "AreWeAntiCheatYet", sourceUrl: COMMUNITY_SOURCE_URL });
  }
  return games;
}

export function publisherAntiCheat(name: string): GameAntiCheat | undefined {
  // Exact identities only. This is a display fallback, not a safety allowlist.
  if (["valorant", "league of legends", "teamfight tactics"].includes(name.trim().toLowerCase())) {
    return { status: "reported", systems: ["Riot Vanguard"], kernel: true, sourceName: "Riot Games", sourceUrl: "https://support.riotgames.com/en-us/riot/performance/what-is-vanguard" };
  }
  return undefined;
}

export function antiCheatWithCategories(info: GameAntiCheat, categoryIds: readonly number[]): GameAntiCheat {
  if (!categoryIds.includes(8) || info.systems.some(name => /\bVAC\b|Valve Anti-Cheat/i.test(name))) return info;
  return { ...info, status: "reported", systems: [...info.systems, "Valve Anti-Cheat (VAC)"] };
}
