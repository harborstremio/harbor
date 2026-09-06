import { invoke } from "@tauri-apps/api/core";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const MEASURE_TIMEOUT_MS = 8000;

export const IMAGE_FALLBACK_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

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

export async function fetchImageObjectUrl(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 30000,
): Promise<string> {
  const resp = await invoke<HarborFetchResponse>("harbor_fetch", {
    args: { url, method: "GET", headers, responseType: "base64", timeoutMs },
  });
  if (!resp.ok) throw new Error(`status ${resp.status}`);
  const type = resp.headers?.["content-type"] || resp.contentType || "";
  if (type && !type.startsWith("image/")) throw new Error(`type ${type}`);
  const blob = new Blob([base64ToBytes(resp.body)], { type: type || "image/jpeg" });
  return URL.createObjectURL(blob);
}

function aspectOf(src: string): Promise<number | null> {
  return new Promise((resolve) => {
    const img = new Image();
    const timeout = window.setTimeout(() => finish(null), MEASURE_TIMEOUT_MS);
    const finish = (aspect: number | null) => {
      window.clearTimeout(timeout);
      img.onload = null;
      img.onerror = null;
      resolve(aspect);
    };
    img.onload = () => finish(img.naturalHeight / (img.naturalWidth || 1));
    img.onerror = () => finish(null);
    img.src = src;
  });
}

export async function measureAspect(src?: string): Promise<number> {
  if (!src) return 1.4;
  const direct = await aspectOf(src);
  if (direct != null) return direct;
  if (!isTauri) return 1.4;
  let obj: string | null = null;
  try {
    obj = await fetchImageObjectUrl(src, IMAGE_FALLBACK_HEADERS, MEASURE_TIMEOUT_MS);
    return (await aspectOf(obj)) ?? 1.4;
  } catch {
    return 1.4;
  } finally {
    if (obj) URL.revokeObjectURL(obj);
  }
}

export async function detectWebtoon(urls: string[]): Promise<boolean> {
  if (!urls.length) return false;
  const samples = [urls[0], urls[Math.floor(urls.length / 2)]].filter(Boolean);
  const aspects = await Promise.all(samples.map((s) => measureAspect(s)));
  return Math.max(...aspects) >= 2.2;
}
