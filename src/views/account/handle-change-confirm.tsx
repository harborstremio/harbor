import { useEffect } from "react";
import { Loader2 } from "lucide-react";
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
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onConfirm, onCancel]);

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/72 px-4 backdrop-blur-md animate-in fade-in duration-200 motion-reduce:animate-none"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[18px] font-bold text-ink">Change your handle?</h2>
        <p className="mt-2.5 text-[14px] leading-relaxed text-ink-muted">
          {t("You are changing")} <span className="font-display text-ink">@{current}</span> {t("to")}{" "}
          <span className="font-display text-ink">@{next}</span>. {t("You will not be able to change it again for 14 days, and your old handle may be taken by someone else.")}
          
        </p>
        <div className="mt-6 flex gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="h-11 flex-1 rounded-xl bg-elevated text-[14.5px] font-semibold text-ink transition-colors hover:bg-raised"
          >
            {t("Keep")} @{current}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            autoFocus
            className="flex h-11 flex-1 items-center justify-center rounded-xl bg-ink text-[14.5px] font-semibold text-canvas transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50 motion-reduce:active:scale-100"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : t("Change handle")}
          </button>
        </div>
      </div>
    </div>
  );
}
