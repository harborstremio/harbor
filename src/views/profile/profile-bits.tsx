import { useState } from "react";
import { Star } from "lucide-react";
import { CatAvatar } from "@/components/icons/cat-avatar";
import { BADGE_ICON_BASE } from "./badge-catalog";

export function Avatar({
  src,
  fallbackSrc,
  size,
  online,
  dotClass,
  alias,
}: {
  src?: string;
  fallbackSrc?: string;
  size: number;
  online?: boolean;
  dotClass?: string;
  alias?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initial = (alias ?? "").trim().charAt(0).toUpperCase();
  const primary = !failed ? src : undefined;
  const resolved = primary || fallbackSrc;
  const showImg = !!resolved;
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span className="grid h-full w-full place-items-center overflow-hidden rounded-full bg-elevated ring-2 ring-edge-soft">
        {showImg ? (
          <img src={resolved} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" draggable={false} />
        ) : initial ? (
          <span className="font-display font-medium text-ink-muted" style={{ fontSize: size * 0.42 }}>
            {initial}
          </span>
        ) : (
          <CatAvatar className="h-full w-full" />
        )}
      </span>
      {(dotClass !== undefined || online !== undefined) && (
        <span
          className={`absolute bottom-0.5 end-0.5 rounded-full ring-2 ring-canvas ${
            dotClass ?? (online ? "bg-success" : "bg-ink-subtle")
          }`}
          style={{ width: size * 0.22, height: size * 0.22 }}
        />
      )}
    </span>
  );
}

export function VerifiedCheck({ size = 20 }: { size?: number }) {
  return (
    <span className="group relative inline-flex">
      <img
        src={`${BADGE_ICON_BASE}/verified.webp`}
        width={size}
        height={size}
        className="inline-block"
        draggable={false}
        alt="Verified"
      />
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-[10px] bg-elevated px-2 py-1 text-[11px] font-medium text-ink opacity-0 shadow-lg ring-1 ring-edge-soft transition-opacity duration-150 group-hover:opacity-100">
        Verified
      </span>
    </span>
  );
}

export function FeaturedBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-[6px] bg-accent-soft px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-accent">
      <Star size={14} strokeWidth={2.4} className="fill-accent" />
      Featured
    </span>
  );
}

export function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex flex-col items-center rounded-[10px] bg-surface px-4 py-2.5 ring-1 ring-edge-soft">
      <span className="text-[17px] font-semibold tabular-nums text-ink">{value}</span>
      <span className="text-[11px] uppercase tracking-[0.1em] text-ink-subtle">{label}</span>
    </div>
  );
}

export function compactNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`;
  return String(n);
}

/** Returns exactly 3 fixed time units for the WATCH TIME pill.
 *  < 12 months  → { a: "M", aVal, b: "D", bVal, c: "H", cVal }
 *  >= 12 months → { a: "Y", aVal, b: "M", bVal, c: "D", cVal }
 */
export function formatWatchTime(totalMinutes: number): {
  a: string; aVal: number;
  b: string; bVal: number;
  c: string; cVal: number;
} {
  const totalHours = Math.floor(totalMinutes / 60);
  const hours = totalHours % 24;
  const totalDays = Math.floor(totalHours / 24);
  const totalMonths = Math.floor(totalDays / 30);

  if (totalMonths < 12) {
    // M D H
    const months = totalMonths;
    const days = totalDays % 30;
    return { a: "M", aVal: months, b: "D", bVal: days, c: "H", cVal: hours };
  }
  // Y M D
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const days = totalDays % 30;
  return { a: "Y", aVal: years, b: "M", bVal: months, c: "D", cVal: days };
}

export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const s = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
