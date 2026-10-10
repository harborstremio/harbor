import { SlidersHorizontal, X } from "lucide-react";
import { useId, useRef } from "react";
import { useT } from "@/lib/i18n";
import { useOnboarding } from "@/lib/onboarding";

const KEY = "sports-personalize-hint";

export function SportsPersonalizeHint({
  active,
  onPersonalize,
}: {
  active: boolean;
  onPersonalize: () => void;
}) {
  const t = useT();
  const { isDismissed, dismiss } = useOnboarding();
  const descriptionId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const visible = active && !isDismissed(KEY);
  const close = () => {
    dismiss(KEY);
    buttonRef.current?.focus({ preventScroll: true });
  };

  return (
    <div
      className="relative inline-flex shrink-0"
      onKeyDown={(event) => {
        if (visible && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="sh-button"
        aria-describedby={visible ? descriptionId : undefined}
        onClick={() => {
          dismiss(KEY);
          onPersonalize();
        }}
      >
        <SlidersHorizontal size={17} aria-hidden="true" />
        {t("Personalize")}
      </button>
      {visible && (
        <div className="pointer-events-none absolute top-full end-0 z-30 mt-3 flex w-[300px] max-w-[calc(100vw-48px)]">
          <div className="pointer-events-auto animate-nudge-in relative flex w-full items-start gap-3 rounded-2xl border border-edge-soft bg-elevated/95 px-4 py-3.5 backdrop-blur-md shadow-[0_18px_50px_-20px_rgba(0,0,0,0.65)]">
            <div id={descriptionId} className="flex min-w-0 flex-1 flex-col gap-1.5">
              <p className="text-[13px] font-semibold text-ink">{t("Make it yours")}</p>
              <p className="text-[12px] leading-snug text-ink-subtle">
                {t("Pick your sports, leagues and teams. We will bring them to the front.")}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label={t("Dismiss")}
              className="-me-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
            >
              <X size={13} aria-hidden="true" />
            </button>
            <div className="absolute bottom-full end-6 -mb-1.5 h-3 w-3 rotate-45 border-s border-t border-edge-soft bg-elevated/95" />
          </div>
        </div>
      )}
    </div>
  );
}
