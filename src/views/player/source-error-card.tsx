import { ListVideo, RotateCcw, ServerCrash, WifiOff } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { SourceError } from "./hooks/use-auto-retry";

const STATUS_TEXT: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  408: "Request Timeout",
  410: "Gone",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
};

function describe(status: number): { title: string; detail: string; offline: boolean } {
  if (status === 0)
    return {
      title: "This source didn't respond",
      detail:
        "The provider's server could not be reached. It may be offline, or you have no connection.",
      offline: true,
    };
  if (status >= 500)
    return {
      title: "This source is down",
      detail:
        "The provider's server returned an error. Nothing on Harbor's side can fix this. Pick another source.",
      offline: false,
    };
  if (status >= 400)
    return {
      title: "This source rejected the stream",
      detail:
        "The provider refused the request. The link is likely expired, region locked, or out of quota.",
      offline: false,
    };
  return {
    title: "Harbor couldn't play this source",
    detail: "The source responded but the stream would not open. Try a different one.",
    offline: false,
  };
}

export function SourceErrorCard({
  error,
  onChoose,
  onRetry,
}: {
  error: SourceError;
  onChoose: () => void;
  onRetry: () => void;
}) {
  const t = useT();
  const info = describe(error.status);
  const codeLabel = error.status === 0 ? t("No response") : `HTTP ${error.status}`;
  const statusName = STATUS_TEXT[error.status];

  return (
    <div className="animate-fade-in absolute inset-0 z-40 flex items-center justify-center bg-canvas/85 p-6 backdrop-blur-md">
      <div className="animate-modal-in flex w-[min(94vw,440px)] flex-col items-center gap-5 rounded-2xl border border-edge-soft bg-elevated/95 px-7 py-8 text-center shadow-[0_30px_90px_-25px_rgba(0,0,0,0.7)]">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/12 text-rose-300">
          {info.offline ? (
            <WifiOff size={26} strokeWidth={2} />
          ) : (
            <ServerCrash size={26} strokeWidth={2} />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <h2 className="font-display text-[20px] font-medium text-ink">{t(info.title)}</h2>
          <p className="text-[13.5px] leading-relaxed text-ink-muted">{t(info.detail)}</p>
        </div>
        <div className="flex w-full flex-col gap-1 rounded-xl border border-edge-soft bg-canvas/50 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
              {t("Source said")}
            </span>
            <span className="font-mono text-[13px] font-semibold text-rose-300">
              {codeLabel}
              {statusName ? ` ${statusName}` : ""}
            </span>
          </div>
          {error.host && (
            <div className="truncate text-start font-mono text-[11.5px] text-ink-subtle">
              {error.host}
            </div>
          )}
        </div>
        <div className="flex w-full items-center gap-2.5">
          <button
            type="button"
            onClick={onRetry}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-edge-soft text-[14px] font-semibold text-ink-muted transition-colors hover:border-edge hover:text-ink"
          >
            <RotateCcw size={16} strokeWidth={2.2} />
            {t("Retry")}
          </button>
          <button
            type="button"
            onClick={onChoose}
            className="flex h-11 flex-[1.4] items-center justify-center gap-2 rounded-xl bg-accent text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            <ListVideo size={17} strokeWidth={2.2} />
            {t("Choose another source")}
          </button>
        </div>
      </div>
    </div>
  );
}
