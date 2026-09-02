import { AlertTriangle, CheckSquare, Download, Info, Layers, RefreshCw, Square, Trash2, Wand2 } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { memo, useCallback, useMemo, useState } from "react";
import { Poster } from "@/components/poster";
import { removeLocalEntry, type LocalEntry } from "@/lib/local-library";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { LocalBadge } from "@/components/local-badge";
import { CardIconButton, type LocalCardProps } from "./card-actions";
import { episodeLabel, localPlayerSrc } from "./show-group";
import { useLocalPoster } from "./use-local-poster";
import { openLocalVersions } from "@/lib/player/local-versions-modal";

function OwnedCardImpl({
  entry,
  versions,
  selectMode,
  isSelected,
  onToggleSelect,
  onFixMatch,
  onExport,
  onOpenDetail,
}: { entry: LocalEntry; versions: LocalEntry[]; isSelected: boolean } & LocalCardProps) {
  const t = useT();
  const [confirm, setConfirm] = useState(false);
  const { openPlayer } = useView();
  const poster = useLocalPoster(entry);

  const epLabel = episodeLabel(entry);
  const versionCount = versions.length;
  const ids = useMemo(() => versions.map((v) => v.id), [versions]);
  const onActivate = useCallback(
    (range = false) => {
      if (selectMode) {
        onToggleSelect(ids, range);
        return;
      }
      if (versionCount > 1) {
        openLocalVersions({
          title: entry.title,
          poster: poster.src,
          entries: versions,
          onPlayLocal: (v) => openPlayer(localPlayerSrc(v)),
        });
        return;
      }
      openPlayer(localPlayerSrc(entry));
    },
    [selectMode, entry, versions, versionCount, ids, poster.src, openPlayer, onToggleSelect],
  );

  return (
    <div
      className="group relative flex flex-col gap-2 text-start"
      onMouseLeave={() => confirm && setConfirm(false)}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => onActivate(e.shiftKey)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onActivate(e.shiftKey);
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
          className="h-full w-full transition-transform duration-200 will-change-transform [transform:translate3d(0,0,0)] group-hover:scale-[1.02]"
        />
        <LocalBadge label={entry.resolution ?? t("local")} className="absolute start-2 top-2" />
        {versionCount > 1 && (
          <span className="absolute bottom-2 end-2 inline-flex items-center gap-1 rounded-md bg-canvas/85 px-2 py-0.5 text-[10.5px] font-semibold text-ink">
            <Layers size={11} strokeWidth={2.2} />
            {versionCount}
          </span>
        )}
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
              <CardIconButton title={t("Fix match")} onClick={() => onFixMatch(versions)}>
                <Wand2 size={11} strokeWidth={2.2} />
              </CardIconButton>
              {entry.tmdbId != null && (
                <CardIconButton
                  title={t("Export .nfo and artwork")}
                  onClick={() => onExport(versions)}
                >
                  <Download size={11} strokeWidth={2.2} />
                </CardIconButton>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm) {
                    for (const v of versions) removeLocalEntry(v.id);
                    setConfirm(false);
                  } else {
                    setConfirm(true);
                  }
                }}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-white shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-[opacity,background-color] duration-200 ${
                  confirm
                    ? "bg-danger"
                    : "bg-canvas/80 opacity-0 hover:bg-canvas/95 group-hover:opacity-100"
                }`}
                aria-label={
                  confirm
                    ? versionCount > 1
                      ? t("Confirm removing {n} files", { n: versionCount })
                      : t("Confirm remove")
                    : t("Remove from library")
                }
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
      <button type="button" onClick={(e) => onActivate(e.shiftKey)} className="text-start">
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
            {versionCount > 1 && ` · ${t("{n} versions", { n: versionCount })}`}
          </p>
        ) : entry.year != null || versionCount > 1 ? (
          <p className="-mt-1.5 truncate text-[11.5px] text-ink-subtle">
            {entry.year ?? ""}
            {entry.type === "show" && t(" · Series")}
            {versionCount > 1 &&
              `${entry.year != null ? " · " : ""}${t("{n} versions", { n: versionCount })}`}
          </p>
        ) : null}
      </button>
    </div>
  );
}

export const OwnedCard = memo(OwnedCardImpl);
