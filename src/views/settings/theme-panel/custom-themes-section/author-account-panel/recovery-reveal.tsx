import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useModalExit } from "@/components/modal-shell";

export function RecoveryReveal({ code, onDone }: { code: string; onDone: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const { closing, close } = useModalExit(onDone);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return createPortal(
    <div
      className={`${closing ? "animate-scrim-out" : "animate-scrim-in"} fixed inset-0 z-[240] grid place-items-center p-8`}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`${closing ? "animate-dialog-out" : "animate-dialog-in"} flex max-h-[86vh] w-[min(560px,100%)] flex-col overflow-hidden rounded-md bg-surface`}
      >
        <div className="flex flex-col gap-1 px-6 pt-6">
          <h2 className="text-[17px] font-semibold tracking-tight text-ink">
            {t("Save your recovery code")}
          </h2>
          <p className="text-[12.5px] leading-relaxed text-ink-subtle">
            {t(
              "This is the only time you'll see it. If you ever forget your password, this code is the only way back into your account. Store it somewhere safe.",
            )}
          </p>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
          <div className="flex flex-col gap-3 rounded-md bg-canvas p-4">
            <span className="animate-badge-pop select-all break-all text-center font-mono text-[19px] font-semibold tracking-[0.14em] text-ink">
              {code}
            </span>
            <button
              onClick={copy}
              className="harbor-press-pop flex h-9 items-center justify-center gap-1.5 rounded-md bg-elevated text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}{" "}
              {copied ? t("Copied") : t("Copy code")}
            </button>
          </div>

          <button
            onClick={() => setSaved((s) => !s)}
            className="flex items-center gap-2.5 text-start text-[12.5px] text-ink-muted transition-colors hover:text-ink"
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${
                saved ? "bg-accent text-canvas" : "bg-elevated"
              }`}
            >
              {saved && <Check size={14} strokeWidth={3} />}
            </span>
            {t("I've saved my recovery code somewhere safe.")}
          </button>
        </div>

        <div className="flex items-center justify-end px-6 pb-6">
          <button
            onClick={close}
            disabled={!saved}
            className="harbor-press-pop h-9 rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {t("Continue")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
