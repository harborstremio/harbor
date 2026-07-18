import { MonitorUp } from "lucide-react";
import { useT } from "@/lib/i18n";
import { isWindowsDesktop } from "@/lib/platform";
import { isRtxHdrBlocked } from "@/lib/player/rtx-hdr-policy";
import { isSvpActiveForMedia } from "@/lib/player/svp-policy";
import { useSettings } from "@/lib/settings";
import type { Meta } from "@/lib/cinemeta";
import { BigButton } from "./big-button";
import { StremioBtn } from "./stremio-btn";
import { Tooltip } from "./tooltip";

function useRtxHdr(meta: Meta | undefined) {
  const { settings, update } = useSettings();
  const disabled = isRtxHdrBlocked(settings.playerHdrToSdr, isSvpActiveForMedia(settings, meta));
  const active = settings.playerRtxHdr && !disabled;
  return { active, disabled, toggle: () => update({ playerRtxHdr: !settings.playerRtxHdr }) };
}

export function RtxHdrToggleStremioBtn({ meta }: { meta?: Meta }) {
  const t = useT();
  const { active, disabled, toggle } = useRtxHdr(meta);
  if (!isWindowsDesktop()) return null;
  return (
    <Tooltip label={t("RTX Video HDR")} side="bottom">
      <StremioBtn
        onClick={toggle}
        ariaLabel={t("RTX Video HDR")}
        active={active}
        disabled={disabled}
      >
        <MonitorUp size={26} strokeWidth={2} />
      </StremioBtn>
    </Tooltip>
  );
}

export function RtxHdrToggleBigBtn({ meta }: { meta?: Meta }) {
  const t = useT();
  const { active, disabled, toggle } = useRtxHdr(meta);
  if (!isWindowsDesktop()) return null;
  return (
    <BigButton
      onClick={toggle}
      ariaLabel={t("RTX Video HDR")}
      tooltip={t("RTX Video HDR")}
      active={active}
      disabled={disabled}
    >
      <MonitorUp size={22} strokeWidth={2} />
    </BigButton>
  );
}
