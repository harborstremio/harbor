// Recognition only needs a modest frame. The previous 960 px frame caused
// unnecessary image decoding and CPU work next to native video playback.
const DETECT_WIDTH = 640;

export async function captureFaceFrame(): Promise<ImageBitmap | null> {
  const isTauri = typeof window !== "undefined" && ("__TAURI__" in window || "__TAURI_INTERNALS__" in window);
  if (!isTauri) return null;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const dataUrl = await invoke<string>("mpv_screenshot_data_url");
    if (!dataUrl) return null;
    const blob = await (await fetch(dataUrl)).blob();
    return await createImageBitmap(blob, { resizeWidth: DETECT_WIDTH, resizeQuality: "medium" });
  } catch {
    return null;
  }
}
