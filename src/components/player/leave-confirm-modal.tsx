import { useT } from "@/lib/i18n";
import { closeLeaveConfirm, getLeaveConfirm, subscribeLeaveConfirm } from "@/lib/player/leave-confirm";
import { useEffect, useState, useSyncExternalStore } from "react";

export function LeaveConfirmModal() {
  const t = useT();
  const state = useSyncExternalStore(subscribeLeaveConfirm, getLeaveConfirm);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (state.open) setRemember(false);
  }, [state.open]);

  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeLeaveConfirm();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        const fn = state.onConfirm;
        closeLeaveConfirm();
        fn?.(remember);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [state.open, state.onConfirm, remember]);

  if (!state.open) return null;

  const leave = () => {
    const fn = state.onConfirm;
    closeLeaveConfirm();
    fn?.(remember);
  };

  return (
    <div
      className="absolute inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={closeLeaveConfirm}
    >
      <div
        className="mx-4 w-full max-w-md rounded-2xl border border-edge bg-surface p-7 text-center shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-[22px] font-bold text-ink">{t("Leave the show?")}</h2>
        <p className="mt-2.5 text-[15px] leading-relaxed text-ink-muted">
          {t("We'll save your spot so you can pick up right where you left off.")}
        </p>
        <label className="mt-5 inline-flex cursor-pointer items-center justify-center gap-2.5 text-[14px] text-ink-muted">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-[18px] w-[18px] cursor-pointer"
          />
          {t("Don't ask me again")}
        </label>
        <div className="mt-6 flex gap-3">
          <button
            onClick={closeLeaveConfirm}
            className="h-12 flex-1 rounded-xl bg-elevated text-[16px] font-semibold text-ink transition-colors hover:bg-raised"
          >
            {t("Keep watching")}
          </button>
          <button
            onClick={leave}
            autoFocus
            className="h-12 flex-1 rounded-xl bg-ink text-[16px] font-semibold text-canvas transition-transform hover:scale-[1.02]"
          >
            {t("Leave")}
          </button>
        </div>
      </div>
    </div>
  );
}
