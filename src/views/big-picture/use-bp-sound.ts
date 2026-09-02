import { useEffect } from "react";
import { SFX } from "@/lib/sfx";
import { useSettings } from "@/lib/settings";

export function useBpSound(active: boolean): void {
  const { settings } = useSettings();
  const bpTheme = settings.bigPictureSound;
  const deskTheme = settings.soundTheme;

  useEffect(() => {
    if (!active) return;
    SFX.setTheme(bpTheme);
    SFX.init();
    return () => {
      SFX.setTheme(deskTheme);
    };
  }, [active, bpTheme, deskTheme]);
}
