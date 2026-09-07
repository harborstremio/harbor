import { Check, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  subscribeMangaSync,
  type MangaSyncError,
  type MangaSyncEvent,
} from "@/lib/manga/sync";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { syncToastWrapClass } from "@/lib/sync-toast-position";

const SYNC_ERROR_MESSAGES: Record<MangaSyncError, string> = {
  "update-not-confirmed": "Service did not confirm the update.",
  unreachable: "Couldn't reach the tracking service.",
  "title-miss": "Couldn't match this manga on your tracker.",
};

export function MangaSyncToast({ tracker }: { tracker: "anilist" | "mal" }) {
  const t = useT();
  const { settings } = useSettings();
  const [event, setEvent] = useState<MangaSyncEvent | null>(null);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const off = subscribeMangaSync(tracker, (e) => {
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
  }, [tracker]);

  if (!event || !settings.syncIndicator) return null;
  const ok = event.kind === "ok";
  const syncing = event.kind === "syncing";
  const good = ok;

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
              ? t(tracker === "anilist" ? "Syncing to AniList" : "Syncing to MyAnimeList")
              : ok
                ? t(tracker === "anilist" ? "Synced to AniList" : "Synced to MyAnimeList")
                : t("Manga sync")}
          </span>
          <span className="max-w-[300px] truncate text-[12.5px] font-semibold text-ink">
            {event.kind === "error"
              ? t(SYNC_ERROR_MESSAGES[event.error])
              : t("{title} · Chapter {chapter}", { title: event.title, chapter: event.chapter })}
          </span>
        </div>
      </div>
    </div>
  );
}
