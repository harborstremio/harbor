import { useSettings } from "@/lib/settings";
import { useWindowFullscreen } from "@/lib/use-window-fullscreen";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function useContentDrag(): { "data-tauri-drag-region"?: string } {
  const { settings } = useSettings();
  const fullscreen = useWindowFullscreen();
  // Tauri's bare attribute only handles the container itself, not nested gaps.
  return IS_TAURI && settings.dragAnywhere && !fullscreen
    ? { "data-tauri-drag-region": "deep" }
    : {};
}
