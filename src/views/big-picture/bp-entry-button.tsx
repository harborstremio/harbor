import { Monitor } from "lucide-react";
import { enterBigPicture } from "@/lib/big-picture";
import { useGamepads } from "@/lib/gamepad/store";
import { useSettings } from "@/lib/settings";
import { useActiveKid } from "@/lib/profiles";
import { SFX } from "@/lib/sfx";
import { useBpT } from "./bp-i18n";
import { shouldOfferBigPicture } from "./bp-logic";

export function BigPictureEntryButton({ hidden }: { hidden?: boolean }) {
  const { settings } = useSettings();
  const t = useBpT();
  const pad = useGamepads().length > 0;
  const kid = useActiveKid();

  const offer = shouldOfferBigPicture({
    kidProfileActive: kid !== null,
    buttonEnabled: settings.bigPictureButton,
    suppressedByChrome: Boolean(hidden),
  });
  if (!offer) return null;

  return (
    <button
      type="button"
      data-focusable="true"
      aria-label={t("Big Picture")}
      onClick={() => {
        SFX.open();
        enterBigPicture();
      }}
      className={`group harbor-chrome-proxy fixed bottom-5 end-[86px] z-[110] flex h-9 items-center gap-0 overflow-hidden rounded-full border border-edge-soft/50 bg-canvas/85 px-2.5 text-ink-muted shadow-[0_10px_30px_-14px_rgba(0,0,0,0.6)] backdrop-blur-md transition-[opacity,color,gap,padding,background-color] duration-200 ease-out hover:gap-2 hover:bg-elevated hover:pe-3.5 hover:text-ink focus-visible:gap-2 focus-visible:bg-elevated focus-visible:pe-3.5 focus-visible:text-ink motion-reduce:transition-none ${
        pad ? "opacity-100" : "opacity-45 hover:opacity-100 focus-visible:opacity-100"
      }`}
    >
      <Monitor size={16} strokeWidth={2} className="shrink-0" />
      <span className="max-w-0 whitespace-nowrap text-[12.5px] font-semibold opacity-0 transition-[max-width,opacity] duration-200 ease-out group-hover:max-w-[120px] group-hover:opacity-100 group-focus-visible:max-w-[120px] group-focus-visible:opacity-100 motion-reduce:transition-none">
        {t("Big Picture")}
      </span>
    </button>
  );
}
