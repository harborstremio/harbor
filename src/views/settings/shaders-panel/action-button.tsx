import type { ReactNode } from "react";

export function ActionButton({
  onClick,
  ghost,
  disabled,
  children,
}: {
  onClick: () => void;
  ghost?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`harbor-press-pop flex h-9 shrink-0 items-center gap-2 rounded-md px-4 text-[12.5px] font-semibold transition-colors disabled:cursor-wait disabled:opacity-70 ${
        ghost ? "bg-canvas text-ink-muted hover:text-ink" : "bg-ink text-canvas hover:opacity-90"
      }`}
    >
      {children}
    </button>
  );
}

export function Pill({ on, children }: { on?: boolean; children: ReactNode }) {
  return (
    <span
      className={`rounded-full px-2 py-[3px] text-[10.5px] font-semibold uppercase tracking-wider ${
        on ? "bg-ink text-canvas" : "bg-canvas text-ink-subtle"
      }`}
    >
      {children}
    </span>
  );
}
