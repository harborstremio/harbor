import { PanelTop } from "lucide-react";
import { heroDockSupported, useHeroDock } from "@/lib/hero-dock";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { BigButton } from "./big-button";
import { StremioBtn } from "./stremio-btn";
import { Tooltip } from "./tooltip";

/** Shrinks the full player into the hub hero so the viewer can browse while it plays. */
export function HeroDockButton({ variant, editing }: { variant: "big" | "stremio"; editing?: boolean }) {
  const t = useT();
  const { dockPlayer } = useView();
  const docked = useHeroDock();
  // In the hero, the fullscreen button opens the full player instead.
  if (!editing && (docked || !heroDockSupported())) return null;
  const onClick = editing ? undefined : dockPlayer;
  if (variant === "stremio") {
    return (
      <Tooltip label={t("Play in hero")}>
        <StremioBtn onClick={onClick} ariaLabel={t("Play in hero")}>
          <PanelTop size={26} strokeWidth={1.9} />
        </StremioBtn>
      </Tooltip>
    );
  }
  return (
    <BigButton onClick={onClick} ariaLabel={t("Play in hero")} tooltip={t("Play in hero")}>
      <PanelTop size={22} strokeWidth={1.9} />
    </BigButton>
  );
}
