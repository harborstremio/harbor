import { X } from "lucide-react";
import { useRef } from "react";
import { useOnboarding } from "@/lib/onboarding";
import { useSettings } from "@/lib/settings";
import { useView } from "@/lib/view";
import { useT } from "@/lib/i18n";

export function PlayModeHint({ children }: { children: React.ReactNode }) {
  const t = useT();
  const { settings } = useSettings();
  const { isDismissed, dismiss } = useOnboarding();
  const { openSettings } = useView();
  const visible = settings.instantPlay && !isDismissed("play-mode-hint");
  const popoverRef = useRef<HTMLDivElement>(null);

  return (
    <span
      className="relative inline-flex"
      onClickCapture={(e) => {
        if (!visible) return;
        if (popoverRef.current && popoverRef.current.contains(e.target as Node)) return;
        dismiss("play-mode-hint");
      }}
    >
      {children}
      {visible && (
        <div
          ref={popoverRef}
          className="pointer-events-none absolute bottom-full start-0 z-30 mb-3 flex w-[320px]"
        >
          <div className="pointer-events-auto animate-nudge-in relative flex w-full items-start gap-3 rounded-2xl border border-edge-soft bg-elevated/95 px-4 py-3.5 backdrop-blur-md shadow-[0_18px_50px_-20px_rgba(0,0,0,0.65)]">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="text-[13px] font-semibold text-ink">
                {t("Auto-loading the best stream")}
              </p>
              <p className="text-[12px] leading-snug text-ink-subtle">
                {t("Switch to Manual in settings if you'd rather pick the source yourself.")}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openSettings("player");
                }}
                className="self-start text-[12px] font-semibold text-accent transition-colors hover:underline"
              >
                {t("Open settings")}
              </button>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dismiss("play-mode-hint");
              }}
              aria-label={t("Dismiss")}
              className="-me-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
            >
              <X size={13} />
            </button>
            <div className="absolute start-10 top-full -mt-1.5 h-3 w-3 rotate-45 border-b border-e border-edge-soft bg-elevated/95" />
          </div>
        </div>
      )}
    </span>
  );
}
