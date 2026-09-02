import { Check, Copy, ExternalLink, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useState, useRef } from "react";
import { ModalShell, useModalExit } from "@/components/modal-shell";
import { useT } from "@/lib/i18n";
import { useSimkl } from "@/lib/simkl/provider";
import { openUrl } from "@/lib/window";

export function SimklDeviceModal({ onClose }: { onClose: () => void }) {
  const { connectState, beginConnect, cancelConnect } = useSimkl();
  const t = useT();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (connectState.kind === "idle") {
      beginConnect();
    }
  }, [connectState.kind, beginConnect]);

  const doneRef = useRef(false);
  const finish = useCallback(() => {
    if (!doneRef.current) cancelConnect();
    onClose();
  }, [cancelConnect, onClose]);
  const { closing, close: onCancel } = useModalExit(finish);

  useEffect(() => {
    if (connectState.kind === "success") {
      doneRef.current = true;
      const id = setTimeout(onCancel, 1400);
      return () => clearTimeout(id);
    }
  }, [connectState.kind, onCancel]);


  const onCopy = async () => {
    if (connectState.kind !== "awaiting") return;
    try {
      await navigator.clipboard.writeText(connectState.pin.userCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      return;
    }
  };

  const retryable = connectState.kind === "expired" || connectState.kind === "error";

  return (
    <ModalShell closing={closing} onDismiss={onCancel}>
        <div className="flex items-start gap-4 px-6 pt-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
              {t("Connect Simkl")}
            </span>
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">
              {connectState.kind === "success" ? t("Connected") : t("Authorize Harbor on Simkl")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
            aria-label={t("Cancel")}
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
          {(connectState.kind === "starting" || connectState.kind === "idle") && (
            <Spinner label={t("Requesting code from Simkl…")} />
          )}

          {connectState.kind === "awaiting" && (
            <>
              <div className="flex flex-col gap-2">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
                  {t("Step 1 · Open Simkl")}
                </span>
                <button
                  onClick={() => openUrl(connectState.pin.deepLinkUrl)}
                  className="flex h-11 w-full items-center justify-between gap-3 rounded-md bg-canvas px-4 text-start transition-colors hover:bg-elevated"
                >
                  <span className="truncate font-mono text-[13px] tracking-tight text-ink-muted">
                    {connectState.pin.verificationUrl}
                  </span>
                  <ExternalLink size={14} strokeWidth={2.2} className="shrink-0 text-ink-subtle" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
                  {t("Step 2 · Enter this code")}
                </span>
                <button
                  onClick={onCopy}
                  className="group flex w-full items-center justify-between gap-4 rounded-md bg-canvas px-5 py-4 transition-colors hover:bg-elevated"
                >
                  <span className="font-mono text-[26px] font-semibold tracking-[0.18em] text-ink">
                    {connectState.pin.userCode}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle transition-colors group-hover:text-ink">
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
                {t("Waiting for you to authorize on simkl.com…")}
              </p>
            </>
          )}

          {connectState.kind === "success" && (
            <div className="flex items-center gap-3 rounded-md bg-canvas px-4 py-3.5">
              <Check size={16} strokeWidth={2.4} className="shrink-0 text-success" />
              <span className="text-[13px] text-ink">
                {connectState.session.username
                  ? t("Connected as {username}", { username: connectState.session.username })
                  : t("Connected to Simkl")}
              </span>
            </div>
          )}

          {connectState.kind === "expired" && (
            <ErrorBox
              title={t("Code expired")}
              message={t("The authorization code timed out before you finished. Try again.")}
            />
          )}

          {connectState.kind === "error" && (
            <ErrorBox title={t("Couldn't reach Simkl")} message={connectState.message} />
          )}
        </div>

        {retryable && (
          <div className="flex items-center justify-end gap-2 px-6 pb-6">
            <button
              type="button"
              onClick={onCancel}
              className="harbor-press-pop h-9 rounded-md bg-elevated px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={beginConnect}
              className="harbor-press-pop h-9 rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-colors hover:opacity-90"
            >
              {t("Try again")}
            </button>
          </div>
        )}
    </ModalShell>
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-ink-muted">
      <Loader2 size={14} className="animate-spin" />
      {label}
    </div>
  );
}

function ErrorBox({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md bg-canvas px-4 py-3.5">
      <span className="text-[13.5px] font-semibold text-danger">{title}</span>
      <span className="text-[12.5px] leading-relaxed text-ink-muted">{message}</span>
    </div>
  );
}
