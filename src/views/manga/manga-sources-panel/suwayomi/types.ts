import type { ServerConfig } from "@/lib/manga/sources/suwayomi/provider";

export type SuwayomiAuth = { username: string; password: string };

export type SuwayomiServer = {
  id: string;
  name: string;
  baseUrl: string;
  auth?: SuwayomiAuth;
};

export function serverConfig(server: SuwayomiServer): ServerConfig {
  return { baseUrl: server.baseUrl, auth: server.auth };
}

export function serverHost(baseUrl: string): string {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

export function initials(name: string): string {
  return name.replace(/[^a-z0-9]/gi, "").slice(0, 2).toUpperCase() || "?";
}
