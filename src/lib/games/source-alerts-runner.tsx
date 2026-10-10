import { matchingReleasesAsync } from './source-matches';
import { useEffect, useRef } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useProfiles } from "@/lib/profiles";
import { useT } from "@/lib/i18n";
import { emitListToast } from "@/components/lists/list-toast";
import { claimSourceAlert, readSourceAlerts, recordSourceAlertCheck, SOURCE_ALERT_PREFIX, subscribeSourceAlerts } from "./source-alerts";
import { checkSourceAlerts, SOURCE_ALERT_INTERVAL } from "./source-alert-check";
import { fetchGameSource, fetchWebsiteSource } from "./source-fetch";
import { readSourceCatalogs, readSourceSubscriptions, subscribeSourceStore } from "./source-store";

/** App lifetime, not Games-page lifetime. Closed applications cannot poll local sources. */
export function GameSourceAlertsRunner() {
  const { activeId } = useProfiles(), profile = activeId ?? "default", t = useT();
  const owner = useRef(profile), translate = useRef(t);
  owner.current = profile; translate.current = t;
  useEffect(() => {
    if (isTauri() && getCurrentWindow().label !== "main") return;
    let stopped = false, running = false, again = false, timer: ReturnType<typeof setTimeout> | undefined, signature = "";
    const request = new AbortController(), cursors = new Map<string, number>();
    const current = () => !stopped && owner.current === profile;
    const pending = () => readSourceAlerts(profile).watches.filter(watch => watch.foundAt === undefined);
    const schedule = (delay: number) => { clearTimeout(timer); if (current()) timer = setTimeout(() => void run(), delay); };
    const run = async () => {
      if (!current()) return;
      if (running) { again = true; return; }
      running = true;
      try {
        const watches = pending();
        signature = JSON.stringify(watches.map(watch => watch.id));
        if (!watches.length) return;
        const sources = await readSourceCatalogs(profile, request.signal);
        request.signal.throwIfAborted();
        const result = await checkSourceAlerts(watches, sources, {
          stored: async (source, game, signal) => (await matchingReleasesAsync([source], game, signal)).map(match => match.release),
          catalog: (source, signal) => fetchGameSource(source.url, signal, source.website, source.name, profile),
          website: (source, name, page, signal) => fetchWebsiteSource(source.website!, name, page, signal, true, profile, false),
          yield: () => new Promise(resolve => setTimeout(resolve, 0)),
        }, request.signal, async (watch, source, release) => {
          // Recheck after the network request: removing/disabling/replacing a source wins.
          const latest = await readSourceSubscriptions(profile);
          if (!current() || !latest.some(item => item.id === source.id && item.url === source.url && item.checkedAt === source.checkedAt && item.enabled)) return;
          const notice = claimSourceAlert(profile, watch.id, source, release);
          if (!notice) return;
          const title = translate.current("games.sourceAlerts.noticeTitle", { name: notice.game.name });
          const body = translate.current("games.sourceAlerts.noticeBody", { source: notice.sourceName, title: notice.releaseTitle });
          if (!document.hidden) emitListToast(title);
          const { hasDesktopNotifyPermission, sendDesktopNotification } = await import("@/lib/calendar");
          if (current() && await hasDesktopNotifyPermission() && current()) await sendDesktopNotification(title, body);
        }, cursors);
        if (current()) recordSourceAlertCheck(profile, result.pending, result.failed);
      } catch {
        if (current()) try { recordSourceAlertCheck(profile, pending().map(watch => watch.id), true); } catch { /* UI reports unavailable storage; do not lose the watch. */ }
      } finally {
        running = false;
        schedule(again ? 1_000 : SOURCE_ALERT_INTERVAL); again = false;
      }
    };
    const watchesChanged = () => {
      try {
        const next = JSON.stringify(pending().map(watch => watch.id));
        if (next !== signature) { signature = next; if (running) again = true; else schedule(500); }
      } catch { /* A corrupt or inaccessible store is never overwritten. */ }
    };
    const stopAlerts = subscribeSourceAlerts(changed => { if (changed === profile) watchesChanged(); });
    const stopSources = subscribeSourceStore(changed => { if (changed === profile) { if (running) again = true; else schedule(1_000); } });
    const storage = (event: StorageEvent) => { if (event.key === null || event.key === SOURCE_ALERT_PREFIX + profile) watchesChanged(); };
    const online = () => { if (running) again = true; else schedule(1_000); };
    window.addEventListener("storage", storage); window.addEventListener("online", online);
    schedule(2_000);
    return () => { stopped = true; request.abort(); clearTimeout(timer); stopAlerts(); stopSources(); window.removeEventListener("storage", storage); window.removeEventListener("online", online); };
  }, [profile]);
  return null;
}
