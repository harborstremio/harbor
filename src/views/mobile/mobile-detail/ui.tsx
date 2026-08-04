import { useState } from "react";

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-[18px] font-medium tracking-tight text-ink">{children}</h2>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-surface/90 px-2.5 py-1 text-[12.5px] font-medium text-ink-muted ring-1 ring-edge-soft/70 backdrop-blur-sm">
      {children}
    </span>
  );
}

export function Line({ className = "" }: { className?: string }) {
  return <span className={`h-3.5 animate-pulse rounded bg-elevated/70 ${className}`} />;
}

export function Overview({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-col items-start gap-1.5">
      <p className={`text-[14.5px] leading-relaxed text-ink-muted ${open ? "" : "line-clamp-4"}`}>
        {text}
      </p>
      {text.length > 180 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[13px] font-semibold text-accent transition-opacity active:opacity-70 motion-reduce:transition-none"
        >
          {open ? "Less" : "More"}
        </button>
      )}
    </div>
  );
}
