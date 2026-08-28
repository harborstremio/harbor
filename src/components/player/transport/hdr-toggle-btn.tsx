import { Contrast } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { effectiveHdrToSdr } from "@/lib/player/hdr-output-policy";
import { useT } from "@/lib/i18n";
import { StremioBtn } from "./stremio-btn";
import { BigButton } from "./big-button";
import { Tooltip } from "./tooltip";

function useHdrToSdr() {
  const { settings, update } = useSettings();
  const on = effectiveHdrToSdr(settings);
  return {
    on,
    toggle: () => update({ playerHdrAuto: false, playerHdrToSdr: !on }),
  };
}

export function HdrToggleStremioBtn() {
  const t = useT();
  const { on, toggle } = useHdrToSdr();
  return (
    <Tooltip label={on ? t("HDR to SDR: On") : t("HDR to SDR: Off")} side="bottom">
      <StremioBtn onClick={toggle} ariaLabel={t("Toggle HDR to SDR")} active={on}>
        <Contrast size={26} strokeWidth={2} />
      </StremioBtn>
    </Tooltip>
  );
}

export function HdrToggleBigBtn() {
  const t = useT();
  const { on, toggle } = useHdrToSdr();
  return (
    <BigButton
      onClick={toggle}
      ariaLabel={t("Toggle HDR to SDR")}
      tooltip={on ? t("HDR to SDR: On") : t("HDR to SDR: Off")}
      active={on}
    >
      <Contrast size={22} />
    </BigButton>
  );
}
