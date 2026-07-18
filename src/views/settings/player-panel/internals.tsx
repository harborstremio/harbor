import type { ReactNode } from "react";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function DesktopOnlyBlock({ children }: { children: ReactNode }) {
  if (isTauri) return <>{children}</>;
  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40">{children}</div>
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-3">
        <span className="rounded-full border border-edge-soft bg-elevated/95 px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle backdrop-blur-sm">
          Desktop only
        </span>
      </div>
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
      {children}
    </span>
  );
}

export function SubField({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        {value && (
          <span className="font-mono text-[12px] tabular-nums text-ink-muted">{value}</span>
        )}
      </div>
      {children}
    </div>
  );
}

export function previewFamily(id: string): string {
  if (id.startsWith("custom:")) {
    const slug = id.slice("custom:".length);
    return `"harbor-font-${slug}", "Inter", system-ui, sans-serif`;
  }
  switch (id) {
    case "system":
      return '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
    case "serif":
      return '"Fraunces", Georgia, serif';
    case "rounded":
      return '"SF Pro Rounded", "Nunito", system-ui, sans-serif';
    default:
      return '"Inter", system-ui, sans-serif';
  }
}
