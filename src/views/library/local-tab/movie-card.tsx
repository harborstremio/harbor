import {
  AlertTriangle,
  CheckSquare,
  Download,
  Info,
  Play,
  RefreshCw,
  Square,
  Trash2,
  Wand2,
} from "lucide-react";
import { useCallback, useState } from "react";
import { Poster } from "@/components/poster";
import { removeLocalEntry, type LocalEntry } from "@/lib/local-library";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { LocalBadge } from "@/components/local-badge";
import { CardIconButton, type LocalCardProps } from "./card-actions";
import { episodeLabel, localPlayerSrc } from "./show-group";
import { useLocalPoster } from "./use-local-poster";

export function OwnedCard({
  entry,
  selectMode,
  selected,
  onToggleSelect,
  onFixMatch,
  onExport,
  onOpenDetail,
}: { entry: LocalEntry } & LocalCardProps) {
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  const { openPlayer } = useView();
  const isSelected = selected.has(entry.id);
  const poster = useLocalPoster(entry);

  const epLabel = episodeLabel(entry);
  const onActivate = useCallback(() => {
    if (selectMode) onToggleSelect([entry.id]);
    else openPlayer(localPlayerSrc(entry));
  }, [selectMode, entry, openPlayer, onToggleSelect]);

  return (
    <div
      className="group relative flex flex-col gap-2 text-start"
      onMouseLeave={() => setConfirm(false)}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onActivate}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onActivate();
          }
        }}
        className={`relative aspect-[2/3] cursor-pointer overflow-hidden rounded-xl bg-elevated shadow-[0_2px_8px_-2px_rgba(0,0,0,0.4)] outline-none ring-offset-2 ring-offset-canvas focus-visible:ring-2 focus-visible:ring-ink ${
          isSelected ? "ring-2 ring-accent" : ""
        }`}
      >
        <Poster
          src={poster.src}
          onError={poster.onError}
          seed={entry.id}
          lazy
          className="h-full w-full transition-transform duration-200 group-hover:scale-[1.02]"
        />
        <LocalBadge label={entry.resolution ?? t("local")} className="absolute start-2 top-2" />
        {entry.needsReview && !selectMode && (
          <span className="absolute bottom-2 start-2 inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-black">
            <AlertTriangle size={9} strokeWidth={2.6} />
            {t("review")}
          </span>
        )}
        {selectMode && (
          <span
            className={`absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-md ${
              isSelected
                ? "bg-accent text-white"
                : "bg-canvas/80 text-ink-subtle ring-1 ring-edge-soft"
            }`}
          >
            {isSelected ? (
              <CheckSquare size={14} strokeWidth={2.4} />
            ) : (
              <Square size={14} strokeWidth={2.2} />
            )}
          </span>
        )}
        {!selectMode && (
          <>
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-canvas/55 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-canvas shadow-[0_4px_14px_rgba(0,0,0,0.45)]">
                <Play size={18} strokeWidth={2.4} fill="currentColor" className="ml-0.5" />
              </span>
            </span>
            <div className="absolute end-2 top-2 flex flex-col gap-1.5">
              {(entry.tmdbId != null || entry.imdbId) && (
                <CardIconButton title={t("Open details")} onClick={() => onOpenDetail(entry)}>
                  <Info size={11} strokeWidth={2.2} />
                </CardIconButton>
              )}
              <CardIconButton title={t("Fix match")} onClick={() => onFixMatch([entry])}>
                <Wand2 size={11} strokeWidth={2.2} />
              </CardIconButton>
              {entry.tmdbId != null && (
                <CardIconButton
                  title={t("Export .nfo and artwork")}
                  onClick={() => onExport(entry)}
                >
                  <Download size={11} strokeWidth={2.2} />
                </CardIconButton>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm) {
                    removeLocalEntry(entry.id);
                    setConfirm(false);
                  } else {
                    setConfirm(true);
                  }
                }}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-200 ${
                  confirm
                    ? "bg-danger"
                    : "bg-canvas/70 opacity-0 backdrop-blur-sm hover:bg-canvas/90 group-hover:opacity-100"
                }`}
                aria-label={confirm ? t("Confirm remove") : t("Remove from library")}
              >
                {confirm ? (
                  <RefreshCw size={11} strokeWidth={2.4} />
                ) : (
                  <Trash2 size={11} strokeWidth={2.2} />
                )}
              </button>
            </div>
          </>
        )}
      </div>
      <button type="button" onClick={onActivate} className="text-start">
        <p
          className="truncate text-[13px] font-medium text-ink transition-colors hover:text-accent"
          title={entry.filename}
        >
          {entry.title}
        </p>
        {epLabel ? (
          <p className="-mt-1.5 truncate text-[11.5px] text-ink-subtle">
            {epLabel}
            {entry.year ? ` · ${entry.year}` : ""}
          </p>
        ) : entry.year != null ? (
          <p className="-mt-1.5 truncate text-[11.5px] text-ink-subtle">
            {entry.year}
            {entry.type === "show" && t(" · Series")}
          </p>
        ) : null}
      </button>
    </div>
  );
}
