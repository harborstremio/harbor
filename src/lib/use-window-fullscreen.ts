import { useSyncExternalStore } from "react";

import { getWindowFullscreen, subscribeFullscreen } from "./fullscreen-state";

export function useWindowFullscreen(): boolean {
  return useSyncExternalStore(subscribeFullscreen, getWindowFullscreen, () => false);
}
