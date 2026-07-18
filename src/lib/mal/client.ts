import { MAL_API_BASE } from "./config";
import { getSession } from "./session";
import { ensureRefreshed } from "./auth";

export class MalApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`MAL HTTP ${status}: ${body.slice(0, 200)}`);
  }
}

async function tauriFetch(input: string, init?: RequestInit): Promise<Response> {
  if ("__TAURI_INTERNALS__" in window) {
    const { fetch: tauriFetchFn } = await import("@tauri-apps/plugin-http");
    return tauriFetchFn(input, init as Record<string, unknown>) as unknown as Response;
  }
  return fetch(input, init);
}

export async function malRequest<T>(
  path: string,
  options: { method?: string; body?: URLSearchParams; accessToken?: string } = {},
): Promise<T> {
  const token = options.accessToken ?? getSession()?.accessToken ?? null;
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.body) headers["Content-Type"] = "application/x-www-form-urlencoded";

  let res = await tauriFetch(`${MAL_API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body?.toString(),
  });

  if (res.status === 401 && !options.accessToken) {
    const refreshed = await ensureRefreshed();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${refreshed.accessToken}`;
      res = await tauriFetch(`${MAL_API_BASE}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body?.toString(),
      });
    }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new MalApiError(res.status, body);
  }

  return (await res.json()) as T;
}
