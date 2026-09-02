import { Check, Loader2, PartyPopper, RotateCw, X } from "lucide-react";
import { useT } from "@/lib/i18n";

export const DIAG_STEPS = [
  { id: "mpv", label: "Exporting mpv logs" },
  { id: "render", label: "Exporting render logs" },
  { id: "profiler", label: "Exporting profiler logs" },
  { id: "app", label: "Exporting app logs" },
  { id: "system", label: "Exporting system info" },
  { id: "scrub", label: "Scrubbing secrets" },
  { id: "bundle", label: "Bundling logs" },
  { id: "transmit", label: "Transmitting logs" },
] as const;

export type DiagError = { stage: number; message: string };

function StepRow({
  label,
  state,
  reducedMotion,
}: {
  label: string;
  state: "pending" | "active" | "done" | "failed";
  reducedMotion: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="grid h-6 w-6 shrink-0 place-items-center">
        {state === "done" && (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-accent/15 text-accent">
            <Check size={14} strokeWidth={3} />
          </span>
        )}
        {state === "active" && (
          <Loader2
            size={16}
            className={`text-accent ${reducedMotion ? "" : "animate-spin"}`}
            strokeWidth={2.4}
          />
        )}
        {state === "failed" && (
          <span className="grid h-6 w-6 place-items-center rounded-full bg-danger/15 text-danger">
            <X size={14} strokeWidth={3} />
          </span>
        )}
        {state === "pending" && <span className="h-1.5 w-1.5 rounded-full bg-edge" />}
      </span>
      <span
        className={`text-[13.5px] transition-colors ${
          state === "pending"
            ? "text-ink-subtle"
            : state === "failed"
              ? "text-danger"
              : state === "active"
                ? "text-ink"
                : "text-ink-muted"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export function DiagnosticsProgress({
  stage,
  done,
  error,
  ticket,
  reducedMotion,
  onRetry,
  onClose,
}: {
  stage: number;
  done: boolean;
  error: DiagError | null;
  ticket: string;
  reducedMotion: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const t = useT();
  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        <span
          className="grid h-16 w-16 place-items-center rounded-full bg-accent/15 text-accent"
          style={
            reducedMotion
              ? undefined
              : { animation: "diag-pop 320ms cubic-bezier(0.32,0.72,0.24,1) both" }
          }
        >
          <PartyPopper size={28} strokeWidth={2} />
        </span>
        <div className="flex flex-col gap-1.5">
          <span className="font-display text-[19px] font-medium text-ink">
            {t("Sent. Thanks for the help!")}
          </span>
          <span className="text-[13px] leading-relaxed text-ink-muted">
            {t("We will reply on Issue #{ticket} on GitHub.", { ticket })}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-2 flex h-11 items-center justify-center rounded-xl bg-ink px-6 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          {t("Done")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 px-6 py-6">
      <div className="flex flex-col gap-0.5">
        <span className="font-display text-[17px] font-medium text-ink">
          {t("Sharing your diagnostics")}
        </span>
        <span className="text-[12.5px] text-ink-subtle">{t("Issue #{ticket}", { ticket })}</span>
      </div>

      <div className="flex flex-col">
        {DIAG_STEPS.map((step, i) => {
          const failed = error?.stage === i;
          const state = failed ? "failed" : i < stage ? "done" : i === stage ? "active" : "pending";
          return (
            <StepRow
              key={step.id}
              label={t(step.label)}
              state={state}
              reducedMotion={reducedMotion}
            />
          );
        })}
      </div>

      {error && (
        <div className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger/[0.06] p-3.5">
          <span className="text-[12.5px] leading-relaxed text-ink-muted">{error.message}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRetry}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-ink px-3.5 text-[13px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              <RotateCw size={14} strokeWidth={2.4} /> {t("Retry")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 items-center rounded-lg px-3 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {t("Cancel")}
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes diag-pop { from { opacity: 0; transform: scale(0.8) } to { opacity: 1; transform: none } }`}</style>
    </div>
  );
}
