import { useEffect } from "react";
import { Clock, X } from "lucide-react";
import { Poster, usePosterChain } from "@/components/poster";
import type { CalendarItem } from "@/lib/calendar";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { AiringCountdown } from "./airing-countdown";
import { formatDateLong, isUpcoming } from "./utils";

export function DayModal({
  dateISO,
  items,
  onClose,
  onOpenItem,
  hideTypeTag,
}: {
  dateISO: string;
  items: CalendarItem[];
  onClose: () => void;
  onOpenItem: (item: CalendarItem) => void;
  hideTypeTag: boolean;
}) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[140] flex animate-fade-in items-center justify-center bg-canvas/80 backdrop-blur-md"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-[min(92vw,560px)] animate-modal-in flex-col overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_30px_80px_-20px_rgba(0,0,0,0.7)]"
      >
        <header className="flex items-center justify-between gap-4 border-b border-edge-soft px-6 py-5">
          <div className="flex flex-col">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-ink-subtle">
              {t("Releases")}
            </span>
            <h2 className="font-display text-[22px] font-medium tracking-tight text-ink">
              {formatDateLong(dateISO)}
            </h2>
            <span className="mt-0.5 text-[12.5px] text-ink-muted">
              {items.length === 1
                ? t("{n} title", { n: items.length })
                : t("{n} titles", { n: items.length })}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label={t("Close")}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={16} />
          </button>
        </header>
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-3">
          {items.map((item) => (
            <DayModalRow key={item.id} item={item} onOpen={onOpenItem} hideTypeTag={hideTypeTag} />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayModalRow({
  item,
  onOpen,
  hideTypeTag,
}: {
  item: CalendarItem;
  onOpen: (item: CalendarItem) => void;
  hideTypeTag: boolean;
}) {
  const t = useT();
  const { settings } = useSettings();
  const tier = settings.calendarPosterSize;
  const poster = usePosterChain(
    settings.rpdbKey,
    item.id,
    item.poster ?? undefined,
    item.type === "tv" ? "series" : "movie",
  );
  const tag = item.isAnime ? t("Anime") : item.type === "movie" ? t("Movie") : t("TV");
  const tagClass = item.isAnime
    ? "bg-rose-400/20 text-rose-200"
    : item.type === "movie"
      ? "bg-amber-400/20 text-amber-200"
      : "bg-blue-400/20 text-blue-200";
  const posterSizeClass = tier === "large" ? "h-[117px] w-[78px]" : "h-[78px] w-[52px]";
  return (
    <button
      onClick={() => onOpen(item)}
      className="flex items-start gap-3 rounded-xl border border-edge-soft bg-canvas/40 p-3 text-start transition-colors hover:border-edge hover:bg-canvas/65"
    >
      <div className={`shrink-0 overflow-hidden rounded-md bg-elevated/50 ring-1 ring-edge-soft ${posterSizeClass}`}>
        <Poster
          src={poster.src}
          onError={poster.onError}
          seed={item.id}
          ratio="portrait"
          className="h-full w-full"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2">
          {!hideTypeTag && (
            <span
              className={`shrink-0 rounded px-1.5 py-px text-[9.5px] font-bold uppercase tracking-[0.12em] ${tagClass}`}
            >
              {tag}
            </span>
          )}
          {item.voteAverage > 0 && (
            <span className="text-[11px] text-ink-muted">
              <span className="text-amber-300">★</span> {item.voteAverage.toFixed(1)}
            </span>
          )}
        </div>
        <p className="text-[14px] font-semibold leading-tight text-ink">{item.name}</p>
        {item.releaseTime && (
          <p className="text-[11px] font-medium text-ink-subtle">
            <Clock size={11} className="mr-1 inline text-rose-300" />
            {item.releaseTime}
            {isUpcoming(item) && <AiringCountdown atMs={item.releaseAtMs!} />}
          </p>
        )}
        {item.overview && (
          <p className="line-clamp-2 text-[12px] leading-relaxed text-ink-muted">{item.overview}</p>
        )}
      </div>
    </button>
  );
}
