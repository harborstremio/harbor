import { Bookmark } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { useSampleArtwork } from "@/lib/sample-artwork";
import { AwardTab } from "@/components/award-tab";
import { TopTenRibbon } from "@/components/top-ten-ribbon";

export function CardOverlayPreview() {
  const { settings } = useSettings();
  const t = useT();
  const art = useSampleArtwork();
  const ribbonSide = settings.top10RibbonSide;
  const markCorner = ribbonSide === "left" ? "end-1.5" : "start-1.5";
  return (
    <div className="mb-5 flex flex-col items-center gap-2 rounded-md border border-edge-soft bg-canvas/40 p-5">
      <div
        className="relative w-32 shrink-0 overflow-hidden rounded-md ring-1 ring-edge-soft"
        style={{ aspectRatio: "2 / 3" }}
      >
        <img
          src={art.poster}
          alt=""
          draggable={false}
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 to-transparent" />
        {settings.top10Ribbon && <TopTenRibbon side={ribbonSide} />}
        {settings.top10Ribbon && (
          <span
            className={`absolute top-1.5 ${markCorner} flex h-5 w-5 items-center justify-center rounded-full bg-canvas/85 text-ink ring-1 ring-edge-soft/70`}
            title={t("In watchlist")}
          >
            <Bookmark size={10} strokeWidth={2.6} fill="currentColor" />
          </span>
        )}
        {settings.awardTabs && (
          <span
            className={`pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 ${
              settings.awardTabPosition === "top"
                ? "top-1.5"
                : settings.awardTabPosition === "below"
                  ? "bottom-1.5"
                  : "bottom-7"
            }`}
          >
            <AwardTab label="TAAF" />
          </span>
        )}
      </div>
      <span className="text-[11.5px] font-medium text-ink-subtle">{t("Live preview")}</span>
    </div>
  );
}
