import { useEffect, useSyncExternalStore } from "react";
import { useSettings } from "@/lib/settings";
import { customHoverVersion, getCustomHover, subscribeCustomHovers } from "@/lib/custom-hover";

const STYLE_ID = "harbor-custom-hover-css";

export function CustomHoverCssMount() {
  const { settings } = useSettings();
  const version = useSyncExternalStore(
    subscribeCustomHovers,
    customHoverVersion,
    customHoverVersion,
  );

  useEffect(() => {
    const active =
      settings.hoverPreviewEnabled && settings.cardHoverStyle === "custom"
        ? getCustomHover(settings.customHoverId)
        : null;
    const css = active?.css?.trim() ?? "";
    let el = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!css) {
      el?.remove();
      return;
    }
    if (!el) {
      el = document.createElement("style");
      el.id = STYLE_ID;
      document.head.appendChild(el);
    }
    el.textContent = css;
  }, [settings.hoverPreviewEnabled, settings.cardHoverStyle, settings.customHoverId, version]);

  return null;
}
