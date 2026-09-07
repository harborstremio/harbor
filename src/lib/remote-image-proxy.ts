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

const blobCache = new Map<string, string>();
// Module scoped, like the blob cache beside it. A failure used to live in
// component state, so every remount re-invoked harbor_fetch for a url already
// known to be dead, and each of those is a bridge crossing carrying a base64
// image body. The in-flight map is for the row where twenty cells share a logo.
const deadUrls = new Set<string>();
const inflight = new Map<string, Promise<string | null>>();

function proxyImage(url: string): Promise<string | null> {
  const cached = blobCache.get(url);
  if (cached) return Promise.resolve(cached);
  if (deadUrls.has(url)) return Promise.resolve(null);
  const existing = inflight.get(url);
  if (existing) return existing;
  const p = (async () => {
    try {
      const auth = suwayomiAuthFor(url);
      const resp = await invoke<HarborFetchResponse>("harbor_fetch", {
        args: {
          url,
          method: "GET",
          responseType: "base64",
          timeoutMs: 30000,
          headers: auth ? { authorization: auth } : undefined,
          allowLocalNetwork: Boolean(auth),
        },
      });
      if (!resp.ok) throw new Error(`status ${resp.status}`);
      const type = resp.headers?.["content-type"] || resp.contentType || "image/jpeg";
      if (type && !type.startsWith("image/")) throw new Error(`type ${type}`);
      const created = URL.createObjectURL(new Blob([base64ToBytes(resp.body)], { type }));
      blobCache.set(url, created);
      return created;
    } catch {
      deadUrls.add(url);
      return null;
    } finally {
      inflight.delete(url);
    }
  })();
  inflight.set(url, p);
  return p;
}

export function useProxiedImageSrc(url: string | undefined): string | undefined {
  const need = !!url && needsImageProxy(url);
  const [blob, setBlob] = useState<string | undefined>(() =>
    url && need ? blobCache.get(url) : undefined,
  );
  const [failed, setFailed] = useState(() => !!url && need && deadUrls.has(url));
  useEffect(() => {
    if (!url || !need) {
      setFailed(false);
      setBlob(undefined);
      return;
    }
    const cached = blobCache.get(url);
    if (cached) {
      setFailed(false);
      setBlob(cached);
      return;
    }
    if (deadUrls.has(url)) {
      setBlob(undefined);
      setFailed(true);
      return;
    }
    setFailed(false);
    setBlob(undefined);
    let alive = true;
    void proxyImage(url).then((created) => {
      if (!alive) return;
      if (created) setBlob(created);
      else setFailed(true);
    });
    return () => {
      alive = false;
    };
  }, [url, need]);
  if (!need) return url;
  // Loading -> undefined (caller shows its placeholder/shimmer). Failed -> the
  // original url so the <img> errors and the caller's fallback/plate logic runs.
  return blob ?? (failed ? url : undefined);
}
