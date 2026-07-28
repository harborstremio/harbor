import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetchImpl } from "@tauri-apps/plugin-http";
import { TrackerBlockedError, isBlockedUrl, noteBlocked } from "./privacy/blocklist";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

// Torrentio + TorBox sit behind Cloudflare that blocks datacenter IPs, so on web they
// MUST be fetched directly from the browser's residential IP (they set CORS, so it
// works) — proxying them through the VPS gets 403'd. EVERYTHING ELSE routes through the
// VPS /api-proxy: it's required for addons that send no CORS header at all (OpenSubtitles)
// and for the CORS-less debrid REST APIs, and it's fine for the rest (Cinemeta, Comet).
const DIRECT_HOSTS = new Set([
  "torrentio.strem.fun",
  "stremio.torbox.app",
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

let proxyOriginCache: boolean | null = null;
function webProxyAvailable(): boolean {
  if (proxyOriginCache !== null) return proxyOriginCache;
  try {
    proxyOriginCache = /(^|\.)harbor\.site$/i.test(window.location.hostname);
  } catch {
    proxyOriginCache = false;
  }
  return proxyOriginCache;
}

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
  if (!webProxyAvailable()) return { url, init };

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
  headers?: Record<string, string>;
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
    headers: resp.headers ?? (resp.contentType ? { "content-type": resp.contentType } : {}),
  });
}

function isIdempotent(method: string | undefined): boolean {
  const m = (method ?? "GET").toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS";
}

function isLocalhost(host: string): boolean {
  const h = host.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h === "127.0.0.1" || h === "::1") return true;
  try {
    const hostname = new URL(h.includes("://") ? h : `http://${h}`)
      .hostname.replace(/^\[|\]$/g, "");
    if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") return true;
  } catch {
  }
  return false;
}

function guardRejectionHost(e: unknown): string | null {
  const raw = typeof e === "string" ? e : ((e as { message?: string } | undefined)?.message ?? "");
  const m = raw.match(/blocked internal target:\s*(\S+)/i);
  return m ? m[1] : null;
}

// The Tauri http plugin rejects an aborted request with a plain Error("Request cancelled").
// Normalize it to a standard AbortError so callers (and the global rejection handler) treat
// a cancel as the benign abort it is instead of surfacing the app-wide error screen.
function normalizeAbort(p: Promise<Response>): Promise<Response> {
  return p.catch((e: unknown) => {
    const msg = (e as { message?: string } | undefined)?.message ?? "";
    if (/request cancell?ed/i.test(msg)) throw new DOMException("Aborted", "AbortError");
    throw e;
  });
}

const HARBOR_FETCH_DEADLINE_MS = 35000;

function withDeadline(p: Promise<Response>, signal?: AbortSignal | null): Promise<Response> {
  if (signal?.aborted) return Promise.reject(new DOMException("Aborted", "AbortError"));
  return new Promise<Response>((resolve, reject) => {
    let settled = false;
    const cleanups: Array<() => void> = [];
    const finish = (run: () => void) => {
      if (settled) return;
      settled = true;
      for (const c of cleanups) c();
      run();
    };
    const timer = setTimeout(
      () => finish(() => reject(new DOMException("harbor_fetch exceeded deadline", "TimeoutError"))),
      HARBOR_FETCH_DEADLINE_MS,
    );
    cleanups.push(() => clearTimeout(timer));
    if (signal) {
      const onAbort = () => finish(() => reject(new DOMException("Aborted", "AbortError")));
      signal.addEventListener("abort", onAbort);
      cleanups.push(() => signal.removeEventListener("abort", onAbort));
    }
    p.then(
      (v) => finish(() => resolve(v)),
      (e) => finish(() => reject(e)),
    );
  });
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
      const exec = isIdempotent(init?.method)
        ? tauriHarborFetch(input, init).catch((e) => {
            const blocked = guardRejectionHost(e);
            if (blocked !== null && !isLocalhost(blocked)) throw e;
            return normalizeAbort(tauriFetchImpl(input as string, init as RequestInit) as Promise<Response>);
          })
        : tauriHarborFetch(input, init);
      return withDeadline(exec, init?.signal);
    }
    return normalizeAbort(tauriFetchImpl(input as unknown as string, init as RequestInit) as Promise<Response>);
  }
  if (typeof input === "string") {
    const r = rewriteForWeb(input, init);
    return fetch(r.url, r.init);
  }
  return fetch(input, init);
};
