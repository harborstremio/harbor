import { useT } from "@/lib/i18n";
import { RotateCcw, Type } from "lucide-react";

const round = (v: number) => Math.round(v * 100) / 100;

export function DelayRow({
  delay,
  onDelay,
  onEnterSync,
  syncAvailable,
}: {
  delay: number;
  onDelay: (sec: number) => void;
  onEnterSync?: () => void;
  syncAvailable?: boolean;
}) {
  const t = useT();
  return (
    <div className="border-t border-edge-soft bg-canvas/30">
      <div className="flex flex-col gap-2.5 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-ink">{t("Sync Offset")}</span>
          <div className="flex items-center gap-2">
            <span
              className={`font-mono text-[13px] font-bold tabular-nums ${delay !== 0 ? "text-accent" : "text-ink-muted"}`}
            >
              {delay > 0 ? "+" : ""}
              {delay.toFixed(2)}s
            </span>
            {delay !== 0 && (
              <button
                onClick={() => onDelay(0)}
                aria-label={t("Reset sync")}
                className="flex h-6 w-6 items-center justify-center rounded-md bg-raised text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
              >
                <RotateCcw size={12} strokeWidth={2.2} />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-stretch overflow-hidden rounded-lg bg-raised">
          <Step label="−0.5s" onClick={() => onDelay(round(delay - 0.5))} />
          <div className="w-px bg-edge-soft/50" />
          <Step label="−0.1s" onClick={() => onDelay(round(delay - 0.1))} />
          <div className="w-px bg-edge-soft/50" />
          <Step label="+0.1s" onClick={() => onDelay(round(delay + 0.1))} />
          <div className="w-px bg-edge-soft/50" />
          <Step label="+0.5s" onClick={() => onDelay(round(delay + 0.5))} />
        </div>
      </div>
      {onEnterSync && (
        <div className="border-t border-edge-soft/50 px-3 py-2">
          <button
            onClick={onEnterSync}
            disabled={!syncAvailable}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${
              syncAvailable ? "bg-accent/15 text-accent hover:bg-accent/25" : "bg-raised/50 text-ink-subtle/40"
            }`}
          >
            <Type size={14} strokeWidth={2.2} />
            {syncAvailable ? t("Sync subtitles via text") : t("Text sync unavailable for embedded tracks")}
          </button>
        </div>
      )}
    </div>
  );
}

function Step({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 px-2 py-1.5 text-[12px] font-semibold tabular-nums text-ink-muted transition-colors hover:bg-elevated hover:text-ink active:scale-95"
    >
      {label}
    </button>
  );
}
