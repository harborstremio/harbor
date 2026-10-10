import { X } from "lucide-react";
import { useRef } from "react";
import { useOnboarding } from "@/lib/onboarding";
import { useT } from "@/lib/i18n";

const KEY = "edit-profile-hint";

export function EditProfileHint({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const t = useT();
  const { isDismissed, dismiss } = useOnboarding();
  const visible = enabled && !isDismissed(KEY);
  const popoverRef = useRef<HTMLDivElement>(null);

  return (
    <span
      className="relative inline-flex"
      onClickCapture={(e) => {
        if (!visible) return;
        if (popoverRef.current && popoverRef.current.contains(e.target as Node)) return;
        dismiss(KEY);
      }}
    >
      {children}
      {visible && (
        <div ref={popoverRef} className="pointer-events-none absolute bottom-full end-0 z-30 mb-3 flex w-[320px]">
          <div className="pointer-events-auto animate-nudge-in relative flex w-full items-start gap-3 rounded-2xl border border-edge-soft bg-elevated/95 px-4 py-3.5 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.65)] backdrop-blur-md">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="text-[13px] font-semibold text-ink">{t("Make it yours")}</p>
              <p className="text-[12px] leading-snug text-ink-subtle">
                {t("Edit your profile and reorder it your way: pick a font, a background, and drag your cards into the order you like.")}
              </p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                dismiss(KEY);
              }}
              aria-label={t("Dismiss")}
              className="-me-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
            >
              <X size={13} />
            </button>
            <div className="absolute end-10 top-full -mt-1.5 h-3 w-3 rotate-45 border-b border-e border-edge-soft bg-elevated/95" />
          </div>
        </div>
      )}
    </span>
  );
}
