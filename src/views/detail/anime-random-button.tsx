import type { Meta } from "@/lib/cinemeta";
import { useT } from "@/lib/i18n";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { Shuffle } from "lucide-react";

export function AnimeRandomButton({ meta, episodes }: { meta: Meta; episodes: KitsuEpisode[] }) {
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
      meta,
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
      },
      { autoPlay: settings.instantPlay || settings.seasonSourceLock },
    );
  };
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={t("Play a random episode")}
      title={t("Play a random episode")}
      className="flex h-9 w-9 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
    >
      <Shuffle size={17} strokeWidth={2} />
    </button>
  );
}
