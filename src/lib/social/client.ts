import { authenticatedFetch } from "@/lib/account/authenticated-fetch";
import { captureSessionScope } from "@/lib/theme-auth";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

const API = `${HARBOR_API_BASE}/themes/api`;

function headers(hasBody: boolean): Record<string, string> {
  const h: Record<string, string> = {};
  if (hasBody) h["Content-Type"] = "application/json";
  return h;
}

async function unwrap<T>(r: Response, isCurrent: () => boolean): Promise<T> {
  const d = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!isCurrent()) throw new Error("Account changed");
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
  const isCurrent = captureSessionScope();
  const r = await authenticatedFetch(`${API}${path}`, { headers: headers(false), signal }, fetch);
  return unwrap<T>(r, isCurrent);
}

export async function socialPost<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const isCurrent = captureSessionScope();
  const r = await authenticatedFetch(
    `${API}${path}`,
    {
      method: "POST",
      headers: headers(!!body),
      body: body ? JSON.stringify(body) : undefined,
    },
    fetch,
  );
  return unwrap<T>(r, isCurrent);
}

export async function socialDelete<T>(path: string): Promise<T> {
  const isCurrent = captureSessionScope();
  const r = await authenticatedFetch(
    `${API}${path}`,
    { method: "DELETE", headers: headers(false) },
    fetch,
  );
  return unwrap<T>(r, isCurrent);
}

export async function socialPatch<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const isCurrent = captureSessionScope();
  const r = await authenticatedFetch(
    `${API}${path}`,
    {
      method: "PATCH",
      headers: headers(!!body),
      body: body ? JSON.stringify(body) : undefined,
    },
    fetch,
  );
  return unwrap<T>(r, isCurrent);
}
