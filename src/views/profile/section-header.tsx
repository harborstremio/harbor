import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";

export function SectionHeader({
  icon,
  label,
  onViewAll,
}: {
  icon: ReactNode;
  label: string;
  onViewAll?: () => void;
}) {
  const t = useT();
  return (
    <div className="relative z-20 mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-ink-subtle">
        {icon} {label}
      </div>
      {onViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="group/va inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
        >
          {t("View all")}
          <ChevronRight
            size={14}
            strokeWidth={2.2}
            className="dir-icon transition-transform duration-200 group-hover/va:translate-x-0.5"
          />
        </button>
      )}
    </div>
  );
}
