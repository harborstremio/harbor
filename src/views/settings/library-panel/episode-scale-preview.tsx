import { ImdbIcon } from "@/components/icons/imdb-icon";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { useSettingsPreviewArt } from "@/lib/settings-preview-art";
import { PreviewImage } from "../preview-image";

const BASE_WIDTH = 152;

const EPISODES = [
  {
    n: 6,
    title: "Slow Burn",
    mins: 44,
    rating: "8.4",
    synopsis: "A quiet week on the ward turns when an old case file resurfaces.",
  },
  {
    n: 7,
    title: "The Last Stand",
    mins: 48,
    rating: "8.7",
    synopsis: "With the city surrounded, an unlikely alliance finally forms.",
  },
  {
    n: 8,
    title: "No Way Out",
    mins: 51,
    rating: "9.1",
    synopsis: "Loyalties shatter as the survivors realize who has been lying.",
  },
];

export function EpisodeScalePreview() {
  const { settings } = useSettings();
  const t = useT();
  const art = useSettingsPreviewArt();
  const stills = art?.stills ?? [];
  const scale = settings.episodeCardScale || 1;
  const width = Math.round(BASE_WIDTH * scale);

  return (
    <div className="flex flex-col gap-3 rounded-md border border-edge-soft bg-canvas/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="harbor-settings-label">{t("Live preview")}</span>
        <span className="text-[15.5px] leading-[22px] text-ink-subtle tabular-nums">
          {t("{n}x card width", { n: scale })}
        </span>
      </div>

      <div className="flex gap-3 overflow-hidden">
        {EPISODES.map((ep, i) => (
          <div
            key={ep.n}
            style={{ width }}
            className="shrink-0 overflow-hidden rounded-md bg-elevated/50 ring-1 ring-edge-soft/60 transition-[width] duration-300 ease-in-out motion-reduce:transition-none"
          >
            <div className="relative aspect-video">
              {stills[i] ? (
                <PreviewImage
                  src={stills[i]}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-elevated to-canvas" />
              )}
              <span className="absolute start-1.5 top-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                {ep.n}
              </span>
              {settings.showEpisodeRating && (
                <span className="absolute bottom-1.5 end-1.5 flex items-center gap-1 rounded-md bg-black/70 px-1.5 py-1 backdrop-blur-sm">
                  <ImdbIcon className="h-2.5 w-5" />
                  <span className="text-[10.5px] font-bold tabular-nums text-amber-300">
                    {ep.rating}
                  </span>
                </span>
              )}
            </div>
            <div className="flex flex-col gap-0.5 px-2.5 py-2">
              <span className="truncate text-[12px] font-semibold text-ink">{t(ep.title)}</span>
              <span className="text-[10px] text-ink-subtle">
                E{ep.n} · {t("{n} min", { n: ep.mins })}
              </span>
              {settings.showEpisodeDescription && (
                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-ink-muted">
                  {t(ep.synopsis)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
        {t("Only the card gets wider. The text stays the same size, so bigger cards mean bigger artwork and fewer of them on screen.")}
      </p>
    </div>
  );
}
