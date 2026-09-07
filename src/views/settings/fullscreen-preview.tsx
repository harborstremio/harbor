import { useT } from "@/lib/i18n";
import fullscreenStill from "@/assets/settings-preview/sherlock-jr-theater.webp";
import { PlayerPreviewFrame } from "./player-preview-frame";

export function FullscreenPreview({ mode }: { mode: string }) {
  const t = useT();
  const note = mode === "maximized"
    ? t("Fills the screen, but the title bar and taskbar stay.")
    : mode === "borderless"
      ? t("Same coverage, but still a window, so alt-tab stays instant.")
      : t("Covers everything. The taskbar is hidden.");
  return <PlayerPreviewFrame windowed={mode === "maximized"} note={note} imageSrc={fullscreenStill} imagePosition="center top" />;
}
