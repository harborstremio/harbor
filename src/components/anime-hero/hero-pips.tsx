import { useT } from "@/lib/i18n";

const MAX_PIPS = 8;

export function HeroPips({
  total,
  active,
  onSelect,
}: {
  total: number;
  active: number;
  onSelect: (i: number) => void;
}) {
  const t = useT();
  const windowed = total > MAX_PIPS;
  const start = windowed
    ? Math.max(0, Math.min(active - Math.floor(MAX_PIPS / 2), total - MAX_PIPS))
    : 0;
  const count = windowed ? MAX_PIPS : total;
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1.5">
        {Array.from({ length: count }, (_, k) => {
          const i = start + k;
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              aria-label={t("Slide {n}", { n: i + 1 })}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                i === active ? "w-10 bg-accent" : "w-6 bg-ink-subtle/35 hover:bg-ink-subtle/60"
              }`}
            />
          );
        })}
      </div>
      {windowed && (
        <span className="text-[11px] font-medium tabular-nums text-ink-subtle">
          {active + 1} / {total}
        </span>
      )}
    </div>
  );
}
