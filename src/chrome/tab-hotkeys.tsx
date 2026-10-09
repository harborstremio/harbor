import { useEffect } from "react";
import { shouldHandleGlobalKeyboardEvent } from "@/lib/hotkeys";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { applyNavCustomization, useAvailableNavItems } from "./nav-items";
import { usePreviewNavCustomization } from "@/lib/theme-preview";

export function TabHotkeys() {
  const { settings } = useSettings();
  const { view, setView } = useView();
  const items = applyNavCustomization(
    useAvailableNavItems(),
    usePreviewNavCustomization(settings.navCustomization),
  );
  const enabled = settings.tabHotkeys !== false;
  const order = items.map((item) => item.view).filter(Boolean).join(",");
  useEffect(() => {
    if (!enabled) return;
    const views = order.split(",").filter(Boolean);
    if (views.length === 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (!event.ctrlKey || event.metaKey || event.altKey) return;
      if (!shouldHandleGlobalKeyboardEvent(event)) return;
      if (event.key === "Tab") {
        event.preventDefault();
        const at = views.indexOf(view);
        const step = event.shiftKey ? -1 : 1;
        const next = ((at < 0 ? 0 : at + step) + views.length) % views.length;
        setView(views[next] as Parameters<typeof setView>[0]);
        return;
      }
      if (event.shiftKey) return;
      const slot = Number(event.key);
      if (!Number.isInteger(slot) || slot < 1 || slot > 9) return;
      const target = views[slot - 1];
      if (!target) return;
      event.preventDefault();
      setView(target as Parameters<typeof setView>[0]);
    };
    // Capture, because the webview claims Ctrl+Tab before a bubble listener sees it.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled, order, view, setView]);
  return null;
}
