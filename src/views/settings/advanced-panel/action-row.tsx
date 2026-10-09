import { type ReactNode } from "react";
import { ROW_ACTION, ROW_ACTION_DANGER, SettingRow } from "../kit";

const BTN_SUCCESS =
  "harbor-press-pop flex h-11 shrink-0 items-center gap-2 rounded-[8px] border border-transparent bg-accent-soft px-4 text-[15px] font-semibold text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-45";

export function ActionRow({
  label,
  sub,
  cta,
  icon,
  tone = "neutral",
  warn,
  onClick,
  disabled,
}: {
  label: string;
  sub: string;
  cta?: string;
  icon?: ReactNode;
  tone?: "neutral" | "success" | "danger";
  warn?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const unavailable = !!disabled && !cta;
  return (
    <SettingRow
      label={label}
      desc={sub}
      warn={warn}
      lockReason={unavailable ? sub : undefined}
    >
      {cta && (
        <button
          type="button"
          onClick={disabled ? undefined : onClick}
          aria-disabled={disabled}
          className={`${
            tone === "danger"
              ? ROW_ACTION_DANGER
              : tone === "success"
                ? BTN_SUCCESS
                : ROW_ACTION
          }${disabled ? " pointer-events-none opacity-45" : ""}`}
        >
          {icon}
          {cta}
        </button>
      )}
    </SettingRow>
  );
}
