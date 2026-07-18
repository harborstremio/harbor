import { useEffect } from "react";
import { effectiveBinding, eventToBinding, shouldHandleGlobalKeyboardEvent } from "@/lib/hotkeys";
import { useSearch } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";

export function SearchHotkey() {
  const { setOpen } = useSearch();
  const { settings } = useSettings();
  const binding = effectiveBinding("globalSearchFocus", settings.hotkeys ?? {});
  useEffect(() => {
    const open = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if (!shouldHandleGlobalKeyboardEvent(e)) return;
      if (eventToBinding(e) !== binding) return;
      e.preventDefault();
      open();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("harbor:open-search", open);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("harbor:open-search", open);
    };
  }, [binding, setOpen]);
  return null;
}
