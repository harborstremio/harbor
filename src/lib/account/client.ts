import { authToken, refreshToken } from "@/lib/theme-auth";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

const API = `${HARBOR_API_BASE}/themes/api`;

function url(path: string): string {
  return `${API}${path}`;
}

function headers(bearer: boolean, hasBody: boolean): Record<string, string> {
  const h: Record<string, string> = {};
  if (hasBody) h["Content-Type"] = "application/json";
  if (bearer) {
    const token = authToken();
    if (token) h.Authorization = `Bearer ${token}`;
  }
  return h;
}

async function unwrap<T>(r: Response): Promise<T> {
  const d = await r.json().catch(() => ({}) as Record<string, unknown>);
  if (!r.ok) {
    const message = typeof d.error === "string" ? d.error : `Request failed (${r.status}).`;
    const err = new Error(message) as Error & { status?: number; code?: string; reason?: string };
    err.status = r.status;
    if (typeof d.code === "string") err.code = d.code;
    if (typeof d.message === "string") err.reason = d.message;
    throw err;
  }
  return d as T;
}

export async function getJson<T>(
  path: string,
  opts?: { bearer?: boolean; signal?: AbortSignal },
): Promise<T> {
  const bearer = opts?.bearer ?? false;
  let r = await fetch(url(path), { headers: headers(bearer, false), signal: opts?.signal });
  if (r.status === 401 && bearer && (await refreshToken())) {
    r = await fetch(url(path), { headers: headers(true, false), signal: opts?.signal });
  }
  return unwrap<T>(r);
}

export async function postJson<T>(
  path: string,
  body: Record<string, unknown>,
  opts?: { bearer?: boolean },
): Promise<T> {
  const bearer = opts?.bearer ?? false;
  const send = () =>
    fetch(url(path), {
      method: "POST",
      headers: headers(bearer, true),
      body: JSON.stringify(body),
    });
  let r = await send();
  if (r.status === 401 && bearer && (await refreshToken())) r = await send();
  return unwrap<T>(r);
}
