import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";

function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors motion-reduce:transition-none ${on ? "bg-accent" : "bg-edge"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-canvas transition-transform motion-reduce:transition-none ${
          on ? "translate-x-[22px] rtl:-translate-x-[22px]" : "translate-x-0.5 rtl:-translate-x-0.5"
        }`}
      />
    </span>
  );
}

export function TraktSourceRow({
  label,
  sub,
  on,
  onToggle,
  disabled,
  onConnect,
  icon,
}: {
  label: string;
  sub: string;
  on: boolean;
  onToggle: () => void;
  disabled?: boolean;
  onConnect?: () => void;
  icon: ReactNode;
}) {
  const t = useT();
  if (disabled) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 opacity-80 ring-1 ring-edge-soft/60">
        <span className="shrink-0 text-ink-muted">{icon}</span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[13.5px] font-semibold text-ink">{label}</span>
          <span className="text-[12px] text-ink-subtle">
            {sub}
            {onConnect && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={onConnect}
                  className="font-semibold text-ink underline underline-offset-2 transition-colors hover:text-ink-muted"
                >
                  {t("Connect")}
                </button>
              </>
            )}
          </span>
        </span>
        <Switch on={false} />
      </div>
    );
  }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onToggle}
      className="flex items-center gap-3 rounded-xl bg-surface px-4 py-3 text-start ring-1 ring-edge-soft transition-colors hover:ring-edge"
    >
      <span className="shrink-0 text-ink-muted">{icon}</span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[13.5px] font-semibold text-ink">{label}</span>
        <span className="text-[12px] text-ink-subtle">{sub}</span>
      </span>
      <Switch on={on} />
    </button>
  );
}
