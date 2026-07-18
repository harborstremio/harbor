import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetchImpl } from "@tauri-apps/plugin-http";
import { TrackerBlockedError, isBlockedUrl, noteBlocked } from "./privacy/blocklist";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Domains with CORS headers that should always fetch directly.
const DIRECT_HOSTS = new Set([
  "torrentio.strem.fun",
  "stremio.torbox.app",
  "api.strem.io",
  "v3-cinemeta.strem.io",
]);

// Debrid APIs — NO CORS headers. Must route through proxy on Tizen/web.
const PROXY_HOSTS = new Set([
  "api.real-debrid.com",
  "api.alldebrid.com",
  "debrid-link.com",
  "www.premiumize.me",
  "api.torbox.app",
]);

// Addon hosting platforms that may lack CORS headers.
const PROXY_SUFFIXES = [
  ".elfhosted.com",
  ".strem.fun",
  ".strem.io",
  ".stremio.homes",
  ".baby-beamup.club",
  ".workers.dev",
  ".debridio.com",
  ".code.run",
  ".fly.dev",
  ".onrender.com",
  ".vercel.app",
  ".netlify.app",
  ".railway.app",
  ".deno.dev",
];

let proxyUrl: string | null = null;

export function setProxyUrl(url: string): void {
  proxyUrl = url ? url.replace(/\/+$/, "") : null;
}

function rewriteForWeb(url: string, init?: RequestInit): { url: string; init?: RequestInit } {
  if (isTauri) return { url, init };
  if (!proxyUrl) return { url, init };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { url, init };
  }

  if (DIRECT_HOSTS.has(parsed.hostname)) return { url, init };

  const proxiable =
    PROXY_HOSTS.has(parsed.hostname) || PROXY_SUFFIXES.some((s) => parsed.hostname.endsWith(s));

  if (!proxiable) return { url, init };

  const proxied = `${proxyUrl}/proxy/${parsed.hostname}${parsed.pathname}${parsed.search}`;

  if (!init?.headers) return { url: proxied, init };

  const out = new Headers(init.headers as HeadersInit);
  const auth = out.get("authorization");
  if (auth) {
    out.delete("authorization");
    out.set("x-harbor-auth", auth);
  }

  return { url: proxied, init: { ...init, headers: out } };
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
