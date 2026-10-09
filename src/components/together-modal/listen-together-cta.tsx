import { Headphones, Plus } from "lucide-react";
import { useT } from "@/lib/i18n";

/**
 * The entry point for a listening room, sitting in the watch modal because that is where
 * people already go to get friends into something. Presentational only: it takes what to
 * show and what to do, so it carries no session logic of its own and cannot disturb the
 * watch room it sits beside.
 */
export function ListenTogetherCta({
  room,
  listeners,
  nowPlaying,
  artwork,
  busy,
  onStart,
  onOpen,
}: {
  room: string | null;
  listeners: number;
  nowPlaying?: { title: string; artist: string } | null;
  artwork?: string | null;
  busy?: boolean;
  onStart: () => void;
  onOpen: () => void;
}) {
  const t = useT();
  const live = !!room;

  return (
    <button
      onClick={live ? onOpen : onStart}
      disabled={busy}
      className="group flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 p-2 text-start transition-colors hover:bg-accent/15 disabled:opacity-50 disabled:hover:bg-accent/10"
    >
      <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md bg-canvas/60 text-accent ring-1 ring-edge-soft/60">
        {artwork ? (
          <img
            src={artwork}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <Headphones size={18} strokeWidth={2.1} aria-hidden="true" />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          {t("Listen together")}
        </span>
        <span className="truncate text-[13px] font-semibold text-ink">
          {live
            ? nowPlaying?.title || t("Nothing playing yet")
            : t("Play music in sync with friends")}
        </span>
        <span className="truncate text-[10.5px] text-ink-subtle">
          {live
            ? nowPlaying?.artist
              ? `${nowPlaying.artist} · ${t("{n} listening", { n: listeners })}`
              : t("{n} listening", { n: listeners })
            : t("Same relay, separate room from your watch party")}
        </span>
      </div>

      <span className="me-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-canvas transition-transform group-hover:scale-105">
        {live ? (
          <Headphones size={14} strokeWidth={2.4} aria-hidden="true" />
        ) : (
          <Plus size={14} strokeWidth={2.4} aria-hidden="true" />
        )}
      </span>
    </button>
  );
}
