import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { suwayomiAuthFor } from "@/lib/manga/sources/suwayomi/auth-registry";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

type HarborFetchResponse = {
  status: number;
  ok: boolean;
  body: string;
  contentType?: string | null;
  headers?: Record<string, string>;
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Remote plain-HTTP images are blocked by the WebView as mixed content: the app
// page is a secure context, so http://localhost is exempt but http://<remote>
// is refused (https is fine). Route those through the Rust side and hand back a
// same-origin blob URL. Covers e.g. a Suwayomi server hosted on a VPS over HTTP.
export function needsImageProxy(url: string): boolean {
  if (!isTauri) return false;
  // An <img> tag cannot send an Authorization header, so any server behind
  // basic auth must be fetched through Rust regardless of scheme.
  if (suwayomiAuthFor(url)) return true;
  if (!url.startsWith("http://")) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return !(host === "localhost" || host === "127.0.0.1" || host === "::1" || host.endsWith(".localhost"));
  } catch {
    return false;
  }
}

const MAX_BLOB_CACHE_ENTRIES = 96;

type BlobCacheEntry = {
  src: string;
  refs: number;
  touchedAt: number;
};

const blobCache = new Map<string, BlobCacheEntry>();
const inFlight = new Map<string, Promise<string>>();

function trimBlobCache(keepUrl?: string): void {
  if (blobCache.size <= MAX_BLOB_CACHE_ENTRIES) return;
  const evictable = [...blobCache.entries()]
    .filter(([url, entry]) => entry.refs === 0 && url !== keepUrl)
    .sort((a, b) => a[1].touchedAt - b[1].touchedAt);
  for (const [url, entry] of evictable) {
    if (blobCache.size <= MAX_BLOB_CACHE_ENTRIES) break;
    blobCache.delete(url);
    URL.revokeObjectURL(entry.src);
  }
}

function retain(url: string): BlobCacheEntry | undefined {
  const entry = blobCache.get(url);
  if (!entry) return undefined;
  entry.refs += 1;
  entry.touchedAt = Date.now();
  return entry;
}

function release(url: string, entry: BlobCacheEntry): void {
  if (blobCache.get(url) !== entry) return;
  entry.refs = Math.max(0, entry.refs - 1);
  entry.touchedAt = Date.now();
  trimBlobCache();
}

function loadProxiedImage(url: string): Promise<string> {
  const cached = blobCache.get(url);
  if (cached) {
    cached.touchedAt = Date.now();
    return Promise.resolve(cached.src);
  }
  const pending = inFlight.get(url);
  if (pending) return pending;

  let request!: Promise<string>;
  request = (async () => {
    const auth = suwayomiAuthFor(url);
    const resp = await invoke<HarborFetchResponse>("harbor_fetch", {
      args: {
        url,
        method: "GET",
        responseType: "base64",
        timeoutMs: 30000,
        headers: auth ? { authorization: auth } : undefined,
      },
    });
    if (!resp.ok) throw new Error(`status ${resp.status}`);
    const type = resp.headers?.["content-type"] || resp.contentType || "image/jpeg";
    if (type && !type.startsWith("image/")) throw new Error(`type ${type}`);
    const src = URL.createObjectURL(new Blob([base64ToBytes(resp.body)], { type }));
    blobCache.set(url, { src, refs: 0, touchedAt: Date.now() });
    trimBlobCache(url);
    return src;
  })();
  inFlight.set(url, request);
  const clear = () => {
    if (inFlight.get(url) === request) inFlight.delete(url);
  };
  void request.then(clear, clear);
  return request;
}

export function useProxiedImageSrc(url: string | undefined): string | undefined {
  const need = !!url && needsImageProxy(url);
  const [blob, setBlob] = useState<string | undefined>(() =>
    url && need ? blobCache.get(url)?.src : undefined,
  );
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
    if (!url || !need) {
      setBlob(undefined);
      return;
    }
    const cached = retain(url);
    if (cached) {
      setBlob(cached.src);
      return () => release(url, cached);
    }
    setBlob(undefined);
    let alive = true;
    let retained: BlobCacheEntry | undefined;
    void loadProxiedImage(url)
      .then((src) => {
        if (!alive) return;
        retained = retain(url);
        if (retained) setBlob(src);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      if (retained) release(url, retained);
    };
  }, [url, need]);
  if (!need) return url;
  // Loading -> undefined (caller shows its placeholder/shimmer). Failed -> the
  // original url so the <img> errors and the caller's fallback/plate logic runs.
  return blob ?? (failed ? url : undefined);
}
