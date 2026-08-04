import type { ReactNode } from "react";

export function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col px-3 pb-1">
      <h3 className="px-3 pb-1 pt-3 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {label}
      </h3>
      {children}
    </div>
  );
}

export function SheetRow({
  icon,
  label,
  sublabel,
  hint,
  active,
  disabled,
  trailing,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  sublabel?: string;
  hint?: string;
  active?: boolean;
  disabled?: boolean;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-3.5 rounded-2xl px-3 py-2.5 text-start transition-colors motion-reduce:transition-none ${
        disabled ? "opacity-45" : "active:bg-elevated/50"
      }`}
    >
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
          active ? "bg-accent/15 text-accent" : "bg-surface text-ink"
        }`}
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-medium text-ink">{label}</span>
        {sublabel && <span className="text-[12px] leading-tight text-ink-subtle">{sublabel}</span>}
        {hint && <span className="text-[11px] leading-tight text-ink-subtle/80">{hint}</span>}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
    </button>
  );
}
