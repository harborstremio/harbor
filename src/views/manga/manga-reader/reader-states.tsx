import { ChevronDown, ChevronRight, ChevronUp, Loader2, RefreshCw, X } from "lucide-react";
import { useT } from "@/lib/i18n";

export function ReaderLoading() {
  const t = useT();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-ink-subtle" />
      <span className="text-[13px] text-ink-subtle">{t("Loading chapter...")}</span>
    </div>
  );
}

export function ReaderFailed({ onRetry, onExit }: { onRetry: () => void; onExit: () => void }) {
  const t = useT();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <p className="text-ink-muted">{t("This chapter could not be loaded from this source.")}</p>
      <div className="flex gap-3">
        <button
          onClick={onRetry}
          className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-canvas"
        >
          <RefreshCw className="h-4 w-4" />
          {t("Retry")}
        </button>
        <button
          onClick={onExit}
          className="rounded-xl border border-edge px-5 py-2.5 text-sm font-medium text-ink hover:bg-elevated"
        >
          {t("Back")}
        </button>
      </div>
    </div>
  );
}

export function ReaderComplete({
  atLastChapter,
  label,
  onNext,
  onExit,
}: {
  atLastChapter: boolean;
  label: string;
  onNext: () => void;
  onExit: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-6 px-8 text-center">
      <span className="text-[13px] font-bold uppercase tracking-[0.3em] text-ink-subtle">
        {atLastChapter ? t("All caught up") : t("Chapter complete")}
      </span>
      <span className="font-display text-[38px] font-medium leading-tight text-ink">{label}</span>
      {!atLastChapter ? (
        <button
          onClick={onNext}
          className="flex items-center gap-2.5 rounded-full bg-accent px-10 py-4 text-[17px] font-bold text-canvas shadow-[0_16px_40px_-12px_rgba(0,0,0,0.5)] transition-transform hover:scale-[1.04] active:scale-[0.97]"
        >
          {t("Next chapter")}
          <ChevronRight className="h-6 w-6" strokeWidth={2.6} />
        </button>
      ) : (
        <p className="max-w-sm text-[15px] leading-relaxed text-ink-muted">
          {t("You have reached the latest chapter available.")}
        </p>
      )}
      <button
        onClick={onExit}
        className="text-[14px] font-medium text-ink-subtle transition hover:text-ink"
      >
        {t("Back to details")}
      </button>
    </div>
  );
}

export function EndOfChapterHint({
  visible,
  atLastChapter,
  nextLabel,
  onNext,
  onDismiss,
}: {
  visible: boolean;
  atLastChapter: boolean;
  nextLabel?: string;
  onNext: () => void;
  onDismiss?: () => void;
}) {
  const t = useT();
  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none fixed inset-x-0 bottom-24 z-[85] flex justify-center px-4 transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0.24,1)] motion-reduce:transition-none ${
        visible ? "translate-y-0 opacity-100" : "translate-y-5 opacity-0"
      }`}
    >
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-edge-soft/70 bg-canvas/90 py-2 pe-2 ps-5 shadow-[0_18px_44px_-16px_rgba(0,0,0,0.65)] backdrop-blur-md">
        <span className="flex flex-col leading-tight pe-1">
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            {atLastChapter ? t("All caught up") : t("Chapter finished")}
          </span>
          {!atLastChapter && nextLabel && (
            <span className="max-w-[42vw] truncate text-[12.5px] font-medium text-ink-muted">{nextLabel}</span>
          )}
        </span>
        {!atLastChapter && (
          <button
            type="button"
            onClick={onNext}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-[13.5px] font-bold text-canvas transition-transform duration-150 hover:scale-[1.05] active:scale-95"
          >
            {t("Next chapter")}
            <ChevronRight className="h-4 w-4" strokeWidth={2.8} />
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label={t("Dismiss")}
            title={t("Dismiss")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X className="h-4 w-4" strokeWidth={2.4} />
          </button>
        )}
      </div>
    </div>
  );
}

export function PageNavButton({ dir, onClick }: { dir: "up" | "down"; onClick: () => void }) {
  const t = useT();
  const Icon = dir === "up" ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "up" ? t("Previous page") : t("Next page")}
      className="flex h-14 w-14 items-center justify-center rounded-2xl border border-edge-soft/60 bg-canvas/65 text-ink shadow-[0_8px_24px_-8px_rgba(0,0,0,0.6)] backdrop-blur-md transition-all hover:scale-[1.06] hover:bg-canvas/90"
    >
      <Icon className="h-8 w-8" strokeWidth={2.6} />
    </button>
  );
}
