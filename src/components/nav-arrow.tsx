import type { CSSProperties } from "react";
import { useT } from "@/lib/i18n";

const CHEVRON =
  "M278.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-160 160c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L210.7 256 73.4 118.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l160 160z";

const ROT: Record<string, number> = { right: 0, down: 90, left: 180, up: -90 };

export function NavChevron({
  dir,
  size = 32,
  className = "",
}: {
  dir: "left" | "right" | "up" | "down";
  size?: number;
  className?: string;
}) {
  const directional = dir === "left" || dir === "right";
  return (
    <svg
      viewBox="0 0 320 512"
      width={size}
      height={size}
      style={{ transform: `rotate(${ROT[dir]}deg)` }}
      className={`${directional ? "dir-icon" : ""} ${className}`}
      aria-hidden
    >
      <path d={CHEVRON} fill="currentColor" />
    </svg>
  );
}

export function NavArrow({
  dir,
  onClick,
  label,
  size = 32,
  className = "",
}: {
  dir: "left" | "right" | "up" | "down";
  onClick: () => void;
  label: string;
  size?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`grid place-items-center text-white/85 drop-shadow-[0_2px_7px_rgba(0,0,0,0.75)] transition-all duration-150 hover:scale-110 hover:text-white active:scale-95 ${className}`}
    >
      <NavChevron dir={dir} size={size} />
    </button>
  );
}

export function RailChevron({
  side,
  visible,
  onClick,
  outset = 40,
  size = 54,
  nudgeY = 0,
  always = false,
}: {
  side: "left" | "right";
  visible: boolean;
  onClick: () => void;
  outset?: number;
  size?: number;
  nudgeY?: number;
  always?: boolean;
}) {
  const t = useT();
  const label = t(side === "left" ? "Scroll left" : "Scroll right");
  const enter = side === "left" ? "-translate-x-2.5" : "translate-x-2.5";
  const chev = !visible
    ? "opacity-0"
    : always
      ? "opacity-100"
      : `opacity-0 ${enter} scale-[0.6] group-hover/edge:opacity-100 group-hover/edge:translate-x-0 group-hover/edge:scale-100 group-focus-visible/edge:opacity-100 group-focus-visible/edge:translate-x-0 group-focus-visible/edge:scale-100`;
  const style: CSSProperties = { transform: nudgeY ? `translateY(${nudgeY}%)` : undefined };
  if (side === "left") style.insetInlineStart = `-${outset}px`;
  else style.insetInlineEnd = `-${outset}px`;
  return (
    <div
      className={`pointer-events-none absolute inset-y-0 z-30 flex w-16 items-center ${
        side === "left" ? "justify-start" : "justify-end"
      }`}
      style={style}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        tabIndex={visible ? 0 : -1}
        className={`group/edge grid h-full w-full place-items-center ${
          visible ? "pointer-events-auto" : "pointer-events-none"
        }`}
      >
        <span
          className={`grid place-items-center text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)] transition-all duration-[320ms] ease-[cubic-bezier(0.34,1.45,0.5,1)] group-active/edge:scale-90 ${chev}`}
        >
          <NavChevron dir={side} size={size} />
        </span>
      </button>
    </div>
  );
}
