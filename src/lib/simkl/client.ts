import { safeFetch } from "@/lib/safe-fetch";
import { activeProfileId } from "@/lib/active-profile-id";
import {
  SIMKL_API_BASE,
  SIMKL_APP_NAME,
  SIMKL_APP_VERSION,
  SIMKL_CLIENT_ID,
  SIMKL_USER_AGENT,
} from "./config";
import { getSession, setSession } from "./session";
import { simklRetryPolicy } from "./retry-policy";

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
    public retryAt?: number,
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

async function sendRequest<T>(
  path: string,
  opts: SimklRequestOptions,
  assertOwner: () => void,
  usesSession: boolean,
): Promise<T> {
  let res: Response;
  for (let attempt = 0; ; attempt += 1) {
    assertOwner();
    await acquireSlot(opts.method ?? "GET");
    assertOwner();
    res = await doFetch(path, opts);
    assertOwner();
    if (!RETRY_STATUSES.has(res.status)) break;
    const body = await res.clone().text().catch(() => "");
    assertOwner();
    const policy = simklRetryPolicy(res.status, body, res.headers.get("Retry-After"), attempt);
    if (policy.cooldown) {
      const blocked = { until: Date.now() + policy.delayMs, status: res.status, body };
      if (policy.cooldown === "app") appCooldown = blocked;
      else userCooldowns.set(opts.token ?? "", blocked);
      throw new SimklApiError(res.status, body, blocked.until);
    }
    if (attempt >= 5) break;
    await sleep(policy.delayMs);
  }

  // 412 client_id_failed = over the total limit or the app is throttle-blocked. Simkl's
  // guidance is to STOP hammering, not keep draining the queue into the block.
  if (res.status === 412) {
    const body = await res.text().catch(() => "client_id_failed");
    assertOwner();
    appCooldown = { until: Date.now() + BLOCK_COOLDOWN_MS, status: 412, body };
    throw new SimklApiError(412, body, appCooldown.until);
  }

  if (res.status === 401 && usesSession) {
    setSession(null);
    throw new SimklApiError(401, "unauthorized");
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    assertOwner();
    throw new SimklApiError(res.status, body);
  }

  if (res.status === 204) return undefined as unknown as T;
  const data = (await res.json()) as T;
  assertOwner();
  return data;
}

const GET_MIN_GAP_MS = 110;
const POST_MIN_GAP_MS = 1050;
const BLOCK_COOLDOWN_MS = 60000;

let queueTail: Promise<unknown> = Promise.resolve();
let lastGetAt = 0;
let lastPostAt = 0;
type Cooldown = { until: number; status: number; body: string };
let appCooldown: Cooldown | null = null;
const userCooldowns = new Map<string, Cooldown>();

function currentCooldown(token?: string): Cooldown | null {
  const now = Date.now();
  if (appCooldown && appCooldown.until <= now) appCooldown = null;
  for (const [key, value] of userCooldowns) {
    if (value.until <= now) userCooldowns.delete(key);
  }
  return appCooldown ?? userCooldowns.get(token ?? "") ?? null;
}

export function isSimklBlocked(): boolean {
  return currentCooldown(getSession()?.accessToken) !== null;
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
  const profile = activeProfileId();
  const usesSession = !opts.token && opts.authed !== false;
  const session = usesSession ? getSession() : null;
  const request = { ...opts, token: opts.token || session?.accessToken };
  const assertOwner = () => {
    if (usesSession && (activeProfileId() !== profile || getSession() !== session)) {
      throw new DOMException("SIMKL request cancelled after account change", "AbortError");
    }
  };
  const run = async (): Promise<T> => {
    assertOwner();
    const blocked = currentCooldown(request.token);
    if (blocked) throw new SimklApiError(blocked.status, blocked.body, blocked.until);
    return sendRequest<T>(path, request, assertOwner, usesSession);
  };
  const result = queueTail.then(run, run);
  queueTail = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}
