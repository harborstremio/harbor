import type { CSSProperties } from "react";
import { useT } from "@/lib/i18n";

const MAX_NOTCHES = 60;

function trackStyle(value: number, min: number, max: number, step?: number): CSSProperties {
  const span = max - min;
  const pct = span > 0 ? Math.min(100, Math.max(0, ((value - min) / span) * 100)) : 0;
  const size = step && step > 0 ? step : 1;
  const steps = span > 0 ? Math.round(span / size) : 0;
  const notches = steps > 1 ? Math.min(MAX_NOTCHES, steps) : 0;
  return {
    "--fill": `${pct}%`,
    "--notch": notches > 0 ? `${100 / notches}%` : "0%",
  } as CSSProperties;
}

export function SliderReset({ show, onReset, settingName }: { show: boolean; onReset: () => void; settingName?: string }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onReset}
      aria-label={settingName ? t("Reset {setting}", { setting: settingName }) : t("Reset")}
      tabIndex={show ? 0 : -1}
      aria-hidden={!show}
      className={`shrink-0 text-[11.5px] text-ink-subtle underline-offset-2 transition-opacity duration-150 hover:text-ink hover:underline ${
        show ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      {t("Reset")}
    </button>
  );
}

export function Slider({
  value,
  min,
  max,
  step,
  onChange,
  className = "",
  ariaLabel,
  disabled,
  resetTo,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  resetTo?: number;
}) {
  return (
    <>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(e) => onChange(Number(e.target.value))}
        style={trackStyle(value, min, max, step)}
        className={`harbor-slider ${disabled ? "opacity-40" : ""} ${className}`}
      />
      {resetTo !== undefined && (
        <SliderReset settingName={ariaLabel} show={value !== resetTo} onReset={() => onChange(resetTo)} />
      )}
    </>
  );
}

export function fillStyle(value: number, min: number, max: number, step?: number): CSSProperties {
  return trackStyle(value, min, max, step);
}
