import { Check } from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import type { Meta } from "@/lib/cinemeta";
import type { KitsuEpisode } from "@/lib/providers/kitsu";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { useView, type PlayEpisode } from "@/lib/view";

function entryPlayEpisode(ep: KitsuEpisode | undefined): PlayEpisode | undefined {
  if (!ep) return undefined;
  if (ep.streamId != null && ep.streamId.split(":").length < 3) return undefined;
  return {
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
  };
}

export function MovieEntryCard({
  meta,
  ep,
  watched = false,
}: {
  meta: Meta;
  ep: KitsuEpisode | undefined;
  watched?: boolean;
}) {
  const t = useT();
  const { openPicker } = useView();
  const { settings } = useSettings();
  const banner = meta.background || meta.poster;
  return (
    <button
      onClick={() =>
        openPicker(meta, entryPlayEpisode(ep), { autoPlay: settings.instantPlay })
      }
      className="group relative block h-[300px] w-full overflow-hidden rounded-2xl text-start"
    >
      {banner ? (
        <img src={banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-elevated" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-canvas/90 via-canvas/35 to-transparent" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ink text-canvas shadow-[0_8px_28px_rgba(0,0,0,0.4)] transition-transform duration-200 group-hover:scale-105">
          <Play size={24} fill="currentColor" />
        </div>
      </div>
      <span className="absolute bottom-5 start-6 text-[15px] font-semibold text-ink drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
        {t("Play movie")}
      </span>
      {watched && (
        <span className="absolute end-4 top-4 flex items-center gap-1.5 rounded-full bg-success/20 px-2.5 py-1 text-[12px] font-semibold text-success backdrop-blur-sm">
          <Check size={13} strokeWidth={3} />
          {t("Watched")}
        </span>
      )}
    </button>
  );
}
