import { toggleWindowFullscreen } from "@/lib/fullscreen-state";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useWindowFullscreen } from "@/lib/use-window-fullscreen";
import { close, minimize } from "@/lib/window";
import type { ReactNode } from "react";

const IS_TAURI = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function WindowControls() {
  const { settings } = useSettings();
  const fullscreen = useWindowFullscreen();
  const t = useT();
  if (!IS_TAURI || settings.useNativeTitleBar) return null;
  return (
    <div data-tauri-drag-region="false" className="flex items-center gap-2">
      <Ctl label={t("chrome.minimize")} onClick={minimize}>
        <path d="M3 6.5h7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </Ctl>
      <Ctl
        label={fullscreen ? t("chrome.restore") : t("chrome.maximize")}
        onClick={() => void toggleWindowFullscreen()}
      >
        {fullscreen ? (
          <>
            <rect x="2.5" y="4.5" width="6" height="6" stroke="currentColor" strokeWidth="1.4" rx="1" />
            <path
              d="M5 4.5V3a.5.5 0 0 1 .5-.5h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-.5.5H9"
              stroke="currentColor"
              strokeWidth="1.4"
              fill="none"
            />
          </>
        ) : (
          <rect x="3" y="3" width="7" height="7" stroke="currentColor" strokeWidth="1.4" rx="1.2" />
        )}
      </Ctl>
      <Ctl label={t("common.close")} onClick={close} danger>
        <path d="M3.5 3.5l6 6M9.5 3.5l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </Ctl>
    </div>
  );
}

function Ctl({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      data-tauri-drag-region="false"
      className={`flex h-9 w-9 items-center justify-center rounded-full bg-elevated/85 text-ink-muted ring-1 ring-edge-soft/60 backdrop-blur-md transition-colors hover:text-ink ${
        danger ? "hover:bg-danger hover:text-white" : "hover:bg-raised"
      }`}
    >
      <svg width="16" height="16" viewBox="0 0 13 13" fill="none">
        {children}
      </svg>
    </button>
  );
}
