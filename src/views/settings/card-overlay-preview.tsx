import { Bookmark } from "./icons";
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
  const watchlist = settings.watchlistBadge;
  const sharesRibbonCorner = settings.top10Ribbon &&
    ((watchlist === "topStart" && ribbonSide === "left") ||
      (watchlist === "topEnd" && ribbonSide === "right"));
  const markCorner = {
    off: "",
    topStart: `${sharesRibbonCorner ? "top-[34px]" : "top-1.5"} start-1.5`,
    topEnd: `${sharesRibbonCorner ? "top-[34px]" : "top-1.5"} end-1.5`,
    bottomStart: "bottom-1.5 start-1.5",
    bottomEnd: "bottom-1.5 end-1.5",
  }[watchlist];
  return (
    <div className="flex flex-col items-center gap-4 rounded-[12px] bg-elevated px-5 py-6">
      <div
        className="relative w-[164px] shrink-0 overflow-hidden rounded-md ring-1 ring-edge-soft"
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
        {watchlist !== "off" && (
          <span
            className={`absolute ${markCorner} flex h-5 w-5 items-center justify-center rounded-full bg-canvas/85 text-ink ring-1 ring-edge-soft/70`}
            title={t("In watchlist")}
          >
            <Bookmark size={10} strokeWidth={2.6} fill="currentColor" />
          </span>
        )}
        {settings.awardTabs && (
          <span
            className={`pointer-events-none absolute start-1/2 z-10 -translate-x-1/2 rtl:translate-x-1/2 ${
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
      <span className="text-center text-[14px] leading-5 text-ink-muted">{t("Ribbon, award and bookmark preview")}</span>
    </div>
  );
}
