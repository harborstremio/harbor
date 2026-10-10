import { useT } from "@/lib/i18n";

export function ResultPill({ count }: { count: number }) {
  const t = useT();
  if (count <= 0) {
    return <span className="text-[12.5px] text-ink-subtle">{t("Nothing yet")}</span>;
  }
  return (
    <span className="flex items-center gap-1 text-[12.5px] font-semibold text-accent">
      <span className="tabular-nums">{count}</span>
      <span className="font-medium">{count === 1 ? t("result") : t("results")}</span>
    </span>
  );
}
