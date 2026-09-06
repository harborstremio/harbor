import { Check } from "../../../icons";
import type { ReactNode } from "react";

export function PickGrid({ cols = 2, children }: { cols?: 1 | 2; children: ReactNode }) {
  return <div className={`grid gap-2.5 ${cols === 1 ? "grid-cols-1" : "grid-cols-2"}`}>{children}</div>;
}

export function PickCard({
  selected = false,
  onSelect,
  label,
  hint,
  badgeIcon,
  action,
  children,
}: {
  selected?: boolean;
  onSelect: () => void;
  label: string;
  hint?: string;
  badgeIcon?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="group/pick relative">
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full flex-col overflow-hidden rounded-md text-start outline-none transition-colors duration-200 ease-out hover:harbor-float focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transform-none motion-reduce:transition-none ${
          selected ? "bg-accent-soft ring-2 ring-accent" : "bg-canvas hover:bg-elevated"
        }`}
      >
        {children}
        <span className="flex min-h-11 flex-wrap items-center gap-x-2 gap-y-0.5 px-3.5 pb-2.5 pt-2">
          {badgeIcon && <span className="shrink-0 text-ink-subtle">{badgeIcon}</span>}
          <span className="min-w-0 truncate text-[15.5px] font-medium leading-[22px] text-ink">
            {label}
          </span>
          {hint && (
            <span className="min-w-0 truncate text-[15.5px] leading-[22px] text-ink-subtle">
              {hint}
            </span>
          )}
        </span>
      </button>
      {selected && (
        <span className="pointer-events-none absolute start-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-accent text-canvas">
          <Check size={14} strokeWidth={3} />
        </span>
      )}
      {action && (
        <span className="absolute end-1 top-1 opacity-0 transition-opacity group-hover/pick:opacity-100 focus-within:opacity-100 motion-reduce:opacity-100">
          {action}
        </span>
      )}
    </div>
  );
}
