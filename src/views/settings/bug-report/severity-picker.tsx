import { Segmented } from "../shared";
import type { Severity } from "@/lib/bug-report";
import { useT } from "@/lib/i18n";

const OPTIONS: ReadonlyArray<{ value: Severity; label: string }> = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export function SeverityPicker({
  value,
  onChange,
}: {
  value: Severity;
  onChange: (v: Severity) => void;
}) {
  const t = useT();
  const descriptions: Record<Severity, string> = {
    low: t("Something looks wrong, but the feature still works."),
    normal: t("Something behaves unexpectedly, but you can keep using Harbor."),
    high: t("A feature you need does not work."),
    critical: t("You cannot use Harbor."),
  };
  return (
    <div className="flex flex-col items-start gap-2">
      <Segmented value={value} options={OPTIONS} onChange={onChange} />
      <p className="text-[14px] leading-5 text-ink-muted" aria-live="polite">{descriptions[value]}</p>
    </div>
  );
}
