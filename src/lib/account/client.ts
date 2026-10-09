import { authenticatedFetch } from "./authenticated-fetch";
import { captureSessionScope } from "@/lib/theme-auth";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";
import { safeFetch } from "@/lib/safe-fetch";

const API = `${HARBOR_API_BASE}/themes/api`;

function url(path: string): string {
  return `${API}${path}`;
}

function bodySnippet(raw: string, contentType: string): string {
  const text = raw
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
  const kind = contentType.split(";")[0].trim() || "unknown";
  return text ? `${kind}: ${text}` : kind;
}

const NOT_JSON = Symbol("not-json");

async function unwrap<T>(r: Response, isCurrent: () => boolean): Promise<T> {
  const copy = typeof r.clone === "function" ? r.clone() : null;
  const parsed = await r.json().catch(() => NOT_JSON);
  const d = (parsed === NOT_JSON ? {} : parsed) as Record<string, unknown>;
  if (!isCurrent()) throw new Error("Account changed");
  if (!r.ok) {
    const message = typeof d.error === "string" ? d.error : `Request failed (${r.status}).`;
    const err = new Error(message) as Error & { status?: number; code?: string; reason?: string };
    err.status = r.status;
    if (typeof d.code === "string") err.code = d.code;
    if (typeof d.message === "string") err.reason = d.message;
    if (parsed === NOT_JSON) {
      const raw = copy ? await copy.text().catch(() => "") : "";
      const detail = bodySnippet(raw, r.headers?.get("content-type") ?? "");
      err.reason = err.reason ?? detail;
      console.warn(`[account] ${r.status} from ${r.url} was not JSON. ${detail}`);
    }
    throw err;
  }
  return d as T;
}

export async function getJson<T>(
  path: string,
  opts?: { bearer?: boolean; signal?: AbortSignal },
): Promise<T> {
  const isCurrent = opts?.bearer ? captureSessionScope() : () => true;
  const send = opts?.bearer ? authenticatedFetch : safeFetch;
  const r = await send(url(path), { signal: opts?.signal });
  return unwrap<T>(r, isCurrent);
}

export async function postJson<T>(
  path: string,
  body: Record<string, unknown>,
  opts?: { bearer?: boolean },
): Promise<T> {
  const isCurrent = opts?.bearer ? captureSessionScope() : () => true;
  const send = opts?.bearer ? authenticatedFetch : safeFetch;
  const r = await send(url(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return unwrap<T>(r, isCurrent);
}
