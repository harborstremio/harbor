import { ANILIST_GRAPHQL_URL } from "./config";
import { getSession } from "./session";

export class AnilistApiError extends Error {
  constructor(
    public status: number,
    public body: string,
  ) {
    super(`AniList HTTP ${status}: ${body.slice(0, 200)}`);
  }
}

type GraphqlResponse<T> = { data?: T; errors?: Array<{ message: string }> };

function doFetch(query: string, variables: Record<string, unknown>, token: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(ANILIST_GRAPHQL_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
}

export async function anilistRequest<T>(
  query: string,
  variables: Record<string, unknown> = {},
  accessToken?: string,
  skipAuth = false,
): Promise<T> {
  const token = skipAuth ? null : (accessToken ?? getSession()?.accessToken ?? null);
  let res = await doFetch(query, variables, token);

  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after") ?? "1");
    const waitMs = Math.min(Math.max(retry, 1), 30) * 1000;
    await new Promise((r) => setTimeout(r, waitMs));
    res = await doFetch(query, variables, token);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new AnilistApiError(res.status, body);
  }

  const json = (await res.json()) as GraphqlResponse<T>;
  if (json.errors && json.errors.length > 0) {
    throw new AnilistApiError(200, json.errors.map((e) => e.message).join("; "));
  }
  return json.data as T;
}
