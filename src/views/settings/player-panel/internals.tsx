import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";

export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export function DesktopOnlyBlock({ children }: { children: ReactNode }) {
  const t = useT();
  if (isTauri) return <>{children}</>;
  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-40">{children}</div>
      <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-3">
        <span className="rounded-md bg-elevated px-3 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
          {t("Desktop only")}
        </span>
      </div>
    </div>
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
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
          <span className="font-mono text-[12.5px] tabular-nums text-ink-muted">{value}</span>
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
      return '"Fredoka", "SF Pro Rounded", system-ui, sans-serif';
    case "arabic":
      return '"Vazirmatn", "Noto Sans Arabic", system-ui, sans-serif';
    default:
      return '"Inter", system-ui, sans-serif';
  }
}
