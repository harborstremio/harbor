import { SlidersHorizontal } from "lucide-react";
import { useT } from "@/lib/i18n";

export function RailHandle({
  summary,
  activeCount,
  onExpand,
}: {
  summary: string;
  activeCount: number;
  onExpand: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onExpand}
      aria-label={t("Show filters")}
      className="relative flex w-11 shrink-0 flex-col items-center gap-3 self-stretch bg-surface py-4 text-ink-muted transition-colors before:absolute before:inset-y-0 before:start-0 before:w-px before:bg-edge-soft hover:text-ink"
    >
      <SlidersHorizontal size={16} strokeWidth={2} />
      {activeCount > 0 && (
        <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent-soft px-1 text-[11px] font-bold tabular-nums text-accent">
          {activeCount}
        </span>
      )}
      <span className="min-h-0 flex-1 overflow-hidden whitespace-nowrap text-[12px] text-ink-subtle [writing-mode:vertical-rl]">
        {summary}
      </span>
    </button>
  );
}
