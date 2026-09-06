import type { ReactNode } from "react";
import { ROW_ACTION, ROW_ACTION_DANGER, ROW_ACTION_PRIMARY, ROW_DESC, ROW_TITLE } from "./kit";
import { RowControl, RowDesc, RowText, RowTitle, useGroupHeadingVisible, useRegisterRowTitle } from "./shared";

export const S_TITLE = ROW_TITLE;
export const S_DESC = ROW_DESC;
export const S_LABEL = "harbor-settings-label";

export function SSection({
  label,
  action,
  children,
}: {
  label?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const showHeading = useGroupHeadingVisible(label);
  return (
    <section className="harbor-settings-section flex flex-col gap-[11px]">
      {(showHeading || action) && (
        <div className="flex min-h-[17px] items-center justify-between gap-3">
          {showHeading && label ? <h2 className={S_LABEL}>{label}</h2> : <span />}
          {action}
        </div>
      )}
      <div className="harbor-settings-group">{children}</div>
    </section>
  );
}

export function SCard({
  children,
  className = "",
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return <div className={`${pad ? "py-1" : ""} ${className}`}>{children}</div>;
}

export function SRow({
  title,
  description,
  leading,
  trailing,
  onClick,
  disabled,
  selected,
  className = "",
}: {
  title: ReactNode;
  description?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  selected?: boolean;
  className?: string;
}) {
  useRegisterRowTitle(title);
  const body = (
    <>
      <RowText lead={leading}>
        <RowTitle>
          <span className="min-w-0">{title}</span>
        </RowTitle>
        {description && <RowDesc>{description}</RowDesc>}
      </RowText>
      {trailing && <RowControl>{trailing}</RowControl>}
    </>
  );
  if (!onClick) return <div className={`hset-row ${className}`}>{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      data-interactive=""
      className={`hset-row text-start ${disabled ? "cursor-default opacity-60" : ""} ${className}`}
    >
      {body}
    </button>
  );
}

export function SButton({
  variant = "secondary",
  onClick,
  disabled,
  title,
  className = "",
  children,
}: {
  variant?: "secondary" | "primary" | "danger";
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  const base =
    variant === "primary"
      ? ROW_ACTION_PRIMARY
      : variant === "danger"
        ? ROW_ACTION_DANGER
        : ROW_ACTION;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} ${className}`}
    >
      {children}
    </button>
  );
}
