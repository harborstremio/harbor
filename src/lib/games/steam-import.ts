import { gameImage } from "./steam-data";
import type { GameSummary } from "./types";

export const STEAM_IMPORT_LIMIT = 5000;
export const STEAM_PROFILE_BYTES = 4 * 1024 * 1024;
export type SteamImportCandidate = { input: string; appId?: number; name?: string; issue?: "invalid" | "duplicate" | "nonSteam" };
export type SteamImportRow = SteamImportCandidate & { state: "pending" | "existing" | "excluded" | "ready" | "unavailable" | "invalid" | "duplicate" | "nonSteam"; game?: GameSummary; origin?: "store" | "profile" | "manual" };
export const validSteamImportId = (id: number) => Number.isSafeInteger(id) && id > 0 && id <= 0xffffffff;

function appId(value: string): number | undefined {
  const id = /^\d{1,10}$/.test(value) ? Number(value) : NaN;
  return validSteamImportId(id) ? id : undefined;
}
function deduplicate(items: SteamImportCandidate[]): SteamImportCandidate[] {
  if (!items.length) throw Error("steam_import_empty");
  if (items.length > STEAM_IMPORT_LIMIT) throw Error("steam_import_limit");
  const seen = new Set<number>();
  return items.map(item => {
    if (!item.appId || item.issue) return item;
    if (seen.has(item.appId)) return { ...item, issue: "duplicate" };
    seen.add(item.appId); return item;
  });
}
export function parseSteamImportText(text: string): SteamImportCandidate[] {
  if (text.length > 256 * 1024) throw Error("steam_import_limit");
  return deduplicate(text.trim().split(/[\s,;]+/).filter(Boolean).map(input => {
    let id = appId(input);
    if (!id) try {
      const url = new URL(input);
      if (["https:", "http:"].includes(url.protocol) && url.hostname === "store.steampowered.com" && !url.username && !url.password && !url.port) {
        const match = /^\/app\/(\d{1,10})(?:\/[^\s]*)?$/.exec(url.pathname);
        if (match) id = appId(match[1]);
      }
    } catch { /* Each invalid token stays visible in the review. */ }
    return { input, ...(id ? { appId: id } : { issue: "invalid" as const }) };
  }));
}

/** Read only the profile's direct game records. No DTDs, entities, or external resources. */
export function parseSteamImportProfile(text: string): SteamImportCandidate[] {
  if (text.length > STEAM_PROFILE_BYTES || new TextEncoder().encode(text).length > STEAM_PROFILE_BYTES) throw Error("steam_import_limit");
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw Error("steam_import_profile");
  const document = new DOMParser().parseFromString(text, "application/xml"), root = document.documentElement;
  if (document.querySelector("parsererror") || root?.tagName !== "profile" || root.namespaceURI) throw Error("steam_import_profile");
  const groups = [...root.children].filter(node => node.tagName === "games");
  if (groups.length !== 1) throw Error("steam_import_profile");
  const field = (node: Element, name: string) => [...node.children].filter(child => child.tagName === name);
  return deduplicate([...groups[0].children].map(node => {
    const ids = field(node, "id"), names = field(node, "name");
    if (node.tagName !== "game" || ids.length !== 1 || names.length > 1 || ids[0].children.length || names.some(name => name.children.length)) throw Error("steam_import_profile");
    const input = ids[0].textContent?.trim() ?? "", name = names[0]?.textContent?.trim();
    const id = appId(input);
    if (name && (name.length > 300 || /[\x00-\x1f\x7f]/.test(name))) throw Error("steam_import_profile");
    return { input, ...(id ? { appId: id, ...(name ? { name } : {}) } : { issue: /^-\d+$/.test(input) ? "nonSteam" as const : "invalid" as const }) };
  }));
}

export function steamImportSummary(id: number, name = `Steam app ${id}`, capsule = "", platforms: string[] = []): GameSummary {
  if (!validSteamImportId(id) || !name.trim() || name.length > 300 || /[\x00-\x1f\x7f]/.test(name)) throw Error("steam_import_record");
  return { id: `steam:${id}`, steamId: id, name: name.trim(), capsule: gameImage(capsule), platforms: platforms.filter(value => ["Windows", "macOS", "Linux"].includes(value)) };
}
export function parseSteamImportMetadata(value: unknown, id: number): GameSummary {
  const response = (value as Record<string, { success?: unknown; data?: { steam_appid?: unknown; name?: unknown; header_image?: unknown; platforms?: Record<string, unknown> } }> | null)?.[id], data = response?.data;
  if (response?.success !== true || !data || data.steam_appid !== id || typeof data.name !== "string") throw Error("steam_import_metadata");
  return steamImportSummary(id, data.name, typeof data.header_image === "string" ? data.header_image : "", [data.platforms?.windows === true ? "Windows" : "", data.platforms?.mac === true ? "macOS" : "", data.platforms?.linux === true ? "Linux" : ""]);
}
export function initialSteamImportRows(items: SteamImportCandidate[], existing: ReadonlySet<number>, excluded: ReadonlySet<number> = new Set()): SteamImportRow[] {
  return items.map(item => {
    const state = item.issue ?? (existing.has(item.appId!) ? "existing" : excluded.has(item.appId!) ? "excluded" : item.name ? "ready" : "pending");
    return { ...item, state, ...(state === "ready" ? { game: steamImportSummary(item.appId!, item.name), origin: "profile" as const } : {}) };
  });
}
function pause(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, ms);
    signal.addEventListener("abort", abort, { once: true });
  });
}
/** Sequential metadata checks leave each failure reviewable; cancellation never commits records. */
export async function reviewSteamImports(items: SteamImportCandidate[], existing: ReadonlySet<number>, lookup: (id: number, signal: AbortSignal) => Promise<GameSummary>, signal: AbortSignal, progress: (index: number, row: SteamImportRow) => void, wait = pause, excluded: ReadonlySet<number> = new Set()) {
  const rows = initialSteamImportRows(items, existing, excluded); let requests = 0;
  for (let index = 0; index < rows.length; index++) {
    signal.throwIfAborted(); const row = rows[index]; if (row.state !== "pending") continue;
      if (requests++) await wait(1200, signal);
      signal.throwIfAborted();
      try {
        const game = await lookup(row.appId!, signal); signal.throwIfAborted();
        if (game.steamId !== row.appId || game.id !== `steam:${row.appId}`) throw Error("steam_import_metadata");
        rows[index] = { ...row, state: "ready", game: steamImportSummary(row.appId!, game.name, game.capsule, game.platforms), origin: "store" };
      } catch (reason) { signal.throwIfAborted(); rows[index] = { ...row, state: "unavailable", origin: "manual" }; }
    signal.throwIfAborted(); progress(index, rows[index]);
  }
  return rows;
}
