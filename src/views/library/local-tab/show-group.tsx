import { LocalBadge } from "@/components/local-badge";
import { Poster } from "@/components/poster";
import { useT } from "@/lib/i18n";
import { removeLocalEntry, type LocalEntry } from "@/lib/local-library";
import { episodeLabel, localPlayerSrc } from "@/lib/local-library/player-src";
import { openLocalEpisodes } from "@/lib/player/local-episodes-modal";
import { useView } from "@/lib/view";
import { AlertTriangle, CheckSquare, Download, Info, ListVideo, RefreshCw, Square, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";

import { CardIconButton, type LocalCardProps } from "./card-actions";
import { useLocalPoster } from "./use-local-poster";

export { episodeLabel, localPlayerSrc };

export type LocalGroup =
  | { kind: "movie"; entry: LocalEntry }
  | { kind: "show"; key: string; head: LocalEntry; episodes: LocalEntry[] };

export function groupLocal(items: LocalEntry[]): LocalGroup[] {
  const out: LocalGroup[] = [];
  const showIdx = new Map<string, number>();
  for (const it of items) {
    if (it.type !== "show") {
      out.push({ kind: "movie", entry: it });
      continue;
    }
    const key = (it.imdbId || it.title || it.filename).toLowerCase();
    const at = showIdx.get(key);
    if (at != null) {
      (out[at] as { episodes: LocalEntry[] }).episodes.push(it);
    } else {
      showIdx.set(key, out.length);
      out.push({ kind: "show", key, head: it, episodes: [it] });
    }
  }
  for (const g of out) {
    if (g.kind !== "show") continue;
    g.episodes.sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0));
    g.head = g.episodes.find((e) => e.poster) ?? g.episodes[0];
  }
  return out;
}

export function ShowGroupCard({
  head,
  episodes,
  selectMode,
  selected,
  onToggleSelect,
  onFixMatch,
  onExport,
  onOpenDetail,
}: { head: LocalEntry; episodes: LocalEntry[] } & LocalCardProps) {
  const t = useT();
  const { openPlayer } = useView();
  const [confirm, setConfirm] = useState(false);
  const poster = useLocalPoster(head);
  const episodeIds = episodes.map((e) => e.id);
  const isSelected = episodeIds.every((id) => selected.has(id));
  const needsReview = episodes.some((e) => e.needsReview);
  const countLabel = episodes.length === 1 ? t("1 episode") : t("{n} episodes", { n: episodes.length });
  const onActivate = () => {
    if (selectMode) {
      onToggleSelect(episodeIds);
      return;
    }
    openLocalEpisodes({
      title: head.title,
      tmdbId: head.tmdbId ?? null,
      imdbId: head.imdbId ?? null,
      poster: poster.src,
      onPlayLocal: (e) => openPlayer(localPlayerSrc(e)),
    });
  };
  return (
    <div className="group relative flex flex-col gap-2 text-start" onMouseLeave={() => setConfirm(false)}>
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
          seed={head.id}
          lazy
          className="h-full w-full transition-transform duration-200 group-hover:scale-[1.02]"
        />
        <LocalBadge label={t("local")} className="absolute start-2 top-2" />
        <span className="absolute bottom-2 end-2 inline-flex items-center gap-1 rounded-md bg-canvas/85 px-2 py-0.5 text-[10.5px] font-semibold text-ink backdrop-blur-sm">
          <ListVideo size={11} strokeWidth={2.2} />
          {episodes.length}
        </span>
        {needsReview && !selectMode && (
          <span className="absolute bottom-2 start-2 inline-flex items-center gap-1 rounded-md bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-black">
            <AlertTriangle size={9} strokeWidth={2.6} />
            {t("review")}
          </span>
        )}
        {selectMode && (
          <span
            className={`absolute end-2 top-2 flex h-6 w-6 items-center justify-center rounded-md ${
              isSelected ? "bg-accent text-white" : "bg-canvas/80 text-ink-subtle ring-1 ring-edge-soft"
            }`}
          >
            {isSelected ? <CheckSquare size={14} strokeWidth={2.4} /> : <Square size={14} strokeWidth={2.2} />}
          </span>
        )}
        {!selectMode && (
          <>
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-canvas/55 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-canvas shadow-[0_4px_14px_rgba(0,0,0,0.45)]">
                <ListVideo size={18} strokeWidth={2.2} />
              </span>
            </span>
            <div className="absolute end-2 top-2 flex flex-col gap-1.5">
              {(head.tmdbId != null || head.imdbId) && (
                <CardIconButton title={t("Open details")} onClick={() => onOpenDetail(head)}>
                  <Info size={11} strokeWidth={2.2} />
                </CardIconButton>
              )}
              <CardIconButton title={t("Fix match")} onClick={() => onFixMatch(episodes)}>
                <Wand2 size={11} strokeWidth={2.2} />
              </CardIconButton>
              {head.tmdbId != null && (
                <CardIconButton title={t("Export .nfo and artwork")} onClick={() => onExport(episodes)}>
                  <Download size={11} strokeWidth={2.2} />
                </CardIconButton>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm) {
                    episodes.forEach((ep) => removeLocalEntry(ep.id));
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
                {confirm ? <RefreshCw size={11} strokeWidth={2.4} /> : <Trash2 size={11} strokeWidth={2.2} />}
              </button>
            </div>
          </>
        )}
      </div>
      <button type="button" onClick={onActivate} className="text-start">
        <p className="truncate text-[13px] font-medium text-ink transition-colors hover:text-accent" title={head.title}>
          {head.title}
        </p>
        <p className="-mt-1.5 truncate text-[11.5px] text-ink-subtle">{countLabel}</p>
      </button>
    </div>
  );
}
