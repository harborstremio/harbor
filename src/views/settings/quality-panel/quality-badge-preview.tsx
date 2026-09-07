import { useT } from "@/lib/i18n";
import { QualityBadgeDisplay } from "@/components/player/transport/quality-badge";
import { PlayerPreviewFrame } from "../player-preview-frame";

export function QualityBadgePreview({ style, enabled = true }: { style: string; enabled?: boolean }) {
  const t = useT();
  return (
    <PlayerPreviewFrame note={!enabled ? t("Stream details are hidden.") : style === "chips" ? t("Small outlined pills that slide in under the title.") : t("An accent line down the side, with each line revealed as it arrives.")}>
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/20 to-transparent" />
      <div className="absolute inset-x-4 top-4 flex flex-col gap-2.5 text-white">
        <span className="text-[15px] font-semibold leading-5">The Toll of the Sea</span>
        {enabled && <div className="flex flex-wrap gap-1.5"><QualityBadgeDisplay items={["1080p", "H.264", "AAC"]} show bar={style !== "chips"} /></div>}
      </div>
    </PlayerPreviewFrame>
  );
}
