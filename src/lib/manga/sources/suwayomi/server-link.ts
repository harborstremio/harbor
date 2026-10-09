import { addMangaSource, listMangaSources, type MangaSource } from "@/lib/manga/sources";
import { credentialFreeBase, normalizeSuwayomiBase } from "./base-url";

export const SUWAYOMI_SERVERS_KEY = "harbor.manga.suwayomi.servers.v1";

export type LinkableServer = {
  name: string;
  baseUrl: string;
  auth?: { username: string; password: string };
};

export function serverSourceUrl(server: LinkableServer): string {
  const base = normalizeSuwayomiBase(server.baseUrl) ?? server.baseUrl.trim().replace(/\/+$/, "");
  const creds = server.auth;
  if (!creds || (!creds.username && !creds.password)) return base;
  try {
    const u = new URL(base);
    u.username = encodeURIComponent(creds.username);
    u.password = encodeURIComponent(creds.password ?? "");
    return u.toString().replace(/\/+$/, "");
  } catch {
    return base;
  }
}

export function sourceMatchesServer(sourceBaseUrl: string, serverBaseUrl: string): boolean {
  const a = normalizeSuwayomiBase(sourceBaseUrl);
  const b = normalizeSuwayomiBase(serverBaseUrl);
  if (!a || !b) return false;
  return credentialFreeBase(a) === credentialFreeBase(b);
}

export function linkServerSource(server: LinkableServer): MangaSource | null {
  return addMangaSource(server.name, serverSourceUrl(server), "suwayomi");
}

function storedServers(): LinkableServer[] {
  try {
    const raw = localStorage.getItem(SUWAYOMI_SERVERS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s) => s && typeof s.baseUrl === "string")
      .map((s) => ({
        name: String(s.name ?? s.baseUrl),
        baseUrl: String(s.baseUrl),
        auth:
          s.auth && typeof s.auth.username === "string"
            ? { username: String(s.auth.username), password: String(s.auth.password ?? "") }
            : undefined,
      }));
  } catch {
    return [];
  }
}

export function reconcileSuwayomiServers(): void {
  const servers = storedServers();
  if (servers.length === 0) return;
  const sources = listMangaSources();
  for (const server of servers) {
    const linked = sources.some(
      (s) => s.kind === "suwayomi" && sourceMatchesServer(s.baseUrl, server.baseUrl),
    );
    if (!linked) linkServerSource(server);
  }
}
