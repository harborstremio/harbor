import type { AdRange } from "@/lib/ad-report/submit";
import { useT } from "@/lib/i18n";
import { Clock } from "lucide-react";
import { useEffect, useState } from "react";

function fmt(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function parse(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((p) => p.trim());
  if (parts.length > 3) return null;
  if (parts.some((p) => p === "" || !/^\d+$/.test(p))) return null;
  return parts.map(Number).reduce((acc, n) => acc * 60 + n, 0);
}

export function RangeRow({
  index,
  range,
  currentSec,
  onChange,
  onRemove,
}: {
  index: number;
  range: AdRange;
  currentSec: number;
  onChange: (next: AdRange) => void;
  onRemove: () => void;
}) {
  const t = useT();
  const invalid = range.endSec <= range.startSec;
  const now = () => Math.max(0, Math.round(currentSec));

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-edge bg-canvas/50 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
          {t("Ad {n}", { n: index + 1 })}
        </span>
        <button
          type="button"
          onClick={onRemove}
          className="text-[11.5px] font-medium text-ink-subtle transition-colors hover:text-danger"
        >
          {t("Remove")}
        </button>
      </div>
      <div className="flex flex-col gap-2.5">
        <TimeField
          label={t("Starts at")}
          value={range.startSec}
          onCommit={(v) => onChange({ ...range, startSec: v })}
          onUseNow={() => onChange({ ...range, startSec: now() })}
        />
        <TimeField
          label={t("Ends at")}
          value={range.endSec}
          danger={invalid}
          onCommit={(v) => onChange({ ...range, endSec: v })}
          onUseNow={() => onChange({ ...range, endSec: now() })}
        />
      </div>
      {invalid && <p className="text-[11.5px] text-danger">{t("The end time has to be after the start.")}</p>}
    </div>
  );
}

function TimeField({
  label,
  value,
  danger,
  onCommit,
  onUseNow,
}: {
  label: string;
  value: number;
  danger?: boolean;
  onCommit: (sec: number) => void;
  onUseNow: () => void;
}) {
  const t = useT();
  const [text, setText] = useState(() => fmt(value));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setText(fmt(value));
  }, [value, editing]);

  const commit = () => {
    const parsed = parse(text);
    if (parsed != null) onCommit(parsed);
    else setText(fmt(value));
    setEditing(false);
  };

  return (
    <div className="flex items-center gap-2.5">
      <span className="w-16 shrink-0 text-[12px] font-medium text-ink-muted">{label}</span>
      <input
        inputMode="numeric"
        value={text}
        onFocus={() => setEditing(true)}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        aria-label={label}
        className={`h-11 min-w-0 flex-1 rounded-lg border bg-elevated px-3 text-center font-mono text-[15px] font-semibold tabular-nums outline-none transition-colors focus:border-accent ${
          danger ? "border-danger text-danger" : "border-edge text-ink"
        }`}
      />
      <button
        type="button"
        onClick={onUseNow}
        title={t("Set to where the video is right now")}
        className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg bg-elevated px-3 text-[12.5px] font-semibold text-ink-muted transition-colors hover:bg-raised hover:text-ink"
      >
        <Clock size={14} strokeWidth={2.2} />
        {t("Now")}
      </button>
    </div>
  );
}
