import type { StoreTheme } from "@/lib/theme-store";
import { useT } from "@/lib/i18n";
import type { Mood } from "../color-rank";
import type { MoodRail } from "../use-store-themes";

export function TasteChip({
  label,
  lead,
  active = false,
  onClick,
}: {
  label: string;
  lead?: StoreTheme;
  active?: boolean;
  onClick: () => void;
}) {
  const a = lead?.swatch?.[0] ?? "var(--color-elevated)";
  const b = lead?.swatch?.[1] ?? lead?.swatch?.[0] ?? "var(--color-surface)";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`group inline-flex h-11 shrink-0 items-center gap-2.5 rounded-full pe-4 ps-1.5 text-start transition-colors ${
        active
          ? "bg-accent-soft ring-1 ring-accent"
          : "bg-surface ring-1 ring-edge-soft hover:bg-elevated hover:ring-edge"
      }`}
    >
      <span
        className="h-7 w-7 shrink-0 rounded-full ring-1 ring-edge-soft"
        style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
      />
      <span
        className={`text-[15.5px] font-semibold leading-[22px] transition-colors ${
          active ? "text-accent" : "text-ink-muted group-hover:text-ink"
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export function StoreCategoryChips({
  rails,
  active,
  onPick,
}: {
  rails: MoodRail[];
  active?: Mood | null;
  onPick: (mood: Mood) => void;
}) {
  const t = useT();
  if (rails.length === 0) return null;
  return (
    <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {rails.map((r) => (
        <TasteChip
          key={r.mood}
          label={t(r.title)}
          lead={r.items[0]}
          active={active === r.mood}
          onClick={() => onPick(r.mood)}
        />
      ))}
    </div>
  );
}
