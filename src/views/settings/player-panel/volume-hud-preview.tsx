import { useT } from "@/lib/i18n";
import volumeStill from "@/assets/settings-preview/a-trip-to-the-moon.webp";
import { VolumeIndicator, type VolumeHudPosition } from "@/components/player/volume-indicator";
import { PlayerPreviewFrame } from "../player-preview-frame";

export function VolumeHudPreview({ position, enabled = true }: { position: VolumeHudPosition; enabled?: boolean }) {
  const t = useT();
  const note = !enabled ? t("The volume pop-up is hidden.")
    : position === "center" ? t("Right in the middle of the picture, hard to miss.")
      : position === "top" ? t("Centered along the top edge, clear of the subtitles.")
        : t("Tucked into the upper corner, clear of the subtitles.");
  return (
    <PlayerPreviewFrame note={note} imageSrc={volumeStill}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="hset-player-preview-stage">
        <VolumeIndicator state={{ visible: enabled, volume: 0.62, muted: false }} allowBoost={false} position={position} />
      </div>
    </PlayerPreviewFrame>
  );
}
