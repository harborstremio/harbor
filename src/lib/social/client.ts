import { authToken, refreshToken } from "@/lib/theme-auth";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

const API = `${HARBOR_API_BASE}/themes/api`;

function headers(hasBody: boolean): Record<string, string> {
  const h: Record<string, string> = {};
  if (hasBody) h["Content-Type"] = "application/json";
  const token = authToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function unwrap<T>(r: Response): Promise<T> {
  const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok) {
    const message = typeof d.error === "string" ? d.error : `Request failed (${r.status}).`;
    const err = new Error(message) as Error & { status?: number; body?: unknown };
    err.status = r.status;
    err.body = d;
    throw err;
  }
  return d as T;
}

export async function socialGet<T>(path: string, signal?: AbortSignal): Promise<T> {
  let r = await fetch(`${API}${path}`, { headers: headers(false), signal });
  if (r.status === 401 && (await refreshToken())) {
    r = await fetch(`${API}${path}`, { headers: headers(false), signal });
  }
  return unwrap<T>(r);
}

export async function socialPost<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const send = () =>
    fetch(`${API}${path}`, {
      method: "POST",
      headers: headers(!!body),
      body: body ? JSON.stringify(body) : undefined,
    });
  let r = await send();
  if (r.status === 401 && (await refreshToken())) r = await send();
  return unwrap<T>(r);
}

export async function socialDelete<T>(path: string): Promise<T> {
  const send = () => fetch(`${API}${path}`, { method: "DELETE", headers: headers(false) });
  let r = await send();
  if (r.status === 401 && (await refreshToken())) r = await send();
  return unwrap<T>(r);
}

export async function socialPatch<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const send = () =>
    fetch(`${API}${path}`, {
      method: "PATCH",
      headers: headers(!!body),
      body: body ? JSON.stringify(body) : undefined,
    });
  let r = await send();
  if (r.status === 401 && (await refreshToken())) r = await send();
  return unwrap<T>(r);
}
