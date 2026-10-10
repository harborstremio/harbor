import { safeFetchBytes, FINAL_URL_HEADER } from "@/lib/safe-fetch";
import { ScreenshotCache, SCREENSHOT_MAX_BYTES } from "./screenshot-cache";
import { cacheableScreenshot, screenshotImageHeader } from "./screenshot-image-data";
import { createScreenshotStore } from "./screenshot-store";

async function download(url: string, signal: AbortSignal): Promise<Blob> {
  if (!cacheableScreenshot(url)) throw new Error("Screenshot URL unavailable");
  const controller = new AbortController(), abort = () => controller.abort();
  signal.throwIfAborted();
  // The native byte bridge cannot cancel an in-flight Rust request. Keep its pool
  // slot until that bounded request settles; abandoned views must not fan out work.
  const native = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
  if (!native) signal.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(abort, 20000);
  try {
    const response = await safeFetchBytes(url, { signal: controller.signal, credentials: "omit", cache: "no-store" }, 20000, SCREENSHOT_MAX_BYTES);
    signal.throwIfAborted();
    const final = response.headers.get(FINAL_URL_HEADER) || response.url;
    if (!response.ok || final && !cacheableScreenshot(final) || Number(response.headers.get("content-length")) > SCREENSHOT_MAX_BYTES) throw new Error("Screenshot response unavailable");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("Screenshot body unavailable");
    const chunks: ArrayBuffer[] = []; let size = 0;
    try {
      while (true) { const item = await reader.read(); controller.signal.throwIfAborted(); if (item.done) break; size += item.value.byteLength; if (size > SCREENSHOT_MAX_BYTES) throw new Error("Screenshot too large"); chunks.push(item.value.slice().buffer); }
    } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    return new Blob(chunks);
  } finally { clearTimeout(timer); signal.removeEventListener("abort", abort); controller.abort(); }
}

async function validate(blob: Blob): Promise<Blob> {
  const header = screenshotImageHeader(new Uint8Array(await blob.slice(0, 256 * 1024).arrayBuffer()));
  if (!header) throw new Error("Screenshot format unavailable");
  const image = blob.slice(0, blob.size, header.mime);
  const bitmap = await createImageBitmap(image, { resizeWidth: 32, resizeHeight: 32 });
  bitmap.close();
  return image;
}

export const screenshotImages = new ScreenshotCache(createScreenshotStore(), download, validate);
