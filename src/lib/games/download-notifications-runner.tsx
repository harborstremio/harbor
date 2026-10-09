import { useEffect, useRef } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useProfiles } from "@/lib/profiles";
import { useT } from "@/lib/i18n";
import { osClass } from "@/lib/platform";
import { mergeDownloadContext } from "./download-context";
import { watchDownloadCompletions, type DownloadCompletionRecord } from "./download-completions";

/** Lives beside the other app runners, including while Games is parked or minimized. */
export function GameDownloadNotificationsRunner() {
  const { activeId } = useProfiles(), profile = activeId ?? "default", t = useT();
  const currentProfile = useRef(profile), translate = useRef(t);
  currentProfile.current = profile; translate.current = t;
  useEffect(() => {
    if (!isTauri() || !["windows", "linux", "macos"].includes(osClass()) || getCurrentWindow().label !== "main") return;
    let current = true;
    let storage: Storage | null = null;
    try { storage = localStorage; } catch { /* Session-only deduplication still works. */ }
    const stop = watchDownloadCompletions(profile, {
      listen: (kind, receive) => listen<DownloadCompletionRecord>(kind === "http" ? "games:transfer" : "games:torrent", event => receive(event.payload)),
      list: kind => invoke<DownloadCompletionRecord[]>(kind === "http" ? "games_list_transfers" : "games_list_torrents", { profile }),
    }, storage, async (kind, record) => {
      const { hasDesktopNotifyPermission, sendDesktopNotification } = await import("@/lib/calendar");
      // Permission is checked only at completion; the runner never opens a permission prompt.
      if (!current || currentProfile.current !== profile || !(await hasDesktopNotifyPermission())) return;
      if (!current || currentProfile.current !== profile) return;
      const item = mergeDownloadContext(kind, record);
      const name = (item.game?.name || item.name).replace(/[\x00-\x1f\x7f]/g, " ").slice(0, 500);
      await sendDesktopNotification(translate.current("games.download.notice.title"), translate.current("games.download.notice.body", { name }));
    });
    return () => { current = false; stop(); };
  }, [profile]);
  return null;
}
