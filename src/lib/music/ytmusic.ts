import { invoke } from "@tauri-apps/api/core";

/** Opens Google's own YouTube Music in a Harbor webview, reusing the window if it exists. */
export function openYouTubeMusic(): Promise<void> {
  return invoke("ytmusic_open");
}

export function closeYouTubeMusic(): Promise<void> {
  return invoke("ytmusic_close");
}

export function isYouTubeMusicOpen(): Promise<boolean> {
  return invoke<boolean>("ytmusic_is_open");
}

export type YouTubeMusicRect = {
  cssLeft: number;
  cssTop: number;
  cssWidth: number;
  cssHeight: number;
  cssViewW: number;
  cssViewH: number;
};

/**
 * Mounts YouTube Music as a child window inside Harbor's own, pinned to a CSS rect, so the
 * sidebar and title bar stay around it. Windows only; elsewhere the caller falls back to
 * openYouTubeMusic and its separate window.
 */
export function embedYouTubeMusic(geom: YouTubeMusicRect): Promise<void> {
  return invoke("ytmusic_embed", { geom });
}

export function setYouTubeMusicRect(geom: YouTubeMusicRect): Promise<void> {
  return invoke("ytmusic_set_geometry", { geom });
}

export function unembedYouTubeMusic(): Promise<void> {
  return invoke("ytmusic_unembed");
}

/**
 * Harbor keeps an inactive view mounted and display:none's it, which a native child window
 * ignores. The Music view must therefore hide this explicitly when it stops being the top view.
 */
export function setYouTubeMusicVisible(visible: boolean): Promise<void> {
  return invoke("ytmusic_set_visible", { visible });
}
