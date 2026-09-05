import { AlertCircle, ArrowDownToLine, Check, ChevronRight, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useT } from "@/lib/i18n";
import { IconFan, type IconThumb } from "./icon-fan";
import type { AcquireState } from "./use-acquire";
import { fmtCount } from "../format";

const SIZE: Record<"sm" | "md" | "lg", string> = {
  sm: "h-11 gap-1.5 px-4 text-[15px]",
  md: "h-11 gap-2 px-5 text-[15.5px]",
  lg: "h-12 gap-2 px-6 text-[16.5px]",
};

export function MarketCta({
  variant,
  state = "idle",
  onClick,
  size = "md",
  label,
  count,
  noun,
  sublabel,
  preview,
  children,
}: {
  variant: "acquire" | "ghost" | "browse";
  state?: AcquireState;
  onClick?: (e: React.MouseEvent) => void;
  size?: "sm" | "md" | "lg";
  label?: string;
  count?: number;
  noun?: string;
  sublabel?: string;
  preview?: IconThumb[];
  children?: ReactNode;
}) {
  const t = useT();
  if (variant === "browse") {
    const meta =
      sublabel ??
      (count != null
        ? t("{count} {noun} · updated weekly", { count: fmtCount(count), noun: t(noun ?? "packs") })
        : "");
    return (
      <button
        type="button"
        onClick={onClick}
        className="group flex min-h-[68px] w-full items-center gap-3 rounded-[10px] bg-surface pe-3 ps-4 text-start ring-1 ring-edge-soft transition-colors hover:bg-elevated"
      >
        <IconFan icons={preview ?? []} />
        <span className="min-w-0 flex-1">
          <span className="block text-[16.5px] font-medium leading-[24px] text-ink">
            {label ? t(label) : t("Browse community")}
          </span>
          {meta && (
            <span className="block text-[15.5px] leading-[22px] text-ink-subtle tabular-nums">
              {meta}
            </span>
          )}
        </span>
        <ChevronRight
          size={18}
          className="dir-icon me-1 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 motion-reduce:transform-none"
        />
      </button>
    );
  }

  if (variant === "ghost") {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center justify-center rounded-md bg-elevated font-semibold text-ink ring-1 ring-edge-soft transition-[transform,box-shadow] duration-150 hover:ring-edge active:scale-[0.97] motion-reduce:transform-none ${SIZE[size]}`}
      >
        {children ?? (label ? t(label) : t("View details"))}
      </button>
    );
  }

  const skin =
    state === "done"
      ? "bg-success text-canvas"
      : state === "error"
        ? "bg-danger text-canvas"
        : "bg-ink text-canvas";
  const text =
    state === "done"
      ? t("Added")
      : state === "error"
        ? t("Try again")
        : label
          ? t(label)
          : t("Get");
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "loading"}
      aria-label={text}
      className={`inline-flex items-center justify-center rounded-md font-semibold transition-[transform,background-color] duration-150 active:scale-[0.97] disabled:cursor-default motion-reduce:transform-none ${SIZE[size]} ${skin}`}
    >
      {state === "loading" ? (
        <Loader2 size={18} className="animate-spin" />
      ) : state === "done" ? (
        <Check size={18} className="harbor-pop" />
      ) : state === "error" ? (
        <AlertCircle size={18} />
      ) : (
        <ArrowDownToLine size={18} strokeWidth={2.4} />
      )}
      {text}
    </button>
  );
}
