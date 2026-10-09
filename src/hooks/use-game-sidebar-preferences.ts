import { useMemo, useSyncExternalStore } from "react";
import { defaultSidebarPreferences, parseSidebarPreferences, sidebarPreferenceKey, type SidebarPreferences } from "@/lib/games/sidebar-preferences";

const CHANGED = "harbor:game-sidebar-changed";
export function useGameSidebarPreferences(profile: string) {
  const store = useMemo(() => {
    const key = sidebarPreferenceKey(profile);
    let raw: string | null | undefined, value = defaultSidebarPreferences(), error = false;
    let snapshot = { value, error };
    const read = () => {
      try {
        const next = localStorage.getItem(key);
        if (next !== raw) { raw = next; value = parseSidebarPreferences(next); snapshot = { value, error }; }
      } catch { /* Keep session settings if browser storage is unavailable. */ }
      return snapshot;
    };
    return {
      read,
      subscribe(listener: () => void) {
        const changed = (event: Event) => { if (event instanceof StorageEvent ? event.key === key || event.key === null : (event as CustomEvent).detail === key) listener(); };
        window.addEventListener("storage", changed); window.addEventListener(CHANGED, changed);
        return () => { window.removeEventListener("storage", changed); window.removeEventListener(CHANGED, changed); };
      },
      update(change: (current: SidebarPreferences) => SidebarPreferences) {
        const next = parseSidebarPreferences(JSON.stringify(change(read().value)));
        try { const serialized = JSON.stringify(next); localStorage.setItem(key, serialized); raw = serialized; error = false; }
        catch { error = true; }
        value = next; snapshot = { value, error };
        window.dispatchEvent(new CustomEvent(CHANGED, { detail: key }));
      },
    };
  }, [profile]);
  return { ...useSyncExternalStore(store.subscribe, store.read, store.read), update: store.update };
}
