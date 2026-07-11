import { useT } from "@/lib/i18n";
import { forwardRef, useEffect, useRef } from "react";

export function CategoryStrip({
  groups,
  active,
  onSelect,
  counts,
}: {
  groups: string[];
  active: string | null;
  onSelect: (g: string | null) => void;
  counts: Map<string, number>;
}) {
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const allCount = Array.from(counts.values()).reduce((a, b) => a + b, 0);

  useEffect(() => {
    const el = activeRef.current;
    const wrap = scrollRef.current;
    if (!el || !wrap) return;
    const elRect = el.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();
    if (elRect.left < wrapRect.left || elRect.right > wrapRect.right) {
      el.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    }
  }, [active]);

  return (
    <div
      ref={scrollRef}
      className="flex gap-2 overflow-x-auto px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <Chip
        ref={active === null ? activeRef : undefined}
        label={t("All channels")}
        count={allCount}
        active={active === null}
        onClick={() => onSelect(null)}
      />
      {groups.map((g) => (
        <Chip
          key={g}
          ref={active === g ? activeRef : undefined}
          label={g}
          count={counts.get(g) ?? 0}
          active={active === g}
          onClick={() => onSelect(g)}
        />
      ))}
    </div>
  );
}

const Chip = forwardRef<HTMLButtonElement, { label: string; count: number; active: boolean; onClick: () => void }>(
  function Chip({ label, count, active, onClick }, ref) {
    return (
      <button
        ref={ref}
        onClick={onClick}
        className={`flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-[13px] font-medium transition-colors duration-150 ${
          active
            ? "border-ink bg-ink text-canvas"
            : "border-edge-soft/55 bg-elevated text-ink-muted hover:border-edge hover:text-ink"
        }`}
      >
        <span className="truncate max-w-[200px]">{label}</span>
        <span
          className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10.5px] font-semibold tabular-nums ${
            active ? "bg-canvas/15 text-canvas" : "bg-canvas/40 text-ink-subtle"
          }`}
        >
          {count}
        </span>
      </button>
    );
  },
);
