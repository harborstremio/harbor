import { useT } from "@/lib/i18n";
import type { Severity } from "@/lib/bug-report";

const OPTIONS: Array<{ id: Severity; label: string; sub: string }> = [
  { id: "low", label: "Low", sub: "cosmetic, minor" },
  { id: "normal", label: "Normal", sub: "annoying" },
  { id: "high", label: "High", sub: "feature broken" },
  { id: "critical", label: "Critical", sub: "app unusable" },
];

const TONE: Record<Severity, string> = {
  low: "bg-ink text-canvas",
  normal: "bg-ink text-canvas",
  high: "bg-accent-soft text-accent",
  critical: "bg-danger/15 text-danger",
};

export function SeverityPicker({
  value,
  onChange,
}: {
  value: Severity;
  onChange: (v: Severity) => void;
}) {
  const t = useT();
  return (
    <div className="grid w-full grid-cols-2 gap-1.5 sm:grid-cols-4">
      {OPTIONS.map((o) => {
        const selected = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={`flex flex-col items-start gap-0.5 rounded-md px-3 py-2.5 text-start transition-colors ${
              selected ? TONE[o.id] : "bg-canvas text-ink-muted hover:text-ink"
            }`}
          >
            <span className="text-[13.5px] font-semibold">{t(o.label)}</span>
            <span className="text-[11.5px] opacity-70">{t(o.sub)}</span>
          </button>
        );
      })}
    </div>
  );
}
