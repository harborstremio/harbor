import { enterBigPicture } from "@/lib/big-picture";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useActiveKid } from "@/lib/profiles";
import { SFX } from "@/lib/sfx";
import { shouldOfferBigPicture } from "@/views/big-picture/bp-logic";

export function useBigPictureEntry(): { offer: boolean; label: string; open: () => void } {
  const { settings } = useSettings();
  const t = useT();
  const kid = useActiveKid();

  const offer = shouldOfferBigPicture({
    kidProfileActive: kid !== null,
    buttonEnabled: settings.bigPictureButton,
    suppressedByChrome: false,
  });

  return {
    offer,
    label: t("Big Picture"),
    open: () => {
      SFX.open();
      enterBigPicture();
    },
  };
}
