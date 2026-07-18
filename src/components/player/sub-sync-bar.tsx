/**
 * SubSyncBar — شريط مزامنة الترجمة الحي
 * ينزل من أعلى الـ player مثل SubStyleBar
 * يتيح التحكم بتأخير/تقديم الترجمة أثناء تشغيل الفيديو مباشرة
 */
import { Check, RotateCcw, Type, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { closeSyncBar, useSyncBarOpen } from "@/lib/player/sub-sync";

const IDLE_MS = 12000;
const round = (v: number) => Math.round(v * 100) / 100;

type Props = {
  delaySec: number;
  onDelay: (sec: number) => void;
  onEnterSync?: () => void;
  syncAvailable?: boolean;
};

export function SubSyncBar({ delaySec, onDelay, onEnterSync, syncAvailable }: Props) {
  const t = useT();
  const open = useSyncBarOpen();
  const [localDelay, setLocalDelay] = useState(delaySec);
  const savedRef = useRef(delaySec);

  // Sync external delay into local state when bar opens
  useEffect(() => {
    if (open) {
      setLocalDelay(delaySec);
      savedRef.current = delaySec;
    }
  }, [open]);

  // Auto-close after idle
  useEffect(() => {
    if (!open) return;
    let timer = window.setTimeout(closeSyncBar, IDLE_MS);
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(closeSyncBar, IDLE_MS);
    };
    window.addEventListener("pointermove", bump);
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", bump);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", bump);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", bump);
    };
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeSyncBar();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Apply delay to player live
  const applyDelay = (sec: number) => {
    const v = round(sec);
    setLocalDelay(v);
    onDelay(v);
  };

  // Save = just close (delay is already applied live)
  const handleSave = () => {
    savedRef.current = localDelay;
    closeSyncBar();
  };

  // Discard = restore saved value
  const handleDiscard = () => {
    applyDelay(savedRef.current);
    closeSyncBar();
  };

  const isDirty = round(localDelay) !== round(savedRef.current);
  const isNonZero = localDelay !== 0;

  if (!open) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center px-6 pt-[68px] animate-in fade-in slide-in-from-top-2 duration-300">
      <div
        role="toolbar"
        aria-label={t("Subtitle sync")}
        className="pointer-events-auto flex items-stretch gap-2.5 rounded-[16px] border border-edge bg-elevated/95 px-2.5 py-2 shadow-[0_24px_64px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
      >
        {/* Left Side: Text Sync (Fixed width to center the middle section) */}
        <div className="flex w-[240px] items-center gap-1.5">
          {onEnterSync && (
            <button
              type="button"
              onClick={() => {
                closeSyncBar();
                onEnterSync();
              }}
              disabled={!syncAvailable}
              title={
                syncAvailable ? t("Sync subtitles via text") : t("Select a subtitle track to sync")
              }
              aria-label={t("Sync via text")}
              className={`flex h-10 items-center gap-2 rounded-xl px-3.5 text-[13px] font-semibold transition-all ${
                syncAvailable
                  ? "bg-raised text-ink-muted hover:bg-elevated hover:text-ink active:scale-95"
                  : "bg-raised/40 opacity-60 cursor-not-allowed text-ink-subtle/50"
              }`}
            >
              <Type size={15} strokeWidth={2} />
              <span className="hidden lg:inline">{t("Text Sync")}</span>
            </button>
          )}
        </div>

        {/* Center Side: Sync Controls */}
        <div className="flex items-center gap-[2px] rounded-xl bg-raised p-[2px] shadow-inner">
          <StepBtn label="−0.5s" onClick={() => applyDelay(localDelay - 0.5)} wide />
          <StepBtn label="−0.1s" onClick={() => applyDelay(localDelay - 0.1)} />

          <div className="mx-1.5 flex h-10 w-[96px] items-center justify-center rounded-lg bg-elevated">
            <DelayDisplay value={localDelay} nonZero={isNonZero} onReset={() => applyDelay(0)} />
          </div>

          <StepBtn label="+0.1s" onClick={() => applyDelay(localDelay + 0.1)} />
          <StepBtn label="+0.5s" onClick={() => applyDelay(localDelay + 0.5)} wide />
        </div>

        {/* Right Side: Save & Discard (Fixed width to match left side) */}
        <div className="flex w-[240px] items-center justify-end gap-1.5">
          {isDirty && (
            <button
              type="button"
              onClick={handleDiscard}
              title={t("Discard changes")}
              aria-label={t("Discard changes")}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-raised hover:text-danger active:scale-95"
            >
              <RotateCcw size={16} strokeWidth={2.2} />
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            aria-label={t("Save")}
            className="flex h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-[13px] font-semibold text-canvas transition-all hover:brightness-110 active:scale-95"
          >
            <Check size={16} strokeWidth={2.6} />
            {t("Done")}
          </button>

          <button
            type="button"
            onClick={closeSyncBar}
            aria-label={t("Close")}
            className="ms-1 flex h-10 w-10 items-center justify-center rounded-xl text-ink-muted transition-colors hover:bg-raised hover:text-ink active:scale-95"
          >
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepBtn({ label, onClick, wide }: { label: string; onClick: () => void; wide?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[36px] items-center justify-center rounded-[10px] font-mono text-[13px] font-bold tabular-nums text-ink-muted transition-colors hover:bg-elevated hover:text-ink active:scale-95 ${
        wide ? "w-14" : "w-12"
      }`}
    >
      {label}
    </button>
  );
}

function DelayDisplay({
  value,
  nonZero,
  onReset,
}: {
  value: number;
  nonZero: boolean;
  onReset: () => void;
}) {
  const t = useT();
  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <span
        className={`text-center font-mono text-[15px] font-bold tabular-nums transition-colors ${
          nonZero ? "text-accent" : "text-ink-subtle"
        }`}
      >
        {value >= 0 ? "+" : ""}
        {value.toFixed(2)}s
      </span>
      {nonZero && (
        <button
          type="button"
          onClick={onReset}
          aria-label={t("Reset sync")}
          title={t("Reset to 0")}
          className="absolute -end-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-raised text-ink-subtle shadow-sm transition-colors hover:bg-elevated hover:text-danger"
        >
          <RotateCcw size={10} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
