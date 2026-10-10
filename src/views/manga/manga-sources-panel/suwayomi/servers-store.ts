import { setItemWithRecovery } from "@/lib/storage-recovery";
import {
  activeMangaSourceId,
  listMangaSources,
  removeMangaSource,
  setActiveMangaSource,
} from "@/lib/manga/sources";
import { normalizeSuwayomiBase } from "@/lib/manga/sources/suwayomi/base-url";
import {
  SUWAYOMI_SERVERS_KEY,
  linkServerSource,
  sourceMatchesServer,
} from "@/lib/manga/sources/suwayomi/server-link";
import type { SuwayomiAuth, SuwayomiServer } from "./types";

const SERVERS_KEY = SUWAYOMI_SERVERS_KEY;
const ACTIVE_KEY = "harbor.manga.suwayomi.active.v1";

const listeners = new Set<() => void>();

export function subscribeServers(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function notify(): void {
  for (const l of listeners) l();
}

function cleanBase(baseUrl: string): string {
  return normalizeSuwayomiBase(baseUrl) ?? baseUrl.trim().replace(/\/+$/, "");
}

function isValidBase(baseUrl: string): boolean {
  return /^https?:\/\/.+/i.test(cleanBase(baseUrl));
}

function normalizeAuth(auth?: SuwayomiAuth): SuwayomiAuth | undefined {
  const username = auth?.username.trim() ?? "";
  const password = auth?.password ?? "";
  if (!username && !password) return undefined;
  return { username, password };
}

function serverId(baseUrl: string): string {
  return `suwa-${cleanBase(baseUrl).replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`.slice(0, 80);
}

export function listServers(): SuwayomiServer[] {
  try {
    const raw = localStorage.getItem(SERVERS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((s) => s && typeof s.id === "string" && typeof s.baseUrl === "string")
      .map((s) => ({
        id: String(s.id),
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

function write(list: SuwayomiServer[]): boolean {
  try {
    return setItemWithRecovery(SERVERS_KEY, JSON.stringify(list));
  } catch {
    return false;
  }
}

export function getServer(id: string): SuwayomiServer | undefined {
  return listServers().find((s) => s.id === id);
}

export function addServer(name: string, baseUrl: string, auth?: SuwayomiAuth): SuwayomiServer | null {
  if (!isValidBase(baseUrl)) return null;
  const clean = cleanBase(baseUrl);
  const id = serverId(clean);
  const server: SuwayomiServer = {
    id,
    name: name.trim() || new URL(clean).host,
    baseUrl: clean,
    auth: normalizeAuth(auth),
  };
  const rest = listServers().filter((s) => s.id !== id);
  if (!write([...rest, server])) return null;
  setActiveServer(id);
  const src = linkServerSource(server);
  if (src) setActiveMangaSource(src.id);
  notify();
  return server;
}

export function updateServer(
  id: string,
  patch: { name?: string; baseUrl?: string; auth?: SuwayomiAuth | null },
): SuwayomiServer | null {
  const list = listServers();
  const current = list.find((s) => s.id === id);
  if (!current) return null;
  const nextBase = patch.baseUrl != null ? cleanBase(patch.baseUrl) : current.baseUrl;
  if (!isValidBase(nextBase)) return null;
  const next: SuwayomiServer = {
    id: current.id,
    name: (patch.name ?? current.name).trim() || new URL(nextBase).host,
    baseUrl: nextBase,
    auth: patch.auth === null ? undefined : normalizeAuth(patch.auth ?? current.auth),
  };
  if (!write(list.map((s) => (s.id === id ? next : s)))) return null;
  const activeSrc = activeMangaSourceId();
  const stale = listMangaSources().filter(
    (s) => s.kind === "suwayomi" && sourceMatchesServer(s.baseUrl, current.baseUrl),
  );
  const src = linkServerSource(next);
  for (const s of stale) {
    if (!src || s.id !== src.id) removeMangaSource(s.id);
  }
  if (src && stale.some((s) => s.id === activeSrc)) setActiveMangaSource(src.id);
  notify();
  return next;
}

export function removeServer(id: string): void {
  const target = getServer(id);
  const remaining = listServers().filter((s) => s.id !== id);
  write(remaining);
  if (activeServerId() === id) {
    try {
      localStorage.setItem(ACTIVE_KEY, remaining[0]?.id ?? "");
    } catch {
      /* noop */
    }
  }
  if (target) {
    for (const s of listMangaSources()) {
      if (s.kind !== "suwayomi") continue;
      if (!sourceMatchesServer(s.baseUrl, target.baseUrl)) continue;
      if (remaining.some((o) => sourceMatchesServer(s.baseUrl, o.baseUrl))) continue;
      removeMangaSource(s.id);
    }
  }
  notify();
}

export function activeServerId(): string {
  const list = listServers();
  try {
    const v = localStorage.getItem(ACTIVE_KEY);
    if (v && list.some((s) => s.id === v)) return v;
  } catch {
    /* noop */
  }
  return list[0]?.id ?? "";
}

export function activeServer(): SuwayomiServer | undefined {
  return getServer(activeServerId());
}

export function setActiveServer(id: string): void {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {
    /* noop */
  }
  notify();
}
