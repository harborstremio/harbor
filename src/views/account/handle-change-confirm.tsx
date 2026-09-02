import { useEffect } from "react";
import { useModalExit } from "@/components/modal-shell";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";
import { useT } from "@/lib/i18n";

export function HandleChangeConfirm({
  current,
  next,
  busy,
  onConfirm,
  onCancel,
}: {
  current: string;
  next: string;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onConfirm, onCancel]);

  const { closing, close } = useModalExit(onCancel);

  return createPortal(
    <div
      onPointerDown={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
      className={`${closing ? "animate-scrim-out" : "animate-scrim-in"} fixed inset-0 z-[250] grid place-items-center p-8`}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`${closing ? "animate-dialog-out" : "animate-dialog-in"} flex max-h-[86vh] w-[min(640px,100%)] flex-col overflow-hidden rounded-md bg-surface`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4 px-6 pt-6">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="text-[17px] font-semibold tracking-tight text-ink">
              {t("Change your handle?")}
            </h2>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t("Close")}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-6">
          <p className="text-[12.5px] leading-relaxed text-ink-subtle">
            {t("You are changing")} <span className="font-display text-ink">@{current}</span>{" "}
            {t("to")} <span className="font-display text-ink">@{next}</span>.{" "}
            {t(
              "You will not be able to change it again for 14 days, and your old handle may be taken by someone else.",
            )}
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={close}
            className="harbor-press-pop h-9 rounded-md bg-elevated px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            {t("Keep")} @{current}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            autoFocus
            className="harbor-press-pop flex h-9 items-center justify-center rounded-md bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : t("Change handle")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
