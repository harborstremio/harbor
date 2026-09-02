import type { CSSProperties } from "react";

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  className = "",
  ariaLabel,
  disabled,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  const span = max - min;
  const pct = span > 0 ? Math.min(100, Math.max(0, ((value - min) / span) * 100)) : 0;
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step ?? 1}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ "--fill": `${pct}%` } as CSSProperties}
      className={`harbor-slider ${disabled ? "opacity-40" : ""} ${className}`}
    />
  );
}

export function fillStyle(value: number, min: number, max: number): CSSProperties {
  const span = max - min;
  const pct = span > 0 ? Math.min(100, Math.max(0, ((value - min) / span) * 100)) : 0;
  return { "--fill": `${pct}%` } as CSSProperties;
}
