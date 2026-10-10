import { BadgeCheck, FileText, Loader2, Lock, ShieldCheck, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { fetchDiagnosticsRequest, type DiagnosticsRequestSummary } from "@/lib/social/diagnostics";
import { t as translate, useT } from "@/lib/i18n";

const TRUST_LINE =
  "Harbor will always ask before requesting your logs. We never collect or transmit anything without your explicit consent.";

const SHARED_ITEMS = [
  "mpv playback logs",
  "Render and GPU diagnostics",
  "Performance profiler samples",
  "App and crash logs",
  "System info (OS, version, memory)",
];

function StaffCard({ staff }: { staff: DiagnosticsRequestSummary["staff"] }) {
  const t = useT();
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-edge-soft bg-canvas/40 p-3.5">
      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-elevated text-ink-muted">
        <ShieldCheck size={20} strokeWidth={2} />
        <span className="absolute -end-0.5 -bottom-0.5 grid h-5 w-5 place-items-center rounded-full bg-canvas text-accent">
          <BadgeCheck size={16} strokeWidth={2.4} />
        </span>
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-ink">{staff.name}</span>
          <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-accent">
            {staff.role}
          </span>
        </div>
        <span className="truncate text-[12px] text-ink-subtle">
          @{staff.handle} · {t("Verified Harbor Staff")}
        </span>
      </div>
    </div>
  );
}

export function DiagnosticsConsentModal({
  requestId,
  onShare,
  onClose,
}: {
  requestId: string;
  onShare: (summary: DiagnosticsRequestSummary) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [summary, setSummary] = useState<DiagnosticsRequestSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setSummary(null);
    setError(null);
    fetchDiagnosticsRequest(requestId, ac.signal)
      .then(setSummary)
      .catch((e: unknown) => {
        if (!ac.signal.aborted) {
          setError(e instanceof Error ? e.message : translate("Could not load this request."));
        }
      });
    return () => ac.abort();
  }, [requestId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const ticket = summary?.ticket ?? "";

  return createPortal(
    <div
      className="fixed inset-0 z-[240] grid place-items-center bg-canvas/60 p-4"
      style={{ animation: "diag-scrim-in 160ms ease both" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("Diagnostics request")}
        onClick={(e) => e.stopPropagation()}
        className="harbor-together-surface flex max-h-[86vh] w-[min(460px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-edge shadow-[0_40px_100px_-24px_rgba(0,0,0,0.85)]"
        style={{ animation: "diag-pop-in 220ms cubic-bezier(0.32,0.72,0.24,1) both" }}
      >
        <div className="flex items-center justify-between border-b border-edge-soft px-5 py-3.5">
          <span className="text-[14px] font-semibold tracking-tight text-ink">
            {t("Diagnostics request")}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className="grid h-7 w-7 place-items-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={15} />
          </button>
        </div>

        {!summary && !error && (
          <div className="grid place-items-center px-6 py-16">
            <Loader2 size={20} className="animate-spin text-ink-subtle" />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
            <span className="text-[13px] leading-relaxed text-ink-muted">{error}</span>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 items-center rounded-xl bg-ink px-5 text-[13.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              {t("Close")}
            </button>
          </div>
        )}

        {summary && (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
            <StaffCard staff={summary.staff} />

            <p className="text-[13.5px] leading-relaxed text-ink-muted">
              {t(
                "Sharing your diagnostics for issue #{ticket}. Your session tokens, API keys, and passwords are removed before anything leaves your device.",
                { ticket },
              )}
            </p>

            {summary.note && (
              <div className="flex items-start gap-2.5 rounded-xl border border-edge-soft bg-elevated/40 p-3">
                <FileText size={15} className="mt-0.5 shrink-0 text-ink-subtle" />
                <span className="text-[12.5px] leading-relaxed text-ink-muted">{summary.note}</span>
              </div>
            )}

            <div className="flex flex-col gap-2 rounded-xl border border-edge-soft bg-canvas/30 p-3.5">
              <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
                {t("What is shared")}
              </span>
              <ul className="flex flex-col gap-1.5">
                {SHARED_ITEMS.map((item) => (
                  <li key={item} className="flex items-center gap-2 text-[12.5px] text-ink-muted">
                    <span className="h-1 w-1 shrink-0 rounded-full bg-ink-subtle" />
                    {t(item)}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-start gap-2.5 rounded-xl bg-accent/[0.06] p-3">
              <Lock size={14} className="mt-0.5 shrink-0 text-accent" />
              <span className="text-[12px] leading-relaxed text-ink-muted">{t(TRUST_LINE)}</span>
            </div>
          </div>
        )}

        {summary && (
          <div className="flex items-center gap-2.5 border-t border-edge-soft px-5 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="flex h-11 flex-1 items-center justify-center rounded-xl border border-edge-soft text-[14px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
            >
              {t("Not now")}
            </button>
            <button
              type="button"
              onClick={() => onShare(summary)}
              className="flex h-11 flex-[1.4] items-center justify-center rounded-xl bg-ink text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              {t("Share diagnostics")}
            </button>
          </div>
        )}

        <style>{`
          @keyframes diag-scrim-in { from { opacity: 0 } to { opacity: 1 } }
          @keyframes diag-pop-in { from { opacity: 0; transform: translateY(10px) scale(0.98) } to { opacity: 1; transform: none } }
        `}</style>
      </div>
    </div>,
    document.body,
  );
}
