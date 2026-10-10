import { invoke } from "@tauri-apps/api/core";

export function isPlaybackRedirectCandidate(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      !parsed.username &&
      !parsed.password &&
      !parsed.port &&
      (parsed.hostname === "addon.debridio.com" || parsed.hostname === "mediafusion.elfhosted.com")
    );
  } catch {
    return false;
  }
}

/** Resolve a selected add-on redirect once so mpv's range seeks go straight to the file. */
export async function resolvePlaybackRedirect({
  url,
  headers,
  signal,
}: {
  url: string;
  headers?: Record<string, string>;
  signal: AbortSignal;
}): Promise<string> {
  if (
    signal.aborted ||
    typeof window === "undefined" ||
    !("__TAURI_INTERNALS__" in window) ||
    (headers && Object.keys(headers).length > 0) ||
    !isPlaybackRedirectCandidate(url)
  ) {
    return url;
  }
  try {
    const resolved = await invoke<string | null>("resolve_playback_redirect", { url });
    if (signal.aborted || !resolved) return url;
    const target = new URL(resolved);
    return target.protocol === "https:" && !target.username && !target.password ? resolved : url;
  } catch {
    // Older native builds, unavailable providers and non-file responses keep
    // the existing mpv path. No resolved signed link is cached or persisted here.
    return url;
  }
}
