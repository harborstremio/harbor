import { quickGameBadge } from "./library-badges";
import type { QuickGame } from "./quick-library";

export type SidebarStatusIcon = "play" | "running" | "download" | "pause" | "verify" | "repair" | "external" | "saved";
export function sidebarStatus(game: QuickGame, running = false) {
  if (running) return { icon: "running" as const, tone: "ready", key: "games.custom.running", progress: null };
  // A ROM can be present without a configured player.
  const badge = game.source === "retro" && game.local.available && !game.ready
    ? { badge: "needsSetup", tone: "attention", progress: null } : quickGameBadge(game);
  if (badge) {
    const icon: SidebarStatusIcon = badge.badge === "paused" ? "pause" : badge.badge === "validating" ? "verify"
      : ["downloading", "majorUpdate", "updateQueued"].includes(badge.badge) ? "download"
      : badge.badge === "notInstalled" ? "saved" : "repair";
    return { icon, tone: badge.tone, key: `games.badge.${badge.badge}`,
      // Download bytes cannot describe validation progress.
      progress: ["downloading", "paused"].includes(badge.badge) && game.source === "steam" && Number.isFinite(game.install.bytesDownloaded) ? badge.progress : null };
  }
  return { icon: game.source === "launcher" && game.install.launchMode === "client" ? "external" as const : "play" as const,
    tone: "ready", key: game.source === "custom" ? "games.launchHealth.ready" : game.source === "retro" ? "games.sidebar.playerReady"
      : game.source === "launcher" && game.install.launchMode === "client" ? "games.dock.client" : "games.sidebar.launchWith", progress: null };
}
