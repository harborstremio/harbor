import { useState } from "react";
import { Star } from "lucide-react";

const STARS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

function fillLevel(n: number, active: number): 0 | 0.5 | 1 {
  if (active >= n) return 1;
  if (active === n - 0.5) return 0.5;
  return 0;
}

function StarGlyph({ size, fill }: { size: number; fill: 0 | 0.5 | 1 }) {
  if (fill !== 0.5) {
    return (
      <Star
        size={size}
        fill={fill ? "currentColor" : "none"}
        className={fill ? "text-ink" : "text-ink-subtle/25"}
      />
    );
  }
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <Star size={size} fill="none" className="text-ink-subtle/25" />
      <span className="absolute inset-y-0 start-0 w-1/2 overflow-hidden">
        <Star size={size} fill="currentColor" className="text-ink" />
      </span>
    </span>
  );
}

function valueAt(n: number, e: React.MouseEvent<HTMLElement>): number {
  const rect = e.currentTarget.getBoundingClientRect();
  const ratio = (e.clientX - rect.left) / rect.width;
  const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
  const firstHalf = rtl ? ratio >= 0.5 : ratio < 0.5;
  return firstHalf ? n - 0.5 : n;
}

export function RatingStars({
  value,
  onChange,
  onHover,
  size = 22,
  readOnly = false,
  ariaLabel,
}: {
  value: number;
  onChange?: (n: number) => void;
  onHover?: (n: number) => void;
  size?: number;
  readOnly?: boolean;
  ariaLabel?: string;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value || 0;

  if (readOnly) {
    return (
      <div
        className="inline-flex items-center gap-[2px]"
        role="img"
        aria-label={ariaLabel ?? `${value} out of 10`}
      >
        {STARS.map((n) => (
          <StarGlyph key={n} size={size} fill={fillLevel(n, value)} />
        ))}
      </div>
    );
  }

  const set = (n: number) => {
    setHover(n);
    onHover?.(n);
  };

  return (
    <div
      className="inline-flex items-center"
      role="slider"
      aria-label={ariaLabel ?? "Your rating"}
      aria-valuemin={0}
      aria-valuemax={10}
      aria-valuenow={value}
      aria-valuetext={`${value} / 10`}
      onMouseLeave={() => set(0)}
    >
      {STARS.map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} / 10`}
          className="flex items-center justify-center rounded-md p-1 outline-none transition-transform duration-200 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:scale-[1.28] focus-visible:scale-[1.28] active:scale-90 motion-reduce:transition-none motion-reduce:hover:scale-100"
          onMouseMove={(e) => set(valueAt(n, e))}
          onFocus={(e) => {
            if (e.currentTarget.matches(":focus-visible")) set(n);
          }}
          onBlur={() => set(0)}
          onPointerDown={(e) => {
            if (e.button === 0) onChange?.(valueAt(n, e));
          }}
          onClick={(e) => {
            if (e.detail === 0) onChange?.(n);
          }}
        >
          <StarGlyph size={size} fill={fillLevel(n, active)} />
        </button>
      ))}
    </div>
  );
}
