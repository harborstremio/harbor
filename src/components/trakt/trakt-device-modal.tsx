import { Check, Copy, ExternalLink, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { useTrakt } from "@/lib/trakt/provider";
import { openUrl } from "@/lib/window";

export function TraktDeviceModal({ onClose }: { onClose: () => void }) {
  const { connectState, beginConnect, cancelConnect } = useTrakt();
  const t = useT();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (connectState.kind === "idle") {
      beginConnect();
    }
  }, [connectState.kind, beginConnect]);

  useEffect(() => {
    if (connectState.kind === "success") {
      const id = setTimeout(onClose, 1400);
      return () => clearTimeout(id);
    }
  }, [connectState.kind, onClose]);

  const onCancel = () => {
    cancelConnect();
    onClose();
  };

  const onCopy = async () => {
    if (connectState.kind !== "awaiting") return;
    try {
      await navigator.clipboard.writeText(connectState.device.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      return;
    }
  };

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center bg-black/72 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="flex w-full max-w-[460px] flex-col gap-7 rounded-[24px] border border-edge-soft bg-elevated/95 px-9 py-9 shadow-[0_30px_80px_-25px_rgba(0,0,0,0.85)] animate-in zoom-in-95 fade-in duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[11px] font-bold uppercase tracking-[0.32em] text-ink-subtle">
              {t("Connect Trakt")}
            </span>
            <h2 className="text-[20px] font-medium tracking-tight text-ink">
              {connectState.kind === "success" ? t("Connected") : t("Authorize Harbor on Trakt")}
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-canvas/40 text-ink-subtle transition-colors hover:bg-canvas/60 hover:text-ink"
            aria-label={t("Cancel")}
          >
            <X size={16} />
          </button>
        </div>

        {(connectState.kind === "starting" || connectState.kind === "idle") && (
          <Spinner label={t("Requesting code from Trakt…")} />
        )}

        {connectState.kind === "awaiting" && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2.5">
              <span className="text-[12px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
                {t("Step 1 · Open Trakt")}
              </span>
              <button
                onClick={() => openUrl(connectState.device.verificationUrl)}
                className="flex h-12 items-center justify-between gap-3 rounded-xl border border-edge bg-canvas/40 px-4 text-[14px] font-medium text-ink transition-colors hover:bg-canvas/60"
              >
                <span className="font-mono text-[13.5px] tracking-tight text-ink-muted">
                  {connectState.device.verificationUrl}
                </span>
                <ExternalLink size={15} strokeWidth={2.2} className="shrink-0 text-ink-subtle" />
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              <span className="text-[12px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
                {t("Step 2 · Enter this code")}
              </span>
              <button
                onClick={onCopy}
                className="group flex h-16 items-center justify-between gap-4 rounded-xl border border-edge-soft bg-canvas/55 px-5 transition-colors hover:bg-canvas/75"
              >
                <span className="font-mono text-[28px] font-semibold tracking-[0.18em] text-ink">
                  {connectState.device.userCode}
                </span>
                <span className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle group-hover:text-ink">
                  {copied ? (
                    <>
                      <Check size={13} strokeWidth={2.4} />
                      {t("Copied")}
                    </>
                  ) : (
                    <>
                      <Copy size={13} strokeWidth={2.2} />
                      {t("Copy")}
                    </>
                  )}
                </span>
              </button>
            </div>
            <p className="flex items-center gap-2 text-[12.5px] text-ink-subtle">
              <Loader2 size={12} className="animate-spin" />
              {t("Waiting for you to authorize on trakt.tv…")}
            </p>
          </div>
        )}

        {connectState.kind === "success" && (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-400/10 px-4 py-3 ring-1 ring-emerald-400/30">
            <Check size={16} strokeWidth={2.4} className="text-emerald-300" />
            <span className="text-[14px] text-ink">
              {connectState.session.username
                ? t("Connected as @{username}", { username: connectState.session.username })
                : t("Connected to Trakt")}
            </span>
          </div>
        )}

        {connectState.kind === "expired" && (
          <ErrorBox
            title={t("Code expired")}
            message={t("The authorization code timed out before you finished. Try again.")}
            onRetry={beginConnect}
          />
        )}

        {connectState.kind === "denied" && (
          <ErrorBox
            title={t("Access denied")}
            message={t(
              "Trakt reported that authorization was denied. Try again if this was unintentional.",
            )}
            onRetry={beginConnect}
          />
        )}

        {connectState.kind === "error" && (
          <ErrorBox
            title={t("Couldn't reach Trakt")}
            message={connectState.message}
            onRetry={beginConnect}
          />
        )}
      </div>
    </div>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-[13.5px] text-ink-muted">
      <Loader2 size={14} className="animate-spin" />
      {label}
    </div>
  );
}

function ErrorBox({
  title,
  message,
  onRetry,
}: {
  title: string;
  message: string;
  onRetry: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-red-400/25 bg-red-400/8 p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[14px] font-medium text-ink">{title}</span>
        <span className="text-[12.5px] text-ink-muted">{message}</span>
      </div>
      <button
        onClick={onRetry}
        className="self-start rounded-lg bg-ink px-3.5 py-1.5 text-[12.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97]"
      >
        {t("Try again")}
      </button>
    </div>
  );
}
