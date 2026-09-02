import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { subscribeSync, type SyncError, type SyncEvent } from "@/lib/anilist/sync";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { syncToastWrapClass } from "@/lib/sync-toast-position";

const SYNC_ERROR_MESSAGES: Record<SyncError, string> = {
  "update-not-confirmed": "AniList did not confirm the update.",
  unreachable: "Couldn't reach AniList.",
};

export function AnilistSyncToast() {
  const t = useT();
  const { settings } = useSettings();
  const [event, setEvent] = useState<SyncEvent | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const off = subscribeSync((e) => {
      setEvent(e);
      window.clearTimeout(timerRef.current);
      if (e.kind !== "syncing") {
        timerRef.current = window.setTimeout(() => setEvent(null), 4200);
      }
    });
    return () => {
      off();
      window.clearTimeout(timerRef.current);
    };
  }, []);

  if (!event || !settings.syncIndicator) return null;
  const ok = event.kind === "ok";
  const watching = event.kind === "watching";
  const good = ok || watching;
  const syncing = event.kind === "syncing";

  return (
    <div className={syncToastWrapClass(settings.syncIndicatorPosition)}>
      <div className="harbor-together-pill flex items-center gap-2.5 rounded-full border border-edge bg-surface/98 py-2 ps-2.5 pe-4 shadow-[0_24px_60px_-15px_rgba(0,0,0,0.75)] animate-popover-in">
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
            good
              ? "bg-emerald-400/15 text-emerald-300"
              : syncing
                ? "text-ink-muted"
                : "bg-amber-400/15 text-amber-300"
          }`}
        >
          {syncing ? (
            <Loader2 size={13} className="animate-spin" />
          ) : good ? (
            <Check size={13} strokeWidth={2.6} />
          ) : (
            <span className="text-[12px] font-bold">!</span>
          )}
        </span>
        <div className="flex min-w-0 flex-col">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {syncing
              ? t("Syncing to AniList")
              : watching
                ? t("Now watching on AniList")
                : ok
                  ? t("Synced to AniList")
                  : t("AniList sync")}
          </span>
          <span className="max-w-[300px] truncate text-[12.5px] font-semibold text-ink">
            {event.kind === "error"
              ? t(SYNC_ERROR_MESSAGES[event.error])
              : event.kind === "watching"
                ? event.title
                : t("{title} · Episode {episode}", { title: event.title, episode: event.episode })}
          </span>
        </div>
      </div>
    </div>
  );
}
