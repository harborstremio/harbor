import { useEffect } from "react";
import { effectiveBinding, isTypingTarget, matchesBinding } from "@/lib/hotkeys";
import { useSearch } from "@/lib/search-context";
import { useSettings } from "@/lib/settings";

export function SearchHotkey() {
  const { setOpen } = useSearch();
  const { settings } = useSettings();
  const binding = effectiveBinding("globalSearchFocus", settings.hotkeys ?? {});
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return;
      if (!matchesBinding(e, binding)) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [binding, setOpen]);
  return null;
}
