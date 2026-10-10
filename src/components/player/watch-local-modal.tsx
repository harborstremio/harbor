import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Check, HardDrive, RotateCcw, Wifi } from "lucide-react";
import { useT } from "@/lib/i18n";
import {
  closeWatchLocalConfirm,
  getWatchLocalConfirm,
  subscribeWatchLocalConfirm,
  type WatchLocalChoice,
} from "@/lib/player/watch-local-confirm";

function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function WatchLocalModal() {
  const t = useT();
  const state = useSyncExternalStore(subscribeWatchLocalConfirm, getWatchLocalConfirm);
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (state.open) setRemember(false);
  }, [state.open]);

  const choose = (choice: WatchLocalChoice) => {
    const fn = state.onChoose;
    closeWatchLocalConfirm();
    fn?.(choice, remember);
  };

  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        closeWatchLocalConfirm();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        choose("local");
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.open, state.onChoose, remember]);

  if (!state.open) return null;

  return createPortal(
    <div
      className="pointer-events-auto fixed inset-0 z-[210] flex items-center justify-center bg-black/72 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeWatchLocalConfirm();
      }}
    >
      <div className="mx-4 flex w-full max-w-[440px] flex-col gap-5 rounded-3xl border border-edge-soft bg-elevated/95 px-8 py-8 shadow-[0_30px_80px_-25px_rgba(0,0,0,0.85)] animate-in zoom-in-95 fade-in duration-200">
        <div className="flex flex-col gap-1.5 text-center">
          <h2 className="text-[19px] font-medium tracking-tight text-ink">{t("This is in your local library")}</h2>
          <p className="text-[13px] leading-relaxed text-ink-muted">
            {state.subtitle ? `${state.title} · ${state.subtitle}` : state.title}
          </p>
        </div>
        <div className="flex flex-col gap-2.5">
          {state.hasResume ? (
            <>
              <button
                type="button"
                autoFocus
                onClick={() => choose("local")}
                className="flex h-12 items-center justify-center gap-2.5 rounded-full bg-ink text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.02]"
              >
                <HardDrive size={16} strokeWidth={2.2} />
                {state.resumeMs > 0
                  ? `${t("Continue from last watched")} · ${formatClock(state.resumeMs)}`
                  : t("Continue from last watched")}
              </button>
              <button
                type="button"
                onClick={() => choose("local-restart")}
                className="flex h-12 items-center justify-center gap-2.5 rounded-full bg-canvas/50 text-[14px] font-semibold text-ink ring-1 ring-edge-soft transition-colors hover:bg-canvas/70"
              >
                <RotateCcw size={16} strokeWidth={2.2} />
                {t("Watch from the beginning")}
              </button>
            </>
          ) : (
            <button
              type="button"
              autoFocus
              onClick={() => choose("local")}
              className="flex h-12 items-center justify-center gap-2.5 rounded-full bg-ink text-[14px] font-semibold text-canvas transition-transform hover:scale-[1.02]"
            >
              <HardDrive size={16} strokeWidth={2.2} />
              {t("Watch my local copy")}
            </button>
          )}
          <button
            type="button"
            onClick={() => choose("stream")}
            className="flex h-12 items-center justify-center gap-2.5 rounded-full bg-canvas/50 text-[14px] font-semibold text-ink ring-1 ring-edge-soft transition-colors hover:bg-canvas/70"
          >
            <Wifi size={16} strokeWidth={2.2} />
            {t("Stream / addons")}
          </button>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={remember}
          onClick={() => setRemember((v) => !v)}
          className={`mx-auto inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
            remember
              ? "bg-accent/15 text-accent ring-1 ring-accent/40"
              : "text-ink-muted ring-1 ring-edge-soft hover:bg-raised hover:text-ink"
          }`}
        >
          <span
            className={`flex h-[18px] w-[18px] items-center justify-center rounded-md transition-colors ${
              remember ? "bg-accent text-canvas" : "ring-1 ring-edge"
            }`}
          >
            {remember && <Check size={12} strokeWidth={3} />}
          </span>
          {t("Remember my choice")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
