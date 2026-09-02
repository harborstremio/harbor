import { type ReactNode } from "react";
import { SettingRow } from "../kit";

export function ActionRow({
  label,
  sub,
  cta,
  icon,
  tone = "neutral",
  onClick,
  disabled,
}: {
  label: string;
  sub: string;
  cta?: string;
  icon?: ReactNode;
  tone?: "neutral" | "success";
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={disabled ? "opacity-60" : ""}>
      <SettingRow label={label} desc={sub}>
        {cta && (
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`harbor-press-pop flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-[12.5px] font-semibold transition-colors ${
              tone === "success"
                ? "bg-accent-soft text-accent"
                : "bg-raised text-ink-muted hover:text-ink"
            } disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {icon}
            {cta}
          </button>
        )}
      </SettingRow>
    </div>
  );
}
