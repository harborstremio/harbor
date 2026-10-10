import { Shuffle } from "lucide-react";
import { HoverTooltip } from "@/components/hover-tooltip";
import type { Meta } from "@/lib/cinemeta";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";

export function AnimeRandomButton({
  episodes,
  metaForEp,
}: {
  episodes: KitsuEpisode[];
  metaForEp: (ep: KitsuEpisode) => Meta;
}) {
  const t = useT();
  const { openPicker } = useView();
  const { settings } = useSettings();
  const onClick = () => {
    const today = new Date().toISOString().slice(0, 10);
    const aired = episodes.filter((e) => !e.airdate || e.airdate.slice(0, 10) <= today);
    const pool = aired.length > 0 ? aired : episodes;
    if (pool.length === 0) return;
    const ep = pool[Math.floor(Math.random() * pool.length)];
    openPicker(
      metaForEp(ep),
      {
        season: ep.seasonNumber || 1,
        episode: ep.number,
        name: ep.title,
        still: ep.thumbnail ?? undefined,
        overview: ep.synopsis || undefined,
        kitsuStreamId: ep.streamId,
        imdbId: ep.imdbId,
        imdbSeason: ep.imdbSeason,
        imdbEpisode: ep.imdbEpisode,
        absoluteNumber: ep.absoluteNumber ?? ep.number,
        tvdbEpisodeId: ep.tvdbEpisodeId,
      },
      { autoPlay: settings.instantPlay || settings.seasonSourceLock },
    );
  };
  return (
    <HoverTooltip label={t("Play a random episode")} align="center" className="shrink-0">
      <button
        type="button"
        onClick={onClick}
        aria-label={t("Play a random episode")}
        className="flex h-9 w-9 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
      >
        <Shuffle size={17} strokeWidth={2} />
      </button>
    </HoverTooltip>
  );
}
