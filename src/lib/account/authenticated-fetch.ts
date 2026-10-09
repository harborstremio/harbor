import { authToken, captureSessionScope, refreshToken } from "@/lib/theme-auth";
import { safeFetch } from "@/lib/safe-fetch";

// Never replay an old account's mutation using a new account's credentials.
export async function authenticatedFetch(
  url: string,
  init?: RequestInit,
  transport: typeof fetch = safeFetch,
): Promise<Response> {
  const isCurrent = captureSessionScope();
  const token = authToken();
  const assertCurrent = () => {
    if (!isCurrent()) throw new Error("Account changed");
    init?.signal?.throwIfAborted();
  };
  const send = (bearer: string | null) => {
    assertCurrent();
    const headers = new Headers(init?.headers);
    if (bearer) headers.set("Authorization", `Bearer ${bearer}`);
    else headers.delete("Authorization");
    return transport(url, { ...init, headers });
  };
  let response = await send(token);
  assertCurrent();
  if (response.status === 401 && token && (await refreshToken(token))) {
    assertCurrent();
    response = await send(authToken());
  }
  assertCurrent();
  return response;
}
