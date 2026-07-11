import type { ReactNode } from "react";

export function Section({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.22em] text-ink-subtle">
        <span className="text-ink-muted">{icon}</span>
        {label}
      </div>
      {children}
    </div>
  );
}

export function Footer({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-edge-soft bg-canvas/40 px-5 py-3">
      {children}
    </div>
  );
}
