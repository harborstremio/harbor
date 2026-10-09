import { Copy, Minus, Square, X } from "lucide-react";
import { toggleWindowFullscreen } from "@/lib/fullscreen-state";
import { useSettings } from "@/lib/settings";
import { useWindowFullscreen } from "@/lib/use-window-fullscreen";
import { close, minimize, toggleMaximize, useMaximized } from "@/lib/window";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function WindowControlButtons({ t }: { t: (key: string) => string }) {
  const { settings } = useSettings();
  const fullscreen = useWindowFullscreen();
  const maximized = useMaximized();
  const maximizeInstead = settings.fullscreenMode === "maximized";
  const expanded = maximizeInstead ? maximized : fullscreen;
  if (!IS_TAURI || settings.useNativeTitleBar) return null;
  return (
    <div className="pointer-events-auto flex items-center gap-1">
      <button
        onClick={minimize}
        aria-label={t("chrome.minimize")}
        className="flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
      >
        <Minus size={16} strokeWidth={2.2} />
      </button>
      <button
        onClick={maximizeInstead ? toggleMaximize : () => void toggleWindowFullscreen()}
        aria-label={
          maximizeInstead
            ? maximized
              ? t("chrome.restore")
              : t("chrome.maximize")
            : fullscreen
              ? t("Exit fullscreen")
              : t("Fullscreen")
        }
        className="flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
      >
        {expanded ? <Copy size={13} strokeWidth={2.2} /> : <Square size={13} strokeWidth={2.2} />}
      </button>
      <button
        onClick={close}
        data-harbor-window-close
        aria-label={t("common.close")}
        className="flex h-9 w-9 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-danger hover:text-white"
      >
        <X size={16} strokeWidth={2.2} />
      </button>
    </div>
  );
}
