import type { Severity } from "@/lib/bug-report";

const OPTIONS: Array<{ id: Severity; label: string; sub: string }> = [
  { id: "low", label: "Low", sub: "cosmetic, minor" },
  { id: "normal", label: "Normal", sub: "annoying" },
  { id: "high", label: "High", sub: "feature broken" },
  { id: "critical", label: "Critical", sub: "app unusable" },
];

const TONE: Record<Severity, string> = {
  low: "border-edge-soft bg-canvas/40 text-ink-muted",
  normal: "border-edge bg-canvas text-ink",
  high: "border-accent/55 bg-accent/10 text-accent",
  critical: "border-danger/55 bg-danger/10 text-danger",
};

export function SeverityPicker({ value, onChange }: { value: Severity; onChange: (v: Severity) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {OPTIONS.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-start transition-colors ${
              selected ? TONE[o.id] : "border-edge-soft/60 bg-canvas/30 text-ink-muted hover:border-edge hover:text-ink"
            }`}
          >
            <span className="text-[13.5px] font-semibold">{o.label}</span>
            <span className="text-[11px] text-ink-subtle">{o.sub}</span>
          </button>
        );
      })}
    </div>
  );
}
