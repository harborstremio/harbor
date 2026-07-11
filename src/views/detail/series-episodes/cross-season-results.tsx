import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import { useLocalAwareSeriesPlay } from "@/lib/local-library/use-series-play";
import { useSettings } from "@/lib/settings";
import { useMemo } from "react";

import { EpisodeResultRow } from "./episode-result-row";

type Video = NonNullable<Meta["videos"]>[number];

export function CrossSeasonResults({
  meta,
  videos,
  query,
  imdbId,
}: {
  meta: Meta;
  videos?: Meta["videos"];
  query: string;
  imdbId?: string | null;
}) {
  const t = useT();
  const { settings } = useSettings();
  const playLocalAware = useLocalAwareSeriesPlay();
  const q = query.trim().toLowerCase();

  const results = useMemo<Video[]>(() => {
    if (!videos || !q) return [];
    return videos
      .filter((v) => v.season != null && v.season >= 1 && v.episode != null)
      .filter((v) => {
        const name = (v.name ?? "").toLowerCase();
        return name.includes(q) || String(v.episode).includes(q) || `s${v.season}e${v.episode}`.includes(q);
      })
      .sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0));
  }, [videos, q]);

  if (results.length === 0) {
    return <p className="py-10 text-center text-[14px] text-ink-muted">{t('No episodes match "{q}"', { q: query })}</p>;
  }

  const play = (v: Video) =>
    playLocalAware({
      meta,
      episode: {
        season: v.season ?? 1,
        episode: v.episode ?? 1,
        name: v.name || undefined,
        still: v.thumbnail || undefined,
      },
      opts: { autoPlay: settings.instantPlay || settings.seasonSourceLock },
      imdbId,
      videos,
    });

  return (
    <div className="flex flex-col gap-1.5">
      {results.map((v) => (
        <EpisodeResultRow key={v.id ?? `${v.season}-${v.episode}`} video={v} onPlay={() => play(v)} />
      ))}
    </div>
  );
}
