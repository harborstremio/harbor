import { Monitor } from "lucide-react";
import { enterBigPicture } from "@/lib/big-picture";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useActiveKid } from "@/lib/profiles";
import { SFX } from "@/lib/sfx";
import { shouldOfferBigPicture } from "@/views/big-picture/bp-logic";

export function SidebarBigPictureEntry({ collapsed }: { collapsed: boolean }) {
  const { settings } = useSettings();
  const t = useT();
  const kid = useActiveKid();
  const label = t("Big Picture");

  const offer = shouldOfferBigPicture({
    kidProfileActive: kid !== null,
    buttonEnabled: settings.bigPictureButton,
    suppressedByChrome: false,
  });
  if (!offer) return null;

  return (
    <button
      type="button"
      data-focusable="true"
      onClick={() => {
        SFX.open();
        enterBigPicture();
      }}
      aria-label={label}
      title={label}
      className={`flex h-9 items-center justify-center gap-2.5 rounded-lg text-ink-subtle transition-colors hover:bg-elevated/60 hover:text-ink-muted ${
        collapsed ? "w-9" : "w-full lg:justify-start lg:px-3"
      }`}
    >
      <Monitor size={17} strokeWidth={1.8} className="shrink-0" />
      {!collapsed && <span className="hidden text-[13px] font-medium lg:inline">{label}</span>}
    </button>
  );
}
