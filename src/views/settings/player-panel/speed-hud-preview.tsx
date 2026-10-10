import { useT } from "@/lib/i18n";
import type { VolumeHudPosition } from "@/components/player/volume-indicator";
import { SpeedIndicator } from "@/components/player/speed-indicator";
import { PlayerPreviewFrame } from "../player-preview-frame";

export function SpeedHudPreview({ position }: { position: VolumeHudPosition }) {
  const t = useT();
  const note =
    position === "center"
      ? t("Right in the middle of the picture, hard to miss.")
      : position === "top"
        ? t("Centered along the top edge, clear of the subtitles.")
        : t("Tucked into the upper corner, clear of the subtitles.");
  return (
    <PlayerPreviewFrame note={note} sampleIndex={15}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="hset-player-preview-stage">
        <SpeedIndicator state={{ visible: true, rate: 1.5 }} position={position} />
      </div>
    </PlayerPreviewFrame>
  );
}
