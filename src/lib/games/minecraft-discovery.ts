import type { MinecraftContent } from "./minecraft-catalog";

export const SERVER_SOURCES = {
  org: { name: "MinecraftServers.org", origin: "https://minecraftservers.org", logo: "https://minecraftservers.org/static/img/logo.svg" },
  mp: { name: "Minecraft-MP", origin: "https://minecraft-mp.com", logo: "https://minecraft-mp.com/images/logo_top.png" },
} as const;
export type ServerSource = keyof typeof SERVER_SOURCES;
export type DiscoveryOption = { value: string; label: string };
export type CurseForgeQuery = { type: MinecraftContent; query: string; category: string; version: string; loader: string; sort: "downloads" | "relevance"; page: number };
export type CurseForgeProject = { id: string; name: string; url: string; icon: string; author: string; description: string; downloads: string; updated: string; version: string; loader: string; categories: string[] };
export type CurseForgePage = { projects: CurseForgeProject[]; next: boolean; categories: DiscoveryOption[]; versions: DiscoveryOption[]; loaders: DiscoveryOption[]; classes?: DiscoveryOption[] };
export type MinecraftServer = { id: string; source: ServerSource; rank: number | null; name: string; address: string; url: string; icon: string; banner: string; description: string; players: number | null; capacity: number | null; online: boolean | null; version: string; tags: string[] };
export type MinecraftServerPage = { servers: MinecraftServer[]; next: string; modes: DiscoveryOption[] };

const classes = { modpack: "modpacks", mod: "mc-mods", resourcepack: "texture-packs", shader: "shaders" };
const clean = (value: string | null | undefined, max = 500) => (value || "").replace(/\s+/g, " ").trim().slice(0, max);
const text = (node: ParentNode, selector: string, max = 500) => clean(node.querySelector(selector)?.textContent, max);
const attr = (node: ParentNode, selector: string, name: string) => node.querySelector(selector)?.getAttribute(name) || "";
const integer = (value: string) => /^\d+$/.test(value.trim()) ? Number(value) : null;
export function discoveryUrl(value: string, base: string, hosts: readonly string[]): string {
  try { const url = new URL(value, base); return value && url.protocol === "https:" && !url.username && !url.password && (!url.port || url.port === "443") && hosts.includes(url.hostname) ? url.href : ""; } catch { return ""; }
}
export function curseForgeUrl(query: CurseForgeQuery): string {
  const url = new URL("https://www.curseforge.com/minecraft/search");
  url.searchParams.set("class", classes[query.type]);
  url.searchParams.set("page", String(Math.max(1, Math.floor(query.page) || 1)));
  url.searchParams.set("pageSize", "20");
  url.searchParams.set("sortBy", query.sort === "relevance" ? "relevancy" : "total downloads");
  for (const [key, value] of [["search", query.query], ["categories", query.category], ["version", query.version], ["gameVersionTypeId", query.loader]]) if (value.trim()) url.searchParams.set(key, value.trim().slice(0, 200));
  return url.href;
}

export function parseCurseForge(html: string, url: string, game: "minecraft" | "sims4" | "the-sims-2" = "minecraft"): CurseForgePage {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc.querySelector(".results-container")) throw Error("minecraft_source_changed");
  const projects = new Map<string, CurseForgeProject>();
  for (const card of doc.querySelectorAll(".project-card")) {
    const link = discoveryUrl(attr(card, "a.name", "href"), url, ["www.curseforge.com"]);
    const types = game === "minecraft" ? "modpacks|mc-mods|texture-packs|shaders" : "mods|create-a-sim|build-buy|sims-households|rooms-lots|worlds|translations|pets|save-files";
    if (!link || !new RegExp(`^/${game}/(${types})/[^/]+/?$`).test(new URL(link).pathname)) continue;
    const name = text(card, "a.name", 200); if (!name) continue;
    projects.set(link, { id: link, url: link, name, icon: discoveryUrl(attr(card, ".art img", "src"), url, ["media.forgecdn.net"]), author: text(card, "a.author-name", 120) || text(card, ".author-name", 120), description: text(card, ".description"), downloads: text(card, ".detail-downloads", 30), updated: text(card, ".detail-updated .date-full", 60), version: text(card, ".detail-game-version", 60), loader: text(card, ".detail-flavor", 60), categories: Array.from(card.querySelectorAll(".detail-category")).map(node => clean(node.textContent, 80)) });
  }
  const options = (parameter: string) => {
    const values = new Map<string, DiscoveryOption>();
    for (const a of doc.querySelectorAll<HTMLAnchorElement>(`a[href*="${parameter}="]`)) {
      const href = discoveryUrl(a.getAttribute("href") || "", url, ["www.curseforge.com"]); if (!href) continue;
      const value = new URL(href).searchParams.get(parameter), label = clean(a.textContent || a.querySelector("input")?.getAttribute("aria-label"), 80);
      if (value && label && !value.includes(",")) values.set(value, { value, label });
    }
    return Array.from(values.values());
  };
  const page = Number(new URL(url).searchParams.get("page") || 1);
  const next = Array.from(doc.querySelectorAll<HTMLAnchorElement>("a[href]")).some(a => {
    const href = discoveryUrl(a.getAttribute("href") || "", url, ["www.curseforge.com"]);
    return href && new URL(href).pathname === `/${game}/search` && Number(new URL(href).searchParams.get("page")) === page + 1;
  });
  return { projects: Array.from(projects.values()), next: !!next, categories: options("categories"), versions: options("version"), loaders: options("gameVersionTypeId"), classes: options("class") };
}

export function serverDirectoryUrl(source: ServerSource, mode = ""): string {
  const origin = SERVER_SOURCES[source].origin;
  return /^[a-z0-9-]+$/.test(mode) ? `${origin}/type/${mode}${source === "mp" ? "/" : ""}` : `${origin}/`;
}
function serverAddress(value: string): string {
  const address = value.trim();
  return /^(?:[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?)(?::\d{1,5})?$/i.test(address) ? address : "";
}
export function parseMinecraftServers(html: string, source: ServerSource, url: string): MinecraftServerPage {
  const doc = new DOMParser().parseFromString(html, "text/html"), origin = SERVER_SOURCES[source].origin;
  const hosts = [new URL(origin).hostname], imageHosts = [...hosts, "status.minecraftservers.org"];
  const link = (value: string) => discoveryUrl(value, origin, hosts);
  const art = (value: string) => discoveryUrl(value, origin, imageHosts);
  const servers = new Map<string, MinecraftServer>();
  const rows = source === "org" ? doc.querySelectorAll(".server-listing:not(.highlight)") : doc.querySelectorAll("tr:has(.server-card)");
  for (const row of rows) {
    const org = source === "org";
    const href = link(attr(row, org ? ".name a" : ".server-title-responsive a", "href"));
    const id = href && new URL(href).pathname.match(org ? /^\/server\/(\d+)\/?$/ : /^\/server-s(\d+)\/?$/)?.[1];
    const name = text(row, org ? ".name a" : ".server-title-responsive a", 180);
    const address = serverAddress(attr(row, org ? "[data-clipboard-content]" : "[data-clipboard-text]", org ? "data-clipboard-content" : "data-clipboard-text"));
    if (!id || !name || !address) continue;
    const playerText = org ? text(row, ".players .value") : text(row, ".btn-xs-playercount");
    const counts = playerText.replaceAll(",", "").match(/(\d+)\s*\/\s*(\d+)/);
    const status = org ? text(row, ".status .value").toLowerCase() : text(row, ".server-about-m .btn-success, .server-about-m .btn-danger").toLowerCase();
    const rankText = org ? text(row, ".rank span") : text(row, "td:first-child strong").replace("#", "");
    const rank = integer(rankText);
    // Promoted rows have no numeric rank; preserve the directory's real ordering.
    if (!rank || rank < 1) continue;
    servers.set(id, { id: `${source}:${id}`, source, rank, name, address, url: href, icon: org ? art(`https://status.minecraftservers.org/icon/${id}.png`) : art(attr(row, "td:first-child img", "src")), banner: art(attr(row, org ? ".banner img" : ".server-card img.card-img-fluid", "src")), description: org ? "" : text(row, ".server-description"), players: counts ? Number(counts[1]) : null, capacity: counts ? Number(counts[2]) : null, online: status === "online" ? true : status === "offline" ? false : null, version: org ? "" : text(row, "a[href*='/version/']", 40), tags: Array.from(row.querySelectorAll(".list-server-tags .btn-tag")).map(node => clean(node.textContent, 60)).slice(0, 8) });
  }
  if (!servers.size && !doc.querySelector(source === "org" ? ".server-list" : ".server-card")) throw Error("minecraft_source_changed");
  const modes = new Map<string, DiscoveryOption>(); let next = "";
  const pageNumber = (value: string) => Number(new URL(value).pathname.match(/\/(?:index|list)\/(\d+)/)?.[1] || new URL(value).pathname.match(/\/type\/[^/]+\/(\d+)/)?.[1] || 1);
  for (const a of doc.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    const href = link(a.getAttribute("href") || ""); if (!href) continue;
    const path = new URL(href).pathname, mode = path.match(/^\/type\/([a-z0-9-]+)\/?$/)?.[1];
    if (mode) modes.set(mode, { value: mode, label: clean(a.textContent, 60) || mode });
    const numericPage = pageNumber(href);
    if (numericPage === pageNumber(url) + 1 && /^\/(?:index\/\d+|servers\/list\/\d+|type\/[a-z0-9-]+\/\d+)\/?$/.test(path) && (new URL(url).pathname.startsWith("/type/") ? path.startsWith(new URL(url).pathname.replace(/\/\d+\/?$/, "").replace(/\/$/, "") + "/") : !path.startsWith("/type/"))) next = href;
  }
  return { servers: Array.from(servers.values()), next, modes: Array.from(modes.values()) };
}

