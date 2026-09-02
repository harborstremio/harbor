import { useT } from "@/lib/i18n";

export function NewBadge() {
  const t = useT();
  return (
    <span className="inline-flex shrink-0 items-center rounded-sm bg-accent/10 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-[0.14em] text-accent ring-1 ring-accent/25">
      {t("New")}
    </span>
  );
}

export function UpcomingBadge() {
  const t = useT();
  return (
    <span className="inline-flex shrink-0 items-center rounded-sm bg-white/[0.06] px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-[0.14em] text-ink-subtle">
      {t("Upcoming")}
    </span>
  );
}

export function FillerBadge() {
  const t = useT();
  return (
    <span className="inline-flex shrink-0 items-center rounded-sm bg-white/[0.06] px-1.5 py-[1px] text-[9px] font-medium uppercase tracking-[0.14em] text-ink-subtle">
      {t("Filler")}
    </span>
  );
}
