import { useEffect } from "react";
import { useT } from "@/lib/i18n";

export type CastErrorInfo = {
  title: string;
  message: string;
  steps?: string[];
  deviceName?: string;
};

export function CastErrorModal({
  error,
  onDismiss,
}: {
  error: CastErrorInfo | null;
  onDismiss: () => void;
}) {
  const t = useT();
  useEffect(() => {
    if (!error) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [error, onDismiss]);

  if (!error) return null;

  return (
    <div
      data-tv-focus-scope
      className="pointer-events-auto fixed inset-0 z-50 flex animate-[harbor-cast-err-in_180ms_ease-out] items-center justify-center bg-canvas/85 backdrop-blur-md"
    >
      <div
        className="relative mx-6 w-full max-w-[440px] rounded-[20px] border border-edge bg-elevated p-7 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-400/15 text-rose-200">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <div className="flex-1">
            <h2
              className="text-[20px] font-semibold leading-tight text-ink"
              style={{ fontFamily: "Fraunces, serif" }}
            >
              {error.title}
            </h2>
            {error.deviceName && (
              <p className="mt-1 text-[12px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
                {error.deviceName}
              </p>
            )}
          </div>
        </div>
        <p className="text-[14px] leading-relaxed text-ink-muted">{error.message}</p>
        {error.steps && error.steps.length > 0 && (
          <ol className="mt-5 space-y-2.5">
            {error.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-[13.5px] leading-relaxed text-ink">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/20 text-[11.5px] font-semibold text-accent">
                  {i + 1}
                </span>
                <span className="flex-1 pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        )}
        <div className="mt-7 flex justify-end">
          <button
            type="button"
            onClick={onDismiss}
            data-tv-modal-close
            className="rounded-full bg-accent px-5 py-2 text-[13px] font-semibold text-canvas transition-colors hover:bg-accent/85"
            autoFocus
          >
            {t("Got it")}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes harbor-cast-err-in {
          from { opacity: 0; transform: translateY(8px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
