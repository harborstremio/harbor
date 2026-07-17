import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetchImpl } from "@tauri-apps/plugin-http";
import { TrackerBlockedError, isBlockedUrl, noteBlocked } from "./privacy/blocklist";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

function rewriteForWeb(url: string, init?: RequestInit): { url: string; init?: RequestInit } {
  if (isTauri) return { url, init };
  return { url, init };
}

type HarborFetchResponse = {
  status: number;
  ok: boolean;
  body: string;
  contentType: string | null;
};

async function tauriHarborFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers: Record<string, string> = {};
  if (init?.headers) {
    const h = new Headers(init.headers as HeadersInit);
    h.forEach((v, k) => {
      headers[k] = v;
    });
  }
  const body =
    typeof init?.body === "string"
      ? init.body
      : init?.body instanceof URLSearchParams
        ? init.body.toString()
        : init?.body
          ? JSON.stringify(init.body)
          : undefined;
  const resp = await invoke<HarborFetchResponse>("harbor_fetch", {
    args: {
      url: input,
      method: init?.method ?? "GET",
      headers,
      body,
      timeoutMs: 30000,
    },
  });
  return new Response(resp.body, {
    status: resp.status,
    headers: resp.contentType ? { "content-type": resp.contentType } : {},
  });
}

function isIdempotent(method: string | undefined): boolean {
  const m = (method ?? "GET").toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS";
}

export const safeFetch: typeof fetch = (input, init) => {
  const target = typeof input === "string" ? input : input instanceof URL ? input.href : null;
  if (target && isBlockedUrl(target)) {
    noteBlocked();
    let host = target;
    try {
      host = new URL(target).hostname;
    } catch {}
    return Promise.reject(new TrackerBlockedError(host));
  }
  if (isTauri) {
    if (typeof input === "string") {
      if (isIdempotent(init?.method)) {
        return tauriHarborFetch(input, init).catch(
          () => tauriFetchImpl(input as string, init as RequestInit) as Promise<Response>,
        );
      }
      return tauriHarborFetch(input, init);
    }
    return tauriFetchImpl(input as unknown as string, init as RequestInit) as Promise<Response>;
  }
  if (typeof input === "string") {
    const r = rewriteForWeb(input, init);
    return fetch(r.url, r.init);
  }
  return fetch(input, init);
};
