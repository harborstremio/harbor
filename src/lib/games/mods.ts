import { invoke, isTauri } from "@tauri-apps/api/core";
import { GameRequestPool } from "./request-pool";

export const MOD_LOADERS = ["fabric", "forge", "neoforge", "quilt"] as const;
export type ModLoader = typeof MOD_LOADERS[number];
export type ModProject = { id: string; slug: string; title: string; description: string; icon: string; downloads: number; author: string; categories: string[] };
export type ModVersion = { id: string; name: string; number: string; type: string; date: string; bytes: number };
export type ModPackage = { project: string; version: string; name: string; number: string; filename: string; url: string; bytes: number; sha512: string; enabled: boolean; dependencies: { project_id: string | null; version_id: string | null; dependency_type: string }[] };
export type ModWorkspace = { schema: number; owner: string; revision: string; loader: ModLoader; gameVersion: string; packages: ModPackage[]; backups?: { package: ModPackage; file: string }[] };
export type ModPlan = { token: string; packages: ModPackage[]; replaced?: ModPackage[]; existing: number; optional: number; bytes: number; loader: string; gameVersion: string };
export type ModProgress = { profile: string; operationId: string; name: string; bytes: number; totalBytes: number };
type Params = { kind: "search" | "games" | "project" | "versions"; query?: string; loader?: string; game?: string; offset?: number; sort?: string };
const pool = new GameRequestPool(2), cache = new Map<string, { at: number; value: unknown }>();
export function modUrl(params: Params) {
  const { kind, query = "", loader = "fabric", game = "", offset = 0, sort = "downloads" } = params;
  if (!MOD_LOADERS.includes(loader as ModLoader) || query.length > 200 || offset < 0 || offset > 10000 || !["relevance", "downloads", "updated", "newest"].includes(sort)) throw Error("mods_request");
  if (["project", "versions"].includes(kind) && !/^[\w-]{1,100}$/.test(query)) throw Error("mods_request");
  const url = new URL(`https://api.modrinth.com/v2/${kind === "search" ? "search" : kind === "games" ? "tag/game_version" : `project/${query}${kind === "versions" ? "/version" : ""}`}`);
  if (kind === "search") { url.searchParams.set("query", query); url.searchParams.set("index", sort); url.searchParams.set("offset", String(offset)); url.searchParams.set("limit", "24"); url.searchParams.set("facets", JSON.stringify([["project_type:mod"], [`categories:${loader}`], [`versions:${game}`]])); }
  if (kind === "versions") { url.searchParams.set("loaders", JSON.stringify([loader])); url.searchParams.set("game_versions", JSON.stringify([game])); url.searchParams.set("include_changelog", "false"); }
  return url;
}
export async function modRequest(params: Params, signal: AbortSignal): Promise<unknown> {
  const url = modUrl(params), key = url.href, held = cache.get(key); signal.throwIfAborted();
  if (held && Date.now() - held.at < 5 * 60_000) return held.value;
  return pool.run(async () => {
    let value: unknown;
    if (isTauri()) value = await invoke("games_modrinth", { query: "", loader: "fabric", game: "", offset: 0, sort: "downloads", ...params });
    else {
      const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]), headers: { "User-Agent": "Harbor-Games/0.9 (https://harbor.site)" } });
      if (!response.ok) throw Error(response.status === 429 ? "mods_rate_limit" : "mods_network");
      const reader = response.body?.getReader(); if (!reader) throw Error("mods_network");
      const chunks: Uint8Array[] = []; let bytes = 0;
      try { for (;;) { const part = await reader.read(); if (part.done) break; bytes += part.value.length; if (bytes > 4 * 1024 * 1024) throw Error("mods_metadata"); chunks.push(part.value); } } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      const combined = new Uint8Array(bytes); let offset = 0; for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.length; } value = JSON.parse(new TextDecoder().decode(combined));
    }
    signal.throwIfAborted(); cache.set(key, { at: Date.now(), value }); if (cache.size > 60) cache.delete(cache.keys().next().value!); return value;
  }, signal);
}
const obj = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const str = (v: unknown, max = 500) => typeof v === "string" ? v.slice(0, max) : "";
const number = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : 0;
export function modIcon(value: unknown) { try { const url = new URL(str(value, 2000)); return url.protocol === "https:" && url.hostname === "cdn.modrinth.com" && !url.username && !url.password ? url.href : ""; } catch { return ""; } }
export function parseModProjects(value: unknown): { hits: ModProject[]; total: number } {
  const data = obj(value); if (!Array.isArray(data.hits)) throw Error("mods_metadata");
  const hits = data.hits.slice(0, 24).map(v => { const p = obj(v); return { id: str(p.project_id, 100), slug: str(p.slug, 100), title: str(p.title, 200), description: str(p.description), icon: modIcon(p.icon_url), downloads: number(p.downloads), author: str(p.author, 100), categories: Array.isArray(p.categories) ? p.categories.filter(v => typeof v === "string").slice(0, 5) as string[] : [] }; }).filter(p => /^[\w-]+$/.test(p.id) && /^[\w-]+$/.test(p.slug) && p.title);
  return { hits, total: number(data.total_hits) };
}
export function parseModProject(value: unknown, expectedId: string): ModProject {
  const project = obj(value);
  if (project.id !== expectedId || project.project_type !== "mod") throw Error("mods_metadata");
  const parsed = parseModProjects({ hits: [{ ...project, project_id: project.id }] }).hits[0];
  if (!parsed) throw Error("mods_metadata");
  return parsed;
}
export function parseModVersions(value: unknown): ModVersion[] {
  if (!Array.isArray(value)) throw Error("mods_metadata");
  return value.slice(0, 300).map(v => { const p = obj(v), files = Array.isArray(p.files) ? p.files.map(obj) : [], file = files.find(v => v.primary) ?? (files.length === 1 ? files[0] : {}); return { id: str(p.id, 100), name: str(p.name, 300), number: str(p.version_number, 200), type: str(p.version_type, 20), date: str(p.date_published, 50), bytes: number(file?.size) }; }).filter(v => /^[\w-]+$/.test(v.id) && v.bytes > 0);
}
export function parseModGames(value: unknown): string[] { if (!Array.isArray(value)) throw Error("mods_metadata"); return value.map(obj).filter(v => v.version_type === "release").map(v => str(v.version, 60)).filter(v => /^[\w. -]+$/.test(v)).slice(0, 150); }
const errors = new Set(["profile", "request", "environment", "network", "rate_limit", "metadata", "incompatible", "dependency", "folder", "record", "write", "changed", "exists", "missing", "required", "busy", "canceled", "timeout", "conflict", "limit", "installed", "expired", "space", "download", "integrity", "embedded_conflict", "embedded_dependency", "embedded_metadata", "loader_support"]);
export function modError(error: unknown) { const code = String(error instanceof Error ? error.message : error).replace(/^mods_/, ""); if (code === "instance_running") return "games.minecraft.content.running"; return `games.mods.error.${errors.has(code) ? code : "network"}`; }
export type ModFolder = { path: string; loader: ModLoader; game: string };
export function modFolders(profile: string): ModFolder[] { try { const value: unknown = JSON.parse(localStorage.getItem(`harbor:game-mod-folders:${profile}`) ?? "[]"); return Array.isArray(value) ? value.map(obj).filter(v => typeof v.path === "string" && v.path.length <= 4096 && MOD_LOADERS.includes(v.loader as ModLoader) && typeof v.game === "string" && v.game.length <= 60).slice(0, 20) as ModFolder[] : []; } catch { return []; } }
export function saveModFolder(profile: string, folder: ModFolder) { const next = [folder, ...modFolders(profile).filter(v => v.path !== folder.path)].slice(0, 20); localStorage.setItem(`harbor:game-mod-folders:${profile}`, JSON.stringify(next)); return next; }
