import { safeFetch } from "@/lib/safe-fetch";
import { authToken } from "@/lib/theme-auth";
import { HARBOR_API_BASE } from "@/lib/config/endpoints";

const BASE = `${HARBOR_API_BASE}/themes/api/social`;

export type ListLike = { likeCount: number; liked: boolean };

function authHeaders(): Record<string, string> {
  const t = authToken();
  return t ? { authorization: `Bearer ${t}` } : {};
}

function likeUrl(handle: string, listId: string): string {
  return `${BASE}/lists/${encodeURIComponent(handle)}/${encodeURIComponent(listId)}/like`;
}

export async function likeList(handle: string, listId: string): Promise<ListLike> {
  const res = await safeFetch(likeUrl(handle, listId), { method: "POST", headers: authHeaders() });
  if (!res.ok) throw new Error(`like list ${res.status}`);
  return (await res.json()) as ListLike;
}

export async function unlikeList(handle: string, listId: string): Promise<ListLike> {
  const res = await safeFetch(likeUrl(handle, listId), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`unlike list ${res.status}`);
  return (await res.json()) as ListLike;
}
