import { invoke } from "@tauri-apps/api/core";
import { fetch as tauriFetchImpl } from "@tauri-apps/plugin-http";
import { TrackerBlockedError, isBlockedUrl, noteBlocked } from "./privacy/blocklist";
import { hasSensitiveRequestHeaders, shouldFallbackToPluginHttp } from "./fetch-fallback-policy";
import {
  isSafeProviderSubtitleUrl,
  SUBTITLE_PUBLIC_NETWORK_HEADER,
} from "./subtitles/provider-url";

const SUBTITLE_CREDENTIAL_HEADER = "x-harbor-subtitle-credential";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

declare global {
  interface Window {
    __harborFetchCounts?: BridgeCounts;
  }
}

type BridgeKind = "direct" | "directFail" | "harborFetch" | "pluginHttp";

type BridgeCounts = {
  total: Record<BridgeKind, number>;
  byHost: Record<string, number>;
};

const bridgeCounts: BridgeCounts = {
  total: { direct: 0, directFail: 0, harborFetch: 0, pluginHttp: 0 },
  byHost: {},
};
if (typeof window !== "undefined") window.__harborFetchCounts = bridgeCounts;

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function countCrossing(kind: BridgeKind, url: string): void {
  bridgeCounts.total[kind] += 1;
  let host = "other";
  try {
    host = new URL(String(url)).hostname;
  } catch {}
  const key = `${kind}:${host}`;
  bridgeCounts.byHost[key] = (bridgeCounts.byHost[key] ?? 0) + 1;
}

// Torrentio + TorBox sit behind Cloudflare that blocks datacenter IPs, so on web they
// MUST be fetched directly from the browser's residential IP (they set CORS, so it
// works) — proxying them through the VPS gets 403'd. EVERYTHING ELSE routes through the
// VPS /api-proxy: it's required for addons that send no CORS header at all (OpenSubtitles)
// and for the CORS-less debrid REST APIs, and it's fine for the rest (Cinemeta, Comet).
const DIRECT_HOSTS = new Set(["torrentio.strem.fun", "stremio.torbox.app"]);

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
  "openlibrary.org",
  "covers.openlibrary.org",
  "graphql.anilist.co",
  "www.googleapis.com",
  "www.wikidata.org",
  "api.deepseek.com",
  "api.deezer.com",
  "api.igdb.com",
  "images.igdb.com",
  "store.steampowered.com",
  "cdn.cloudflare.steamstatic.com",
]);
const DEV_PROXY_HOSTS = new Set([
  "graphql.anilist.co",
  "openlibrary.org",
  "covers.openlibrary.org",
  "www.googleapis.com",
  "www.wikidata.org",
  "api.deepseek.com",
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
  ".dzcdn.net",
];

const TAURI_DIRECT_HOSTS = new Set([
  "v3-cinemeta.strem.io",
  "api.ani.zip",
  "anime-kitsu.strem.fun",
  "kitsu.io",
  "api.themoviedb.org",
  "graphql.anilist.co",
]);

const DIRECT_FAIL_LIMIT = 2;
const DIRECT_FAIL_DECAY_MS = 60000;
const directFailures = new Map<string, { count: number; at: number }>();

function directDemoted(host: string): boolean {
  const entry = directFailures.get(host);
  if (!entry) return false;
  if (Date.now() - entry.at >= DIRECT_FAIL_DECAY_MS) {
    directFailures.delete(host);
    return false;
  }
  return entry.count >= DIRECT_FAIL_LIMIT;
}

function noteDirectFailure(host: string): void {
  const now = Date.now();
  const entry = directFailures.get(host);
  const count = entry && now - entry.at < DIRECT_FAIL_DECAY_MS ? entry.count + 1 : 1;
  directFailures.set(host, { count, at: now });
}

export function allowDirectHost(url: string): void {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return;
    TAURI_DIRECT_HOSTS.add(u.hostname);
  } catch {}
}

function tauriDirectHost(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    if (!TAURI_DIRECT_HOSTS.has(host)) return null;
    if (directDemoted(host)) return null;
    return host;
  } catch {
    return null;
  }
}

function isCancellation(e: unknown): boolean {
  const err = e as { name?: string; message?: string } | undefined;
  if (err?.name === "AbortError" || err?.name === "TimeoutError") return true;
  return /request cancell?ed/i.test(err?.message ?? "");
}

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
  const localDev = /^(?:localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
  if (!webProxyAvailable() && !(localDev && DEV_PROXY_HOSTS.has(parsed.hostname)))
    return { url, init };

  const proxied = `/api-proxy/${parsed.hostname}${parsed.pathname}${parsed.search}`;
  if (!init?.headers) return { url: proxied, init };
  const out = new Headers(init.headers as HeadersInit);
  const auth = out.get("authorization");
  if (auth && !localDev) {
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

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function tauriHarborFetch(
  input: string,
  init?: RequestInit,
  responseType?: "base64",
  timeoutMs = 30000,
  maxResponseBytes?: number,
): Promise<Response> {
  countCrossing("harborFetch", input);
  const headers: Record<string, string> = {};
  let credentialHandle: string | undefined;
  let publicNetworkOnly = false;
  if (init?.headers) {
    const h = new Headers(init.headers as HeadersInit);
    h.forEach((v, k) => {
      if (k.toLowerCase() === SUBTITLE_CREDENTIAL_HEADER) {
        credentialHandle = v;
        return;
      }
      if (k.toLowerCase() === SUBTITLE_PUBLIC_NETWORK_HEADER.toLowerCase()) {
        publicNetworkOnly = v === "1" || v.toLowerCase() === "true";
        return;
      }
      headers[k] = v;
    });
  }
  const binaryBody =
    init?.body instanceof ArrayBuffer
      ? new Uint8Array(init.body)
      : ArrayBuffer.isView(init?.body)
        ? new Uint8Array(init.body.buffer, init.body.byteOffset, init.body.byteLength)
        : undefined;
  const body =
    typeof init?.body === "string"
      ? init.body
      : init?.body instanceof URLSearchParams
        ? init.body.toString()
        : init?.body && !binaryBody
          ? JSON.stringify(init.body)
          : undefined;
  const resp = await invoke<HarborFetchResponse>("harbor_fetch", {
    args: {
      url: input,
      method: init?.method ?? "GET",
      headers,
      body,
      bodyBase64: binaryBody ? bytesToBase64(binaryBody) : undefined,
      timeoutMs: 30000,
      ...(timeoutMs === 30000 ? {} : { timeoutMs }),
      responseType,
      maxResponseBytes,
      credentialHandle,
      publicNetworkOnly,
    },
  });
  return new Response(responseType === "base64" ? base64ToBytes(resp.body) : resp.body, {
    status: resp.status,
    headers: resp.headers ?? (resp.contentType ? { "content-type": resp.contentType } : {}),
  });
}

function isIdempotent(method: string | undefined): boolean {
  const m = (method ?? "GET").toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS";
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

function pluginHttpFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  countCrossing("pluginHttp", urlOf(input));
  return normalizeAbort(tauriFetchImpl(input, init) as Promise<Response>);
}

async function materializeRequest(
  input: Request,
  init?: RequestInit,
): Promise<{ url: string; init: RequestInit }> {
  const request = new Request(input, init);
  const method = request.method.toUpperCase();
  const body =
    method !== "GET" && method !== "HEAD" && request.body ? await request.arrayBuffer() : undefined;
  return {
    url: request.url,
    init: {
      method: request.method,
      headers: new Headers(request.headers),
      body,
      signal: request.signal,
      cache: request.cache,
      credentials: request.credentials,
      integrity: request.integrity,
      keepalive: request.keepalive,
      mode: request.mode,
      redirect: request.redirect,
      referrer: request.referrer,
      referrerPolicy: request.referrerPolicy,
    },
  };
}

const HARBOR_FETCH_DEADLINE_MS = 35000;

function withDeadline(
  p: Promise<Response>,
  signal?: AbortSignal | null,
  deadlineMs = HARBOR_FETCH_DEADLINE_MS,
): Promise<Response> {
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
      () =>
        finish(() => reject(new DOMException("harbor_fetch exceeded deadline", "TimeoutError"))),
      deadlineMs,
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

function tauriStringFetch(input: string, init?: RequestInit): Promise<Response> {
  const directHost = hasSensitiveRequestHeaders(init?.headers) ? null : tauriDirectHost(input);
  if (directHost) {
    countCrossing("direct", input);
    const attempt = fetch(input, init)
      .then((res) => {
        directFailures.delete(directHost);
        return res;
      })
      .catch((e: unknown) => {
        if (isCancellation(e)) throw e;
        countCrossing("directFail", input);
        noteDirectFailure(directHost);
        return tauriHarborFetch(input, init);
      });
    return withDeadline(attempt, init?.signal);
  }
  const exec = isIdempotent(init?.method)
    ? tauriHarborFetch(input, init).catch((e: unknown) => {
        if (isCancellation(e)) throw e;
        if (!shouldFallbackToPluginHttp(e, init)) throw e;
        return pluginHttpFetch(input, init);
      })
    : tauriHarborFetch(input, init);
  return withDeadline(exec, init?.signal);
}

function webStringFetch(input: string, init?: RequestInit): Promise<Response> {
  const rewritten = rewriteForWeb(input, init);
  return fetch(rewritten.url, rewritten.init);
}

export const safeFetch: typeof fetch = (input, init) => {
  const target = urlOf(input);
  if (isBlockedUrl(target)) {
    noteBlocked();
    let host = target;
    try {
      host = new URL(target).hostname;
    } catch {}
    return Promise.reject(new TrackerBlockedError(host));
  }
  if (isTauri) {
    if (typeof input === "string") return tauriStringFetch(input, init);
    if (input instanceof URL) return tauriStringFetch(input.href, init);
    return materializeRequest(input, init).then((request) =>
      tauriStringFetch(request.url, request.init),
    );
  }
  if (typeof input === "string") return webStringFetch(input, init);
  if (input instanceof URL) return webStringFetch(input.href, init);
  return materializeRequest(input, init).then((request) =>
    webStringFetch(request.url, request.init),
  );
};

export const safeFetchStream: typeof fetch = (input, init) => {
  const target = typeof input === "string" ? input : input instanceof URL ? input.href : null;
  if (target && isBlockedUrl(target)) {
    noteBlocked();
    return Promise.reject(new TrackerBlockedError(new URL(target).hostname));
  }
  if (isTauri)
    return normalizeAbort(
      tauriFetchImpl(input as unknown as string, init as RequestInit) as Promise<Response>,
    );
  if (typeof input === "string") {
    const rewritten = rewriteForWeb(input, init);
    return fetch(rewritten.url, rewritten.init);
  }
  return fetch(input, init);
};

export function safeFetchBytes(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 30000,
  maxResponseBytes?: number,
): Promise<Response> {
  const target = typeof input === "string" ? input : input instanceof URL ? input.href : null;
  const policyHeaders = new Headers(init?.headers as HeadersInit | undefined);
  const publicNetworkOnly = policyHeaders.get(SUBTITLE_PUBLIC_NETWORK_HEADER) === "1";
  policyHeaders.delete(SUBTITLE_PUBLIC_NETWORK_HEADER);
  const cleanInit = init
    ? {
        ...init,
        headers: policyHeaders,
      }
    : undefined;
  if (publicNetworkOnly && (!target || !isSafeProviderSubtitleUrl(target))) {
    return Promise.reject(new TypeError("blocked non-public provider subtitle target"));
  }
  if (!isTauri || !target) {
    let redirect = cleanInit?.redirect;
    if (
      publicNetworkOnly &&
      (hasSensitiveRequestHeaders(cleanInit?.headers) || /[?&]api_key=/iu.test(target ?? ""))
    ) {
      redirect = "error";
    }
    return safeFetch(input, cleanInit ? { ...cleanInit, redirect } : cleanInit);
  }
  if (isBlockedUrl(target)) {
    noteBlocked();
    return Promise.reject(new TrackerBlockedError(new URL(target).hostname));
  }
  return withDeadline(
    tauriHarborFetch(target, init, "base64", timeoutMs, maxResponseBytes),
    init?.signal,
    timeoutMs + 5_000,
  );
}
