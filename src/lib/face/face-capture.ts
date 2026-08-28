// Recognition only needs a modest frame. The previous 960 px frame caused
// unnecessary image decoding and CPU work next to native video playback.
const DETECT_WIDTH = 640;

export function imageDataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("invalid image data");

  const header = dataUrl.slice(0, comma);
  const payload = dataUrl.slice(comma + 1);
  const match = /^data:(image\/[a-z0-9.+-]+)(;base64)?$/i.exec(header);
  if (!match) throw new Error("unsupported image data");

  let bytes: Uint8Array;
  if (match[2]) {
    const binary = atob(payload);
    bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } else {
    bytes = new TextEncoder().encode(decodeURIComponent(payload));
  }
  if (bytes.byteLength === 0) throw new Error("empty image data");
  return new Blob([bytes], { type: match[1].toLowerCase() });
}

export async function captureFaceFrame(): Promise<ImageBitmap | null> {
  const isTauri =
    typeof window !== "undefined" && ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);
  if (!isTauri) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const dataUrl = await invoke<string>("mpv_screenshot_data_url");
    if (!dataUrl) return null;
    // Decoding locally is both faster and compatible with the packaged app's
    // CSP. fetch(data:) is governed by connect-src and is intentionally blocked.
    const blob = imageDataUrlToBlob(dataUrl);
    return await createImageBitmap(blob, { resizeWidth: DETECT_WIDTH, resizeQuality: "medium" });
  } catch (error) {
    throw new Error("X-Ray could not capture the video frame", { cause: error });
  }
}
