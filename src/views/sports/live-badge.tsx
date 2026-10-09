import { useT } from "@/lib/i18n";

export function LiveBadge({ label }: { label?: string }) {
  const t = useT();
  return (
    <span className="inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-full bg-danger px-2 text-[10.5px] font-bold uppercase tracking-[0.08em] tabular-nums text-canvas">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-canvas motion-reduce:animate-none" />
      {label || t("Live")}
    </span>
  );
}
