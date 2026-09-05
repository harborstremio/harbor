import type { ReactNode } from "react";
import { SButton } from "../ui";

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
    <SButton variant={ghost ? "secondary" : "primary"} onClick={onClick} disabled={disabled}>
      {children}
    </SButton>
  );
}

export function Pill({ on, children }: { on?: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px] ${
        on ? "bg-accent-soft text-accent" : "bg-elevated text-ink-subtle"
      }`}
    >
      {children}
    </span>
  );
}
