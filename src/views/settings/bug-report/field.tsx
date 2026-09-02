import type { ReactNode } from "react";

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 rounded-md bg-elevated px-4 py-3.5">
      <span className="flex items-center gap-1 text-[10.5px] font-bold uppercase tracking-[0.18em] text-ink-subtle">
        {label}
        {required && <span className="text-accent">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11.5px] leading-snug text-ink-subtle">{hint}</span>}
    </label>
  );
}
