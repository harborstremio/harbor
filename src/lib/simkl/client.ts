import { safeFetch } from "@/lib/safe-fetch";
import {
  SIMKL_API_BASE,
  SIMKL_APP_NAME,
  SIMKL_APP_VERSION,
  SIMKL_CLIENT_ID,
  SIMKL_USER_AGENT,
} from "./config";
import { getSession, setSession } from "./session";

export type SimklRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  authed?: boolean;
  token?: string;
};

export class SimklApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`Simkl HTTP ${status}: ${body.slice(0, 200)}`);
  }
}

function baseHeaders(method: string): Record<string, string> {
  const headers: Record<string, string> = {
    "simkl-api-key": SIMKL_CLIENT_ID,
    "User-Agent": SIMKL_USER_AGENT,
  };
  if (method === "POST" || method === "PUT") {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

async function doFetch(path: string, opts: SimklRequestOptions): Promise<Response> {
  const method = opts.method ?? "GET";
  const headers = baseHeaders(method);
  if (opts.token) {
    headers["Authorization"] = `Bearer ${opts.token}`;
  } else if (opts.authed !== false) {
    const session = getSession();
    if (session) headers["Authorization"] = `Bearer ${session.accessToken}`;
  }

  const url = new URL(`${SIMKL_API_BASE}${path}`);
  url.searchParams.set("client_id", SIMKL_CLIENT_ID);
  url.searchParams.set("app-name", SIMKL_APP_NAME);
  url.searchParams.set("app-version", SIMKL_APP_VERSION);

  return safeFetch(url.toString(), {
    method,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

const RETRY_STATUSES = new Set([429, 500, 502, 503]);

async function sendRequest<T>(path: string, opts: SimklRequestOptions): Promise<T> {
  let res = await doFetch(path, opts);

  for (let attempt = 0; RETRY_STATUSES.has(res.status) && attempt < 5; attempt += 1) {
    const retryAfter = res.headers.get("Retry-After");
    let delayMs = Math.min(16, 2 ** attempt) * 1000;
    if (retryAfter) {
      const secs = Number(retryAfter);
      if (Number.isFinite(secs)) delayMs = Math.max(delayMs, secs * 1000);
      else {
        const date = Date.parse(retryAfter);
        if (Number.isFinite(date)) delayMs = Math.max(delayMs, date - Date.now());
      }
    }
    // jitter 0-1000ms to avoid thundering herd
    delayMs += Math.floor(Math.random() * 1000);
    await new Promise((r) => setTimeout(r, delayMs));
    res = await doFetch(path, opts);
  }

  // 412 client_id_failed = over the total limit or the app is throttle-blocked. Simkl's
  // guidance is to STOP hammering, not keep draining the queue into the block.
  if (res.status === 412) {
    blockedUntil = Date.now() + BLOCK_COOLDOWN_MS;
    const body = await res.text().catch(() => "client_id_failed");
    throw new SimklApiError(412, body);
  }

  if (res.status === 401 && opts.authed !== false) {
    setSession(null);
    throw new SimklApiError(401, "unauthorized");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new SimklApiError(res.status, body);
  }

  if (res.status === 204) return undefined as unknown as T;
  return (await res.json()) as T;
}

const GET_MIN_GAP_MS = 110;
const POST_MIN_GAP_MS = 1050;
const BLOCK_COOLDOWN_MS = 60000;

let queueTail: Promise<unknown> = Promise.resolve();
let lastGetAt = 0;
let lastPostAt = 0;
let blockedUntil = 0;

export function isSimklBlocked(): boolean {
  return Date.now() < blockedUntil;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function acquireSlot(method: string): Promise<void> {
  if (method === "GET") {
    const wait = GET_MIN_GAP_MS - (Date.now() - lastGetAt);
    if (wait > 0) await sleep(wait);
    lastGetAt = Date.now();
  } else {
    const wait = POST_MIN_GAP_MS - (Date.now() - lastPostAt);
    if (wait > 0) await sleep(wait);
    lastPostAt = Date.now();
  }
}

export function simklRequest<T>(path: string, opts: SimklRequestOptions = {}): Promise<T> {
  const run = async (): Promise<T> => {
    if (Date.now() < blockedUntil) {
      throw new SimklApiError(412, "simkl temporarily unavailable (throttle block)");
    }
    await acquireSlot(opts.method ?? "GET");
    return sendRequest<T>(path, opts);
  };
  const result = queueTail.then(run, run);
  queueTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
