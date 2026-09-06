import { Play } from "@/components/icons/play-filled";
import { Plus } from "../icons";
import { useSettings } from "@/lib/settings";
import { useSampleArtwork } from "@/lib/sample-artwork";
import { useT } from "@/lib/i18n";
import { PreviewImage } from "../preview-image";

export function HeroShadowPreview() {
  const { settings } = useSettings();
  const t = useT();
  const art = useSampleArtwork();
  const backdrop = art.background ?? art.poster;

  return (
    <div className="flex flex-col gap-3 rounded-md border border-edge-soft bg-canvas/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="harbor-settings-label">{t("Live preview")}</span>
        <span className="text-[15.5px] leading-[22px] text-ink-subtle tabular-nums">
          {settings.heroShadow}%
        </span>
      </div>

      <div className="relative aspect-[21/9] w-full max-w-[560px] overflow-hidden rounded-md bg-canvas ring-1 ring-edge-soft/60">
        <PreviewImage src={backdrop} className="absolute inset-0 h-full w-full object-cover" />
        <div
          className="absolute inset-0 bg-gradient-to-r from-canvas via-canvas/85 via-50% to-transparent transition-opacity duration-200 ease-out rtl:bg-gradient-to-l motion-reduce:transition-none"
          style={{ opacity: settings.heroShadow / 100 }}
        />
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-canvas via-canvas/70 via-50% to-transparent" />
        <div className="absolute inset-y-0 start-0 flex max-w-[62%] flex-col items-start justify-center gap-2 ps-5">
          {art.logo ? (
            <img
              src={art.logo}
              alt=""
              draggable={false}
              className="max-h-10 w-auto max-w-[70%] object-contain"
            />
          ) : (
            <span className="font-display text-[19px] font-semibold leading-[26px] text-ink">
              {t("The General")}
            </span>
          )}
          <span className="line-clamp-2 max-w-[46ch] text-[12px] leading-[17px] text-ink-muted">
            {t("Buster Keaton sets off to recover his stolen locomotive.")}
          </span>
          <span className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-1.5 text-[11px] font-semibold text-canvas">
              <Play size={11} /> {t("Play")}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/15 px-3 py-1.5 text-[11px] font-semibold text-ink">
              <Plus size={11} strokeWidth={2.6} /> {t("Watchlist")}
            </span>
          </span>
        </div>
      </div>

      <p className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-muted">
        {t("The shadow is what keeps the title and buttons readable. Drop it too far and the text starts fighting the artwork.")}
      </p>
    </div>
  );
}
