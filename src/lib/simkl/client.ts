import { safeFetch } from "@/lib/safe-fetch";

import { SIMKL_API_BASE, SIMKL_APP_NAME, SIMKL_APP_VERSION, SIMKL_CLIENT_ID } from "./config";
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

export async function simklRequest<T>(path: string, opts: SimklRequestOptions = {}): Promise<T> {
  let res = await doFetch(path, opts);

  for (let attempt = 0; res.status === 429 && attempt < 5; attempt += 1) {
    await new Promise((r) => setTimeout(r, Math.min(16, 2 ** attempt) * 1000));
    res = await doFetch(path, opts);
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
