import { safeFetch } from "@/lib/safe-fetch";
import { activeProfileId } from "@/lib/active-profile-id";
import { getSession, setSession } from "./session";

export const PMDB_BASE_URL = "https://publicmetadb.com";

export type PmdbRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  authed?: boolean;
  token?: string;
  signal?: AbortSignal;
};

export class PmdbApiError extends Error {
  status: number;
  body: string;
  retryAt?: number;

  constructor(status: number, body: string, retryAt?: number) {
    super(`PublicMetaDB HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = "PmdbApiError";
    this.status = status;
    this.body = body;
    this.retryAt = retryAt;
  }
}

function baseHeaders(method: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (method === "POST" || method === "PUT" || method === "DELETE") {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

const RETRY_STATUSES = new Set([429, 500, 502, 503]);
const MIN_GAP_MS = 50;

let lastRequestAt = 0;
let queueTail: Promise<unknown> = Promise.resolve();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireSlot(): Promise<void> {
  const wait = MIN_GAP_MS - (Date.now() - lastRequestAt);
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function doFetch(path: string, opts: PmdbRequestOptions): Promise<Response> {
  const method = opts.method ?? "GET";
  const headers = baseHeaders(method);
  if (opts.token) {
    headers["Authorization"] = `Bearer ${opts.token}`;
  }

  const url = path.startsWith("http") ? path : `${PMDB_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;

  return safeFetch(url, {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  });
}

export async function pmdbRequest<T>(path: string, opts: PmdbRequestOptions = {}): Promise<T> {
  const profile = activeProfileId();
  const usesSession = !opts.token && opts.authed !== false;
  const session = usesSession ? getSession() : null;
  const token = opts.token ?? session?.apiKey;

  if (usesSession && !token) {
    throw new PmdbApiError(401, "Not authenticated with PublicMetaDB");
  }

  const request = { ...opts, token };

  const assertOwner = () => {
    if (usesSession && (activeProfileId() !== profile || getSession() !== session)) {
      throw new DOMException("PublicMetaDB request cancelled after profile change", "AbortError");
    }
  };

  const run = async (): Promise<T> => {
    assertOwner();
    let res: Response;

    for (let attempt = 0; ; attempt += 1) {
      assertOwner();
      await acquireSlot();
      assertOwner();

      res = await doFetch(path, request);
      assertOwner();

      if (!RETRY_STATUSES.has(res.status)) break;

      const retryAfterSec = Number(res.headers.get("Retry-After"));
      const delayMs = !Number.isNaN(retryAfterSec) && retryAfterSec > 0
        ? retryAfterSec * 1000
        : Math.min(1000 * 2 ** attempt, 8000);

      if (attempt >= 3) break;
      await sleep(delayMs);
    }

    if (res.status === 401 && usesSession) {
      setSession(null);
      throw new PmdbApiError(401, "Unauthorized - PublicMetaDB API key invalid or expired");
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      assertOwner();
      throw new PmdbApiError(res.status, text);
    }

    if (res.status === 204) {
      return undefined as unknown as T;
    }

    const text = await res.text().catch(() => "");
    assertOwner();
    if (!text) return undefined as unknown as T;

    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  };

  const result = queueTail.then(run, run);
  queueTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function verifyApiKey(apiKey: string): Promise<boolean> {
  const trimmed = apiKey.trim();
  if (!trimmed) return false;
  try {
    const res = await doFetch("/api/external/ratings?tmdb_id=550&media_type=movie", {
      method: "GET",
      token: trimmed,
    });
    return res.ok;
  } catch {
    return false;
  }
}
