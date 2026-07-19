import { useMemo, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { EmptyState, FilteredOutState, NoSourcesState, TheatresEmptyState } from "./empty-states";
import type { usePipelineResult } from "./use-pipeline-result";

type PipelineResult = ReturnType<typeof usePipelineResult>["result"];

export function PickerEmptyLadder({
  meta,
  result,
  addonsSettled,
  pipelineDone,
  streamIds,
  debridCount,
  addonCount,
  allCount,
  rawCount,
  strictMode,
  forceShowAll,
  onOpenLibrarySettings,
  onOpenStreamingSettings,
  onShowAll,
  onSearchWider,
}: {
  meta: Meta;
  result: PipelineResult;
  addonsSettled: boolean;
  pipelineDone: boolean;
  streamIds: string[] | null;
  debridCount: number;
  addonCount: number;
  allCount: number;
  rawCount: number;
  strictMode: boolean;
  forceShowAll: boolean;
  onOpenLibrarySettings: () => void;
  onOpenStreamingSettings: () => void;
  onShowAll: () => void;
  onSearchWider: () => void;
}) {
  const [openedAt] = useState(Date.now);
  const isStillInTheatres = useMemo(() => {
    if (!result || meta.type !== "movie") return false;
    if (allCount > 0) return false;
    if (rawCount === 0) return false;
    const recentRelease = (() => {
      if (meta.releaseDate) {
        const d = new Date(meta.releaseDate);
        if (!Number.isNaN(d.getTime())) {
          const days = (openedAt - d.getTime()) / (1000 * 60 * 60 * 24);
          return days >= -30 && days < 90;
        }
      }
      return meta.inTheaters === true;
    })();
    if (!recentRelease) return false;
    const rejected = result.rejected;
    const trashRejections = rejected.filter(
      (r) =>
        r.reason.startsWith("cinema-window-") ||
        r.reason.startsWith("scam-score-") ||
        r.reason.startsWith("size-too-small-") ||
        r.reason === "dead-torrent-zero-seeders" ||
        r.reason.startsWith("suspicious-extension:"),
    ).length;
    return trashRejections >= Math.max(3, Math.floor(rawCount * 0.5));
  }, [result, meta.type, meta.inTheaters, meta.releaseDate, allCount, rawCount, openedAt]);

  return (
    <>
      {addonsSettled && (!streamIds || streamIds.length === 0) && (
        <EmptyState
          message="Harbor couldn't resolve a usable ID for this title. Add a TMDB key in Library settings or sign in to Stremio to broaden coverage."
          action={{ label: "Open Library settings", onClick: onOpenLibrarySettings }}
        />
      )}
      {addonsSettled &&
        streamIds &&
        streamIds.length > 0 &&
        debridCount === 0 &&
        allCount === 0 && (
          <EmptyState
            message="No playable streams turned up, and no debrid is configured. Real-Debrid, TorBox, AllDebrid, Premiumize, or Debrid-Link will unlock raw torrent results. Some addons bake debrid in (Sootio, Comet/ElfHosted, MediaFusion/ElfHosted) and play without your own keys."
            action={{ label: "Set up a debrid", onClick: onOpenStreamingSettings }}
          />
        )}
      {addonsSettled &&
        streamIds &&
        streamIds.length > 0 &&
        allCount === 0 &&
        debridCount > 0 &&
        rawCount === 0 && (
          <NoSourcesState
            addonCount={addonCount}
            hasDebrid={debridCount > 0}
            streamIds={streamIds}
            isAnime={meta.id.startsWith("kitsu:") || meta.id.startsWith("mal:")}
          />
        )}
      {addonsSettled &&
        streamIds &&
        streamIds.length > 0 &&
        allCount === 0 &&
        debridCount > 0 &&
        rawCount > 0 &&
        isStillInTheatres && (
          <TheatresEmptyState meta={meta} onShowAll={onShowAll} showingAll={forceShowAll} />
        )}
      {addonsSettled &&
        streamIds &&
        streamIds.length > 0 &&
        allCount === 0 &&
        debridCount > 0 &&
        rawCount > 0 &&
        !isStillInTheatres && (
          <FilteredOutState
            rawCount={rawCount}
            rejected={result?.rejected ?? []}
            strictMode={strictMode || !forceShowAll}
            onSearchWider={onSearchWider}
          />
        )}

      {pipelineDone && allCount > 0 && allCount <= 2 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/[0.06] px-5 py-3.5 text-[13px] text-ink">
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="font-semibold text-amber-200">
              {allCount === 1 ? "Only 1 source after filtering" : "Only 2 sources after filtering"}
            </p>
            <p className="text-[12.5px] leading-snug text-ink-muted">
              {allCount === 1
                ? "Clean releases for this title haven't surfaced yet. The result below may not match the title you're looking for, so confirm the filename and size before playing."
                : "Clean releases for this title are still scarce. Confirm the filename and size before playing."}
              {rawCount - allCount > 0 && !forceShowAll
                ? ` Harbor dropped ${rawCount - allCount} suspicious or mismatched result${rawCount - allCount === 1 ? "" : "s"}.`
                : ""}
            </p>
          </div>
          {rawCount - allCount > 0 && !forceShowAll && (
            <button
              onClick={onShowAll}
              className="shrink-0 rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-[12.5px] font-semibold text-amber-100 transition-[transform,background-color] hover:scale-[1.02] hover:bg-amber-300/20 active:scale-[0.98]"
            >
              Show everything anyway
            </button>
          )}
        </div>
      )}
    </>
  );
}
