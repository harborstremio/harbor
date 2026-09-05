import { Segmented } from "../shared";
import type { Severity } from "@/lib/bug-report";

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
  return <Segmented value={value} options={OPTIONS} onChange={onChange} />;
}
