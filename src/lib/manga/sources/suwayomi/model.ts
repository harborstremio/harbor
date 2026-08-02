import { safeFetch } from "@/lib/safe-fetch";
import { mangaThrottle, type MangaSummary } from "@/lib/manga/types";
import { normalizeSuwayomiBase } from "./base-url";
import { registerSuwayomiAuth, suwayomiAuthFor } from "./auth-registry";

export type SuwayomiServer = {
  base: string;
  user?: string;
  pass?: string;
  authHeader?: string;
};

export type SuwayomiSource = {
  id: string;
  name: string;
  lang: string;
  iconUrl?: string;
  supportsLatest: boolean;
  isNsfw: boolean;
};

export type SuwayomiExtension = {
  pkgName: string;
  apkName?: string;
  name: string;
  lang: string;
  iconUrl?: string;
  versionName?: string;
  installed: boolean;
  hasUpdate: boolean;
  obsolete: boolean;
  isNsfw: boolean;
  repo?: string;
};

export type BrowseKind = "popular" | "latest" | "search";

export type SuwayomiClient = {
  server: SuwayomiServer;
  getJson(path: string): Promise<any | null>;
  getOk(path: string): Promise<boolean>;
  deleteOk(path: string): Promise<boolean>;
  postJson(path: string, body: unknown): Promise<any | null>;
  probeStatus(path: string): Promise<number | null>;
};

const DELIM = "~";

export function isDigits(v: string): boolean {
  return /^[0-9]+$/.test(v);
}

export function trimBase(raw: string): string {
  return raw.replace(/\/+$/, "");
}

export function makeServer(baseUrl: string, basicAuth?: string): SuwayomiServer {
  const normalized = normalizeSuwayomiBase(baseUrl) ?? baseUrl;
  let base = trimBase(normalized);
  let user: string | undefined;
  let pass: string | undefined;
  try {
    const u = new URL(normalized);
    if (u.username) {
      user = decodeURIComponent(u.username);
      pass = decodeURIComponent(u.password);
      u.username = "";
      u.password = "";
      base = trimBase(u.origin + u.pathname);
    }
  } catch {
    /* keep base */
  }
  if (basicAuth && basicAuth.includes(":")) {
    const at = basicAuth.indexOf(":");
    user = basicAuth.slice(0, at);
    pass = basicAuth.slice(at + 1);
  }
  const authHeader = user ? `Basic ${btoa(`${user}:${pass ?? ""}`)}` : suwayomiAuthFor(base);
  registerSuwayomiAuth(base, authHeader);
  return { base, user, pass, authHeader };
}

export function imageUrl(server: SuwayomiServer, path: string): string {
  return server.base + path;
}

export function makeClient(server: SuwayomiServer, gapMs = 150): SuwayomiClient {
  const throttle = mangaThrottle(gapMs);
  const headers = server.authHeader ? { authorization: server.authHeader } : undefined;
  return {
    server,
    getJson(path) {
      return throttle(async () => {
        try {
          const res = await safeFetch(server.base + path, headers ? { headers } : undefined);
          if (!res.ok) return null;
          return await res.json();
        } catch {
          return null;
        }
      });
    },
    getOk(path) {
      return throttle(async () => {
        try {
          const res = await safeFetch(server.base + path, headers ? { headers } : undefined);
          return res.ok;
        } catch {
          return false;
        }
      });
    },
    deleteOk(path) {
      return throttle(async () => {
        try {
          const res = await safeFetch(server.base + path, {
            method: "DELETE",
            headers,
          });
          return res.ok;
        } catch {
          return false;
        }
      });
    },
    postJson(path, body) {
      return throttle(async () => {
        try {
          const res = await safeFetch(server.base + path, {
            method: "POST",
            headers: { ...headers, "content-type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!res.ok) return null;
          return await res.json();
        } catch {
          return null;
        }
      });
    },
    probeStatus(path) {
      return throttle(async () => {
        try {
          const res = await safeFetch(server.base + path, headers ? { headers } : undefined);
          return res.status;
        } catch {
          return null;
        }
      });
    },
  };
}

export function encodeMangaId(sourceId: string, mangaId: string): string {
  return `${sourceId}${DELIM}${mangaId}`;
}

export function decodeMangaId(id: string): { sourceId: string; mangaId: string } | null {
  const at = id.indexOf(DELIM);
  if (at < 0) return null;
  const sourceId = id.slice(0, at);
  const mangaId = id.slice(at + 1);
  if (!mangaId) return null;
  return { sourceId, mangaId };
}

export function encodeChapterId(sourceId: string, mangaId: string, key: string): string {
  return `${sourceId}${DELIM}${mangaId}${DELIM}${key}`;
}

export function decodeChapterId(
  id: string,
): { sourceId: string; mangaId: string; key: string } | null {
  const parts = id.split(DELIM);
  if (parts.length < 3) return null;
  const [sourceId, mangaId, ...rest] = parts;
  const key = rest.join(DELIM);
  if (!mangaId || !key) return null;
  return { sourceId, mangaId, key };
}

export function mapManga(server: SuwayomiServer, sourceId: string, raw: any): MangaSummary | null {
  if (raw?.id == null) return null;
  const mangaId = String(raw.id);
  return {
    id: encodeMangaId(sourceId, mangaId),
    title: String(raw.title ?? "Untitled"),
    cover: imageUrl(server, `/api/v1/manga/${mangaId}/thumbnail`),
    author: raw.author || raw.artist || undefined,
    status: typeof raw.status === "string" ? raw.status.toLowerCase() : undefined,
    description: typeof raw.description === "string" ? raw.description.trim() : undefined,
  };
}

type Cursor = { count: number; page: number; hasNext: boolean };
const cursors = new Map<string, Cursor>();

export function cursorKey(base: string, sourceId: string, kind: BrowseKind, query: string): string {
  return `${base}|${sourceId}|${kind}|${query}`;
}

export function nextPage(key: string, offset: number): number {
  if (offset === 0) {
    cursors.delete(key);
    return 1;
  }
  const c = cursors.get(key);
  if (!c) return 1 + Math.floor(offset / 24);
  if (!c.hasNext) return -1;
  return c.page + 1;
}

export function recordPage(key: string, itemCount: number, hasNext: boolean, page: number): void {
  const prev = cursors.get(key);
  cursors.set(key, {
    count: (prev?.count ?? 0) + itemCount,
    page,
    hasNext,
  });
}

export function browseHasNext(key: string): boolean {
  return cursors.get(key)?.hasNext ?? false;
}
