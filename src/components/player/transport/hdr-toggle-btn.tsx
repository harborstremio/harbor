import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { Contrast } from "lucide-react";

import { BigButton } from "./big-button";
import { StremioBtn } from "./stremio-btn";
import { Tooltip } from "./tooltip";

function useHdrToSdr() {
  const { settings, update } = useSettings();
  const on = settings.playerHdrToSdr;
  return { on, toggle: () => update({ playerHdrToSdr: !on }) };
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
