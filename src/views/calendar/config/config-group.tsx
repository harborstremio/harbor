import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useT } from "@/lib/i18n";

export function ConfigGroup({
  title,
  icon,
  count,
  summary,
  open,
  onToggle,
  onClear,
  children,
}: {
  title: string;
  icon?: ReactNode;
  count: number;
  summary: string;
  open: boolean;
  onToggle: () => void;
  onClear?: () => void;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="flex flex-col py-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-h-[44px] flex-1 items-center gap-2.5 text-start"
        >
          <ChevronDown
            size={16}
            strokeWidth={2.4}
            className={`dir-icon shrink-0 text-ink-subtle transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-0" : "-rotate-90"}`}
          />
          {icon && <span className="shrink-0 text-ink-muted">{icon}</span>}
          <span className="shrink-0 text-[13.5px] font-semibold text-ink">{title}</span>
          {count > 0 && (
            <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent-soft px-1.5 text-[11px] font-bold tabular-nums text-accent">
              {count}
            </span>
          )}
          {!open && summary && (
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink-subtle">{summary}</span>
          )}
        </button>
        {open && count > 0 && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium text-ink-subtle transition-colors hover:text-ink"
          >
            {t("Clear")}
          </button>
        )}
      </div>
      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="pb-3 pt-1 ps-[26px]">{children}</div>
        </div>
      </div>
    </div>
  );
}
