import { ImageUpscale } from "lucide-react";
import { useT } from "@/lib/i18n";
import { isWindowsDesktop } from "@/lib/platform";
import { isRtxVsrBlocked } from "@/lib/player/rtx-video-policy";
import { isSvpActiveForMedia } from "@/lib/player/svp-policy";
import { useSettings } from "@/lib/settings";
import type { Meta } from "@/lib/cinemeta";
import { StremioBtn } from "./stremio-btn";
import { Tooltip } from "./tooltip";

export function RtxVsrToggleStremioBtn({ meta }: { meta?: Meta }) {
  const t = useT();
  const { settings, update } = useSettings();
  const disabled = isRtxVsrBlocked(isSvpActiveForMedia(settings, meta));
  const active = settings.playerRtxVsr && !disabled;
  if (!isWindowsDesktop()) return null;
  return (
    <Tooltip label={t("RTX Video Super Resolution")} side="bottom">
      <StremioBtn
        onClick={() => update({ playerRtxVsr: !settings.playerRtxVsr })}
        ariaLabel={t("RTX Video Super Resolution")}
        active={active}
        disabled={disabled}
      >
        <ImageUpscale size={26} strokeWidth={2} />
      </StremioBtn>
    </Tooltip>
  );
}
