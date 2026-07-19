import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetchImpl } from "@tauri-apps/plugin-http";
import { TrackerBlockedError, isBlockedUrl, noteBlocked } from "./privacy/blocklist";
import { canFallbackAfterNativeFetchError } from "./safe-fetch-policy";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Torrentio + TorBox sit behind Cloudflare that blocks datacenter IPs, so on web they
// MUST be fetched directly from the browser's residential IP (they set CORS, so it
// works) — proxying them through the VPS gets 403'd. EVERYTHING ELSE routes through the
// VPS /api-proxy: it's required for addons that send no CORS header at all (OpenSubtitles)
// and for the CORS-less debrid REST APIs, and it's fine for the rest (Cinemeta, Comet).
const DIRECT_HOSTS = new Set([
  "torrentio.strem.fun",
  "stremio.torbox.app",
  "api.balloonerismm.workers.dev",
]);

const PROXY_HOSTS = new Set([
  "v3-cinemeta.strem.io",
  "opensubtitles-v3.strem.io",
  "opensubtitles.strem.io",
  "opensubtitles.stremio.homes",
  "api.torbox.app",
  "api.real-debrid.com",
  "api.alldebrid.com",
  "debrid-link.com",
  "www.premiumize.me",
]);

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

function rewriteForWeb(url: string, init?: RequestInit): { url: string; init?: RequestInit } {
  if (isTauri) return { url, init };
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

  const proxied = `/api-proxy/${parsed.hostname}${parsed.pathname}${parsed.search}`;
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

function abortError(): DOMException {
  return new DOMException("The operation was aborted", "AbortError");
}

async function tauriHarborFetch(input: string, init?: RequestInit): Promise<Response> {
  if (init?.signal?.aborted) {
    throw abortError();
  }
  const requestId = crypto.randomUUID();
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
  const nativeRequest = invoke<HarborFetchResponse>("harbor_fetch", {
    args: {
      url: input,
      requestId,
      method: init?.method ?? "GET",
      headers,
      body,
      timeoutMs: 30000,
    },
  });
  let onAbort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => {
      void invoke("harbor_fetch_cancel", { requestId }).catch(() => {});
      reject(abortError());
    };
    init?.signal?.addEventListener("abort", onAbort, { once: true });
    if (init?.signal?.aborted) onAbort();
  });
  let resp: HarborFetchResponse;
  try {
    resp = await Promise.race([nativeRequest, aborted]);
  } finally {
    if (onAbort) init?.signal?.removeEventListener("abort", onAbort);
  }
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
        return tauriHarborFetch(input, init).catch((error) => {
          if (
            init?.signal?.aborted ||
            (error instanceof DOMException && error.name === "AbortError")
          ) {
            throw abortError();
          }
          if (!canFallbackAfterNativeFetchError(error)) throw error;
          return tauriFetchImpl(input as string, init as RequestInit) as Promise<Response>;
        });
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
