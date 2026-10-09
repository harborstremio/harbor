import { useT } from "@/lib/i18n";
import { HIDE_SCROLL } from "./data";

const BUILT_IN_ORDER_LABELS: Record<string, true> = {
  Aired: true,
  DVD: true,
  Absolute: true,
  "TVDB Absolute": true,
  Alternate: true,
  Regional: true,
  TMDB: true,
};
export type OrderOption = { value: string; label: string };

function shortLabel(label: string): string {
  return label.replace(/\s*Order$/i, "");
}

export function OrderStyleSwitch({
  options,
  active,
  onPick,
}: {
  options: OrderOption[];
  active: string;
  onPick: (value: string) => void;
}) {
  const t = useT();
  return (
    <div
      role="group"
      aria-label={t("Episode order")}
      className={`-mx-5 flex items-center gap-1.5 overflow-x-auto px-5 ${HIDE_SCROLL}`}
    >
      {options.map((o) => {
        const label = shortLabel(o.label);
        const on = o.value === active || (active === "official" && o.value === "aired");
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onPick(o.value)}
            className={`h-8 shrink-0 whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-semibold transition-colors active:scale-[0.97] motion-reduce:transition-none ${
              on ? "bg-ink text-canvas" : "bg-surface text-ink-muted ring-1 ring-edge-soft/70"
            }`}
          >
            {Object.hasOwn(BUILT_IN_ORDER_LABELS, label) ? t(label) : label}
          </button>
        );
      })}
    </div>
  );
}
