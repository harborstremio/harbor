import type { Settings } from "./types";

export function effectiveOrderProvider(settings: Settings): "tvdb" | "tmdb" {
  return settings.episodeOrderProvider === "tmdb" ? "tmdb" : "tvdb";
}

export function tvdbPanelEnabled(settings: Settings): boolean {
  return settings.tvdbOrderPanel && effectiveOrderProvider(settings) === "tvdb";
}
