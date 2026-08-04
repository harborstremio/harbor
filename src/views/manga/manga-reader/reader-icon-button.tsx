import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Tooltip } from "@/views/detail/tooltip";

const BASE =
  "inline-flex shrink-0 items-center justify-center rounded-xl text-ink-muted transition duration-150 hover:bg-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 active:scale-90 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none motion-reduce:active:scale-100";

const SIZES = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
  lg: "h-12 w-12",
} as const;

export type ReaderIconButtonProps = {
  label: string;
  children: ReactNode;
  size?: keyof typeof SIZES;
  tooltipSide?: "top" | "bottom";
  pressed?: boolean;
  className?: string;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "aria-label" | "className">;

/**
 * Shared chrome control for the manga reader toolbar/settings.
 * Always pairs an icon with an accessible name and optional tooltip.
 */
export function ReaderIconButton({
  label,
  children,
  size = "md",
  tooltipSide = "bottom",
  pressed,
  className = "",
  type = "button",
  onMouseDown,
  ...rest
}: ReaderIconButtonProps) {
  const btn = (
    <button
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      className={`${BASE} ${SIZES[size]} ${pressed ? "bg-accent/15 text-accent" : ""} ${className}`}
      onMouseDown={(e) => {
        // Keep focus on the reading surface / avoid stealing keyboard nav.
        e.preventDefault();
        onMouseDown?.(e);
      }}
      {...rest}
    >
      {children}
    </button>
  );
  return (
    <Tooltip label={label} side={tooltipSide}>
      {btn}
    </Tooltip>
  );
}

export const READER_ICON_STROKE = 2.2;
export const READER_ICON_CLASS = "h-5 w-5";
