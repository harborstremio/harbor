import { HardDrive } from "lucide-react";

export function LocalBadge({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-canvas/85 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-muted backdrop-blur-sm ${className}`}
    >
      <HardDrive size={9} strokeWidth={2.4} />
      {label}
    </span>
  );
}

export function LocalDot({ className = "", title }: { className?: string; title?: string }) {
  return (
    <span
      className={`pointer-events-none absolute flex h-6 w-6 items-center justify-center rounded-full bg-canvas/85 text-ink ring-1 ring-edge-soft/70 backdrop-blur-sm ${className}`}
      title={title}
      aria-label={title}
    >
      <HardDrive size={11} strokeWidth={2.6} />
    </span>
  );
}
