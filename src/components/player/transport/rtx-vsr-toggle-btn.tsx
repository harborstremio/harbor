import { ImageUp } from "lucide-react";
import { useT } from "@/lib/i18n";
import { isWindowsDesktop } from "@/lib/platform";
import { isRtxVsrBlocked } from "@/lib/player/rtx-video-policy";
import { isSvpActiveForMedia } from "@/lib/player/svp-policy";
import { useSettings } from "@/lib/settings";
import type { Meta } from "@/lib/cinemeta";
import { BigButton } from "./big-button";
import { StremioBtn } from "./stremio-btn";
import { Tooltip } from "./tooltip";

function useRtxVsr(meta: Meta | undefined) {
  const { settings, update } = useSettings();
  const disabled = isRtxVsrBlocked(isSvpActiveForMedia(settings, meta));
  const active = settings.playerRtxVsr && !disabled;
  return { active, disabled, toggle: () => update({ playerRtxVsr: !settings.playerRtxVsr }) };
}

export function RtxVsrToggleStremioBtn({ meta }: { meta?: Meta }) {
  const t = useT();
  const { active, disabled, toggle } = useRtxVsr(meta);
  if (!isWindowsDesktop()) return null;
  return (
    <Tooltip label={t("RTX Video Super Resolution")} side="bottom">
      <StremioBtn
        onClick={toggle}
        ariaLabel={t("RTX Video Super Resolution")}
        active={active}
        disabled={disabled}
      >
        <ImageUp size={26} strokeWidth={2} />
      </StremioBtn>
    </Tooltip>
  );
}

export function RtxVsrToggleBigBtn({ meta, iconUrl }: { meta?: Meta; iconUrl?: string }) {
  const t = useT();
  const { active, disabled, toggle } = useRtxVsr(meta);
  if (!isWindowsDesktop()) return null;
  return (
    <BigButton
      onClick={toggle}
      ariaLabel={t("RTX Video Super Resolution")}
      tooltip={t("RTX Video Super Resolution")}
      active={active}
      disabled={disabled}
      iconUrl={iconUrl}
    >
      <ImageUp size={22} strokeWidth={2} />
    </BigButton>
  );
}
