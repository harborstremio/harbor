import { Shuffle } from "lucide-react";
import { HoverTooltip } from "@/components/hover-tooltip";
import type { Meta } from "@/lib/cinemeta";
import type { Season } from "@/lib/providers/tmdb";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";

function pickRandomEpisode(seasons: Season[]): { season: number; episode: number } | null {
  const today = new Date().toISOString().slice(0, 10);
  const real = seasons.filter((s) => s.seasonNumber >= 1 && s.episodeCount > 0);
  const aired = real.filter((s) => !s.airDate || s.airDate.slice(0, 10) <= today);
  const pool = aired.length > 0 ? aired : real;
  const total = pool.reduce((n, s) => n + s.episodeCount, 0);
  if (total === 0) return null;
  let r = Math.floor(Math.random() * total);
  for (const s of pool) {
    if (r < s.episodeCount) return { season: s.seasonNumber, episode: r + 1 };
    r -= s.episodeCount;
  }
  return null;
}

export function RandomEpisodeButton({ meta, seasons }: { meta: Meta; seasons: Season[] }) {
  const t = useT();
  const { openPicker } = useView();
  const { settings } = useSettings();
  const onClick = () => {
    const pick = pickRandomEpisode(seasons);
    if (!pick) return;
    openPicker(meta, pick, { autoPlay: settings.instantPlay || settings.seasonSourceLock });
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
