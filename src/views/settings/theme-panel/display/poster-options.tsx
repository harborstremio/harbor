import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { tvFocus } from "@/lib/keyboard-navigation";
import { CENTER_KEYCODES, isBackKey, navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import { useT } from "@/lib/i18n";

export const POSTER_RADII = [
  { value: "sharp", label: "Sharp", px: 0 },
  { value: "subtle", label: "Subtle", px: 6 },
  { value: "classic", label: "Classic", px: 12 },
  { value: "rounded", label: "Rounded", px: 18 },
  { value: "pill", label: "Pill", px: 28 },
];

export function radiusKey(px: number): string {
  return POSTER_RADII.reduce((best, p) => (Math.abs(p.px - px) < Math.abs(best.px - px) ? p : best))
    .value;
}

export function PxField({
  value,
  min,
  max,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (v: number) => void;
}) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ringRef = useRef(false);
  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);
  useLayoutEffect(() => {
    if (!ringRef.current) return;
    const el = editing ? inputRef.current : btnRef.current;
    if (el) tvFocus(el);
  }, [editing]);
  const commit = () => {
    const n = Math.max(min, Math.min(max, Math.round(Number(draft) || value)));
    onCommit(n);
    setEditing(false);
  };
  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        autoFocus
        value={draft}
        min={min}
        max={max}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === "Enter" || CENTER_KEYCODES.has(e.nativeEvent.keyCode)) {
            e.preventDefault();
            commit();
          } else if (isBackKey(e.nativeEvent)) {
            e.preventDefault();
            setEditing(false);
          }
        }}
        className="h-11 w-[96px] rounded-[10px] border border-edge bg-raised px-3 text-center text-[16.5px] font-semibold tabular-nums text-ink outline-none"
      />
    );
  }
  return (
    <button
      ref={btnRef}
      type="button"
      onClick={() => {
        ringRef.current = navOwnsFocus(btnRef.current);
        setEditing(true);
      }}
      title={t("Click to edit")}
      className="h-11 w-[96px] rounded-[10px] border border-edge-soft bg-elevated text-center text-[16.5px] font-semibold tabular-nums text-ink-muted transition-colors hover:border-edge hover:bg-raised hover:text-ink"
    >
      {value}px
    </button>
  );
}

export const POSTER_SIZES = [
  { value: "compact", label: "Compact", scale: 0.8 },
  { value: "dense", label: "Dense", scale: 0.9 },
  { value: "standard", label: "Standard", scale: 1 },
  { value: "balanced", label: "Balanced", scale: 1.15 },
  { value: "comfort", label: "Comfort", scale: 1.3 },
  { value: "large", label: "Large", scale: 1.5 },
] as const;

export function posterSizeKey(scale: number): string {
  let best: (typeof POSTER_SIZES)[number] = POSTER_SIZES[0];
  for (const p of POSTER_SIZES) {
    if (Math.abs(p.scale - scale) < Math.abs(best.scale - scale)) best = p;
  }
  return best.value;
}
