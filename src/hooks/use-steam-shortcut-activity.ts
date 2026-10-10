import { useMemo, useSyncExternalStore } from "react";
import { shortcutActivity } from "@/lib/games/steam-shortcut-activity";

export function useSteamShortcutActivity(profile: string) {
  const store = useMemo(() => shortcutActivity(profile), [profile]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return { store, state };
}
