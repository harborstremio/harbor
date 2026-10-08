import { PanelTop, Wallpaper } from "lucide-react";
import { heroDockSupported, useHeroDock } from "@/lib/hero-dock";
import { useT } from "@/lib/i18n";
import { nativeTvAvailable } from "@/lib/player/native-tv/bridge";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { BigButton } from "./big-button";
import { StremioBtn } from "./stremio-btn";
import { Tooltip } from "./tooltip";

/** Pins the playing video (as the page wallpaper, or in the hub hero) so the viewer can browse while it plays. */
export function HeroDockButton({ variant, editing }: { variant: "big" | "stremio"; editing?: boolean }) {
  const t = useT();
  const { dockPlayer } = useView();
  const docked = useHeroDock();
  const { settings } = useSettings();
  const wallpaper = settings.heroDockMode === "wallpaper" && !nativeTvAvailable();
  const label = wallpaper ? t("Pin to wallpaper") : t("Pin to hero");
  const Icon = wallpaper ? Wallpaper : PanelTop;
  // In the hero, the fullscreen button opens the full player instead.
  if (!editing && (docked || !heroDockSupported())) return null;
  const onClick = editing ? undefined : dockPlayer;
  if (variant === "stremio") {
    return (
      <Tooltip label={label}>
        <StremioBtn onClick={onClick} ariaLabel={label}>
          <Icon size={26} strokeWidth={1.9} />
        </StremioBtn>
      </Tooltip>
    );
  }
  return (
    <BigButton onClick={onClick} ariaLabel={label} tooltip={label}>
      <Icon size={22} strokeWidth={1.9} />
    </BigButton>
  );
}
