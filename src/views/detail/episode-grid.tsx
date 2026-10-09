import { useEffect, useMemo, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { useSettings } from "@/lib/settings";
import type { SpoilerMask } from "@/lib/spoilers";
import { EpisodeGridCard } from "./episode-grid-card";
import type { GridEpisode, Progress } from "./episode-grid-types";
import { EpisodePager } from "./episode-pager";

const PAGE_SIZE = 50;

export function EpisodeGrid({
  meta,
  episodes,
  progressFor,
  spoilerFor,
  onContextMenu,
}: {
  meta: Meta;
  episodes: GridEpisode[];
  progressFor: (g: GridEpisode) => Progress;
  spoilerFor?: (g: GridEpisode) => SpoilerMask;
  onContextMenu?: (
    e: React.MouseEvent,
    season: number,
    episode: number,
    watched: boolean,
    sourceMetaId?: string,
  ) => void;
}) {
  const { settings } = useSettings();
  const sort = settings.episodeSort;
  const wrapRef = useRef<HTMLDivElement>(null);
  const displayed = useMemo(
    () => (sort === "newest" ? episodes.slice().reverse() : episodes),
    [episodes, sort],
  );
  const [page, setPage] = useState(0);
  const resetKey = `${sort}:${displayed.length}:${displayed[0]?.key ?? ""}:${displayed[displayed.length - 1]?.key ?? ""}`;
  useEffect(() => setPage(0), [resetKey]);

  const pageCount = Math.max(1, Math.ceil(displayed.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = displayed.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const maxEpisode = useMemo(
    () => episodes.reduce((m, e) => (e.number > m ? e.number : m), 0),
    [episodes],
  );

  const change = (p: number) => {
    setPage(p);
    requestAnimationFrame(() => wrapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const goToEpisode = (n: number) => {
    const idx = displayed.findIndex((e) => e.number === n);
    if (idx >= 0) change(Math.floor(idx / PAGE_SIZE));
  };

  return (
    <div ref={wrapRef} className="flex scroll-mt-24 flex-col gap-5">
      <div
        className="grid gap-x-4 gap-y-6"
        style={{
          gridTemplateColumns: `repeat(auto-fill,minmax(${Math.round(232 * (settings.episodeCardScale || 1))}px,1fr))`,
        }}
      >
        {pageItems.map((g) => (
          <EpisodeGridCard
            key={g.key}
            meta={meta}
            g={g}
            progress={progressFor(g)}
            spoiler={spoilerFor?.(g)}
            onContextMenu={onContextMenu}
          />
        ))}
      </div>
      <EpisodePager
        page={safePage}
        pageCount={pageCount}
        total={displayed.length}
        pageSize={PAGE_SIZE}
        onChange={change}
        onGoToEpisode={goToEpisode}
        maxEpisode={maxEpisode}
      />
    </div>
  );
}
