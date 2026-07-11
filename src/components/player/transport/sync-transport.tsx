import { useT } from "@/lib/i18n";
import { PauseCircle, PlayCircle, RotateCcw, Save, Undo2, X } from "lucide-react";

export function SyncTransport({
  mode,
  playing,
  anchorCount,
  canUndo,
  canSave,
  previewOffset,
  onPlayPause,
  onNudge,
  onUndo,
  onSave,
  onExit,
}: {
  mode: "easy" | "normal";
  playing: boolean;
  anchorCount: number;
  canUndo: boolean;
  canSave: boolean;
  previewOffset: number;
  onPlayPause: () => void;
  onNudge: (deltaSec: number) => void;
  onUndo: () => void;
  onSave: () => void;
  onExit: () => void;
}) {
  const t = useT();
  const saveDisabled = !canSave;
  const nonZero = previewOffset !== 0;

  return (
    <div className="flex flex-col gap-3 border-b border-white/10 bg-black/40 px-4 py-3 backdrop-blur-xl">
      {/* Top Row: Play/Pause, Offset Nudge, Reset */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onPlayPause}
          aria-label={playing ? t("Pause") : t("Play")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95"
        >
          {playing ? <PauseCircle size={20} strokeWidth={1.5} /> : <PlayCircle size={20} strokeWidth={1.5} />}
        </button>

        {/* Nudge steps */}
        <div className="flex h-10 flex-1 items-stretch justify-center overflow-hidden rounded-xl bg-white/5">
          <NudgeBtn label="−0.5s" onClick={() => onNudge(-0.5)} />
          <NudgeBtn label="−0.1s" onClick={() => onNudge(-0.1)} />
          <div
            className={`flex flex-1 items-center justify-center border-x border-white/10 px-2 font-mono text-[14px] font-semibold tabular-nums transition-colors ${
              nonZero ? "text-emerald-400" : "text-white/60"
            }`}
          >
            {previewOffset >= 0 ? "+" : ""}
            {previewOffset.toFixed(2)}s
          </div>
          <NudgeBtn label="+0.1s" onClick={() => onNudge(0.1)} />
          <NudgeBtn label="+0.5s" onClick={() => onNudge(0.5)} />
        </div>

        {nonZero ? (
          <button
            onClick={() => onNudge(-previewOffset)}
            aria-label={t("Reset offset")}
            title={t("Reset offset to 0")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          >
            <RotateCcw size={16} strokeWidth={2.2} />
          </button>
        ) : (
          <div className="w-10 shrink-0" />
        )}
      </div>

      {/* Bottom Row: Exit, Progress, Undo, Save */}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onExit}
          aria-label={t("Exit sync mode")}
          title={t("Exit sync mode")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/60 transition-colors hover:bg-white/15 hover:text-white"
        >
          <X size={16} strokeWidth={2.2} />
        </button>

        <div className="flex flex-1 items-center justify-center gap-2">
          {mode === "normal" ? (
            <>
              <div className="flex items-center gap-1.5">
                {[0, 1].map((i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full transition-colors ${
                      anchorCount > i ? "bg-emerald-500" : "bg-white/15"
                    }`}
                  />
                ))}
              </div>
              <span className="max-w-[120px] truncate text-[12px] font-medium text-white/60">
                {anchorCount === 0 ? t("Click a line") : anchorCount === 1 ? t("Click another") : t("Ready")}
              </span>
            </>
          ) : (
            <span className="text-[12px] font-medium text-white/55">
              {canSave ? t("Ready to save") : t("Tap a line, then nudge")}
            </span>
          )}
        </div>

        <button
          onClick={onUndo}
          disabled={!canUndo}
          aria-label={t("Undo")}
          title={t("Undo last anchor")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-25"
        >
          <Undo2 size={16} strokeWidth={2.2} />
        </button>

        <button
          onClick={onSave}
          disabled={saveDisabled}
          aria-label={t("Save sync")}
          className={`flex h-9 shrink-0 items-center gap-2 rounded-lg px-4 text-[13px] font-semibold transition-colors active:scale-95 ${
            saveDisabled
              ? "bg-white/5 text-white/30 cursor-not-allowed"
              : "bg-emerald-600/90 text-white hover:bg-emerald-600"
          }`}
        >
          <Save size={14} strokeWidth={2.2} />
          {t("Save")}
        </button>
      </div>
    </div>
  );
}

function NudgeBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center px-2.5 font-mono text-[11.5px] font-semibold tabular-nums text-white/70 transition-colors hover:bg-white/12 hover:text-white active:scale-95"
    >
      {label}
    </button>
  );
}
