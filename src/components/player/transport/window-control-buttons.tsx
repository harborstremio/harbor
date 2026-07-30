import { Copy, Minus, Square, X } from "lucide-react";
import { useSettings } from "@/lib/settings";
import { close, minimize, toggleMaximize, useMaximized } from "@/lib/window";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function WindowControlButtons({ t }: { t: (key: string) => string }) {
  const { settings } = useSettings();
  const maxed = useMaximized();
  if (!IS_TAURI || settings.useNativeTitleBar) return null;
  return (
    <div className="pointer-events-auto flex items-center gap-1">
      <button
        onClick={minimize}
        aria-label={t("chrome.minimize")}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/85 backdrop-blur-md transition-colors hover:bg-black/70 hover:text-white"
      >
        <Minus size={16} strokeWidth={2.2} />
      </button>
      <button
        onClick={toggleMaximize}
        aria-label={maxed ? t("chrome.restore") : t("chrome.maximize")}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/85 backdrop-blur-md transition-colors hover:bg-black/70 hover:text-white"
      >
        {maxed ? <Copy size={13} strokeWidth={2.2} /> : <Square size={13} strokeWidth={2.2} />}
      </button>
      <button
        onClick={close}
        data-harbor-window-close
        aria-label={t("common.close")}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white/85 backdrop-blur-md transition-colors hover:bg-danger hover:text-white"
      >
        <X size={16} strokeWidth={2.2} />
      </button>
    </div>
  );
}
