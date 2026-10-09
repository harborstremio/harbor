import { invoke, isTauri } from "@tauri-apps/api/core";
import { GameRequestPool } from "./request-pool";

export const MINECRAFT_CONTENT = ["modpack", "mod", "resourcepack", "shader"] as const;
export type MinecraftContent = typeof MINECRAFT_CONTENT[number];
export type MinecraftCatalogQuery = { kind: "search" | "project" | "versions" | "version" | "categories" | "games"; type?: MinecraftContent; query?: string; loader?: string; game?: string; category?: string; offset?: number; sort?: string };
export type MinecraftProject = { id: string; slug: string; type: MinecraftContent; title: string; description: string; author: string; icon: string; art: string; downloads: number; followers?: number; categories: string[]; versions: string[]; loaders: string[]; updated: string };
export type MinecraftProjectDetail = MinecraftProject & { body: string; license: string; links: { title: "source" | "issues" | "wiki"; url: string }[]; gallery: { url: string; title: string }[] };
export type MinecraftDependency = { project: string; version: string; filename: string; type: "required" | "optional" | "incompatible" | "embedded" };
export type MinecraftVersion = { id: string; number: string; name: string; type: string; date: string; games: string[]; loaders: string[]; bytes: number; filename: string; dependencies: number; dependencyRefs: MinecraftDependency[]; dependencyCount: number };
const ID = /^[a-zA-Z0-9_-]{1,100}$/;
const LOADER = ["fabric", "forge", "neoforge", "quilt", "iris", "optifine", "canvas", "minecraft"];
// Search labels also include legacy and server loaders, even when Harbor does
// not offer them as install/filter targets. Preserve that compatibility data.
const CATALOG_LOADERS = new Set([...LOADER, "babric", "bta-babric", "bukkit", "bungeecord", "datapack", "folia", "geyser", "java-agent", "legacy-fabric", "liteloader", "modloader", "nilloader", "ornithe", "paper", "purpur", "rift", "spigot", "sponge", "velocity", "waterfall"]);
const SORTS = ["relevance", "downloads", "updated", "newest"];
const object = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown, limit = 500) => typeof v === "string" ? v.slice(0, limit) : "";
const list = (v: unknown, limit = 100) => Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && s.length <= 100).slice(0, limit) : [];
const number = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : 0;
export function minecraftLink(value: unknown) {
  try { const url = new URL(text(value, 2000)); return url.protocol === "https:" && !url.username && !url.password && !url.port ? url.href : ""; } catch { return ""; }
}
export function minecraftArt(value: unknown) { const link = minecraftLink(value); return link && new URL(link).hostname === "cdn.modrinth.com" ? link : ""; }
export function minecraftCatalogUrl(params: MinecraftCatalogQuery) {
  const { kind, type = "modpack", query = "", loader = "", game = "", category = "", offset = 0, sort = "downloads" } = params;
  if (!MINECRAFT_CONTENT.includes(type) || query.length > 200 || !Number.isInteger(offset) || offset < 0 || offset > 10000 || !SORTS.includes(sort) || loader && !LOADER.includes(loader) || game && !/^[a-zA-Z0-9._ -]{1,60}$/.test(game) || category && !/^[a-z0-9-]{1,60}$/.test(category)) throw Error("mods_request");
  if (!["search", "project", "versions", "version", "categories", "games"].includes(kind)) throw Error("mods_request");
  if ((kind === "project" || kind === "versions" || kind === "version") && !ID.test(query)) throw Error("mods_request");
  const path = kind === "search" ? "search" : kind === "categories" ? "tag/category" : kind === "games" ? "tag/game_version" : kind === "version" ? `version/${query}` : `project/${query}${kind === "versions" ? "/version" : ""}`;
  const url = new URL(`https://api.modrinth.com/v2/${path}`);
  if (kind === "search") {
    const facets = [[`project_type:${type}`]];
    if (loader) facets.push([`categories:${loader}`]); if (game) facets.push([`versions:${game}`]); if (category) facets.push([`categories:${category}`]);
    Object.entries({ query, facets: JSON.stringify(facets), index: sort, offset: String(offset), limit: "24" }).forEach(([key, value]) => url.searchParams.set(key, value));
  }
  if (kind === "versions") { if (loader) url.searchParams.set("loaders", JSON.stringify([loader])); if (game) url.searchParams.set("game_versions", JSON.stringify([game])); url.searchParams.set("include_changelog", "false"); }
  return url;
}
const pool = new GameRequestPool(3), cache = new Map<string, { at: number; value: unknown }>();
export async function minecraftCatalogRequest(params: MinecraftCatalogQuery, signal: AbortSignal, refresh = false): Promise<unknown> {
  const url = minecraftCatalogUrl(params), cached = cache.get(url.href); signal.throwIfAborted();
  if (!refresh && cached && Date.now() - cached.at < 300_000) return cached.value;
  return pool.run(async () => {
    signal.throwIfAborted(); let value: unknown;
    if (isTauri()) value = await invoke("games_minecraft_catalog", { args: params });
    else {
      const response = await fetch(url, { signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) });
      if (!response.ok) throw Error(response.status === 429 ? "mods_rate_limit" : "mods_network");
      const reader = response.body?.getReader(); if (!reader) throw Error("mods_network");
      const chunks: Uint8Array[] = []; let size = 0;
      try { for (;;) { const item = await reader.read(); if (item.done) break; size += item.value.length; if (size > 4 * 1024 * 1024) throw Error("mods_metadata"); chunks.push(item.value); } }
      finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
      const bytes = new Uint8Array(size); let at = 0; for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; } value = JSON.parse(new TextDecoder().decode(bytes));
    }
    signal.throwIfAborted(); cache.set(url.href, { at: Date.now(), value }); if (cache.size > 80) cache.delete(cache.keys().next().value!); return value;
  }, signal);
}
function project(value: unknown): MinecraftProject | null {
  const p = object(value), id = text(p.project_id ?? p.id, 100), type = p.project_type as MinecraftContent;
  if (!ID.test(id) || !MINECRAFT_CONTENT.includes(type) || !text(p.title)) return null;
  const gallery = Array.isArray(p.gallery) ? p.gallery.map(v => minecraftArt(typeof v === "string" ? v : object(v).url)).filter(Boolean) : [];
  // Search embeds loaders in categories and calls followers "follows". Detail
  // responses use explicit fields; their `versions` are release IDs, not game versions.
  const loaders = [...new Set([...list(p.loaders, 30), ...[...list(p.categories), ...list(p.display_categories)].filter(v => CATALOG_LOADERS.has(v))])];
  const followers = p.followers ?? p.follows;
  return { id, slug: text(p.slug, 100), type, title: text(p.title, 200), description: text(p.description, 1500), author: text(p.author, 100), icon: minecraftArt(p.icon_url), art: minecraftArt(p.featured_gallery) || gallery[0] || "", downloads: number(p.downloads), ...(typeof followers === "number" && Number.isSafeInteger(followers) && followers >= 0 ? { followers } : {}), categories: list(p.display_categories ?? p.categories, 12).filter(v => !loaders.includes(v)), versions: minecraftCatalogVersions(list(p.game_versions ?? (p.project_id ? p.versions : []), 5000)).slice(0, 1000), loaders, updated: text(p.date_modified ?? p.updated, 40) };
}
/** Exact supported releases, newest stable first; never imply a continuous range. */
export function minecraftCatalogVersions(versions: readonly string[], preferred = "") {
  const stable = (value: string) => /^\d+(?:\.\d+){1,3}$/.test(value);
  return [...new Set(versions)].sort((a, b) => Number(b === preferred) - Number(a === preferred) || Number(stable(b)) - Number(stable(a)) || b.localeCompare(a, "en", { numeric: true }));
}
export function minecraftProjects(value: unknown) {
  const data = object(value); if (!Array.isArray(data.hits) || typeof data.total_hits !== "number") throw Error("mods_metadata");
  return { hits: data.hits.slice(0, 24).map(project).filter((v): v is MinecraftProject => !!v), total: number(data.total_hits) };
}
export function minecraftProject(value: unknown): MinecraftProjectDetail {
  const p = object(value), base = project(p); if (!base) throw Error("mods_metadata");
  const gallery = Array.isArray(p.gallery) ? p.gallery.map(object).filter(v => minecraftArt(v.raw_url) || minecraftArt(v.url)).sort((a, b) => Number(b.featured === true) - Number(a.featured === true) || number(a.ordering) - number(b.ordering)).slice(0, 24).map(v => ({ url: minecraftArt(v.raw_url) || minecraftArt(v.url), title: text(v.title, 200) })) : [];
  const links = (["source", "issues", "wiki"] as const).map(title => ({ title, url: minecraftLink(p[`${title}_url`]) })).filter(v => v.url);
  return { ...base, body: text(p.body, 100_000), license: text(object(p.license).name || object(p.license).id, 160), links, gallery, art: gallery[0]?.url || base.art };
}
export function minecraftVersions(value: unknown): MinecraftVersion[] {
  if (!Array.isArray(value)) throw Error("mods_metadata");
  return value.slice(0, 500).map(object).filter(v => ID.test(text(v.id)) && text(v.version_number)).map(v => {
    const files = Array.isArray(v.files) ? v.files.map(object) : [], primaries = files.filter(v => v.primary === true), primary = primaries.length === 1 ? primaries[0] : primaries.length === 0 && files.length === 1 ? files[0] : {};
    const dependencies = Array.isArray(v.dependencies) ? v.dependencies.map(object).filter(d => ["required", "optional", "incompatible", "embedded"].includes(text(d.dependency_type))) : [];
    const dependencyRefs = dependencies.slice(0, 200).map(d => ({ project: ID.test(text(d.project_id)) ? text(d.project_id) : "", version: ID.test(text(d.version_id)) ? text(d.version_id) : "", filename: text(d.file_name, 200), type: d.dependency_type as MinecraftDependency["type"] }));
    return { id: text(v.id, 100), number: text(v.version_number, 200), name: text(v.name, 200), type: text(v.version_type, 20), date: text(v.date_published, 40), games: [...new Set(list(v.game_versions, 200))], loaders: [...new Set(list(v.loaders, 20))], bytes: number(primary?.size), filename: text(primary?.filename, 200), dependencies: dependencies.filter(d => d.dependency_type === "required").length, dependencyRefs, dependencyCount: dependencies.length };
  }).sort((a,b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
}
export function minecraftPreferredVersion(versions: readonly MinecraftVersion[], selected = "") { return versions.find(v => v.id === selected) ?? versions.find(v => v.type === "release") ?? versions[0] ?? null; }
export type MinecraftReleaseNotes = { id: string; projectId: string; body: string; truncated: boolean };
/** A release ID alone cannot establish which project's notes are being shown. */
export function minecraftReleaseNotes(value: unknown, projectId: string, versionId: string): MinecraftReleaseNotes {
  const data = object(value);
  if (!ID.test(projectId) || !ID.test(versionId) || data.id !== versionId || data.project_id !== projectId || (data.changelog !== null && typeof data.changelog !== "string")) throw Error("mods_metadata");
  const body = typeof data.changelog === "string" ? data.changelog : "";
  return { id: versionId, projectId, body: body.slice(0, 100_000), truncated: body.length > 100_000 };
}
export function minecraftReviewableVersion(version: MinecraftVersion | null) { return !!version && version.bytes > 0 && /\.mrpack$/i.test(version.filename); }
export function minecraftCategories(value: unknown) { if (!Array.isArray(value)) throw Error("mods_metadata"); return value.map(object).filter(v => MINECRAFT_CONTENT.includes(v.project_type as MinecraftContent) && /^[a-z0-9-]{1,60}$/.test(text(v.name))).map(v => ({ type: v.project_type as MinecraftContent, name: text(v.name) })); }
export function minecraftProjectUrl(value: Pick<MinecraftProject, "type" | "id">, version?: string) { return `https://modrinth.com/${value.type}/${value.id}${version && ID.test(version) ? `/version/${version}` : ""}`; }
