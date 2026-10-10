import { ChevronDown, ChevronUp } from "lucide-react";
import { useT } from "@/lib/i18n";

export function MovementDelta({ delta }: { delta: number | null | undefined }) {
  const t = useT();
  if (delta === undefined) return null;

  if (delta === null) {
    return (
      <span
        aria-label={t("New this week")}
        className="inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-accent ring-1 ring-accent/35"
      >
        {t("NEW")}
      </span>
    );
  }

  if (delta > 0) {
    return (
      <span
        aria-label={t("Up {n} this week", { n: String(delta) })}
        className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold tabular-nums text-success"
      >
        <ChevronUp size={11} strokeWidth={2.6} aria-hidden />
        {delta}
      </span>
    );
  }

  if (delta < 0) {
    return (
      <span
        aria-label={t("Down {n} this week", { n: String(Math.abs(delta)) })}
        className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold tabular-nums text-ink-subtle"
      >
        <ChevronDown size={11} strokeWidth={2.6} aria-hidden />
        {Math.abs(delta)}
      </span>
    );
  }

  return (
    <span aria-label={t("No change this week")} className="text-[11.5px] text-ink-subtle">
      &middot;
    </span>
  );
}
