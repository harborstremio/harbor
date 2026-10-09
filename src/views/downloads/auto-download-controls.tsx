import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnchoredMenu } from "@/components/anchored-menu";
import type { AutoDlStop } from "@/lib/auto-download";
import { t, useT } from "@/lib/i18n";

export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function useNow(everyMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), everyMs);
    return () => window.clearInterval(id);
  }, [everyMs]);
  return now;
}

export function nextCheckText(nextRunAt: number | null, now: number): string {
  if (nextRunAt == null) return t("checks periodically");
  const delta = nextRunAt - now;
  if (delta <= 60_000) return t("checks any moment");
  if (delta < 3_600_000) return t("checks in {count}m", { count: Math.floor(delta / 60_000) });
  if (delta < 86_400_000) return t("checks in {count}h", { count: Math.floor(delta / 3_600_000) });
  return t("checks in {count}d", { count: Math.floor(delta / 86_400_000) });
}

export function airText(nextAirDate: number | null, now: number): string | null {
  if (nextAirDate == null) return null;
  const delta = nextAirDate - now;
  if (delta <= 0) return null;
  if (delta < 86_400_000)
    return t("next airs in {count}h", { count: Math.max(1, Math.floor(delta / 3_600_000)) });
  const days = Math.floor(delta / 86_400_000);
  if (days <= 21) return t("next airs in {count}d", { count: days });
  return t("next airs in {count}w", { count: Math.floor(days / 7) });
}

export const QUALITY_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "any quality" },
  { value: 2160, label: "up to 4K" },
  { value: 1080, label: "up to 1080p" },
  { value: 720, label: "up to 720p" },
];

export function qualityLabel(maxHeight: number | null): string {
  return t(QUALITY_OPTIONS.find((o) => o.value === maxHeight)?.label ?? "any quality");
}

export const P2P_OPTIONS: { value: boolean; label: string }[] = [
  { value: false, label: "cached only" },
  { value: true, label: "allow P2P downloads" },
];

export function p2pLabel(allowP2p: boolean): string {
  return t(allowP2p ? "allow P2P downloads" : "cached only");
}

export const STOP_OPTIONS: { value: AutoDlStop; label: string }[] = [
  { value: { kind: "off" }, label: "until I stop" },
  { value: { kind: "seasonEnd" }, label: "until the season ends" },
  { value: { kind: "count", value: 1 }, label: "for 1 more episode" },
  { value: { kind: "count", value: 3 }, label: "for 3 more episodes" },
  { value: { kind: "count", value: 5 }, label: "for 5 more episodes" },
  { value: { kind: "count", value: 10 }, label: "for 10 more episodes" },
];

export function stopLabel(stop: AutoDlStop): string {
  if (stop.kind === "off") return t("until I stop");
  if (stop.kind === "seasonEnd") return t("until the season ends");
  return stop.value === 1
    ? t("for 1 more episode")
    : t("for {count} more episodes", { count: stop.value });
}

export function stopEquals(a: AutoDlStop, b: AutoDlStop): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "count" && b.kind === "count") return a.value === b.value;
  return true;
}

export function InlineChoice<T>({
  label,
  options,
  isActive,
  onSelect,
}: {
  label: string;
  options: { value: T; label: string }[];
  isActive: (value: T) => boolean;
  onSelect: (value: T) => void;
}) {
  const translate = useT();
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  return (
    <span className="relative inline-flex">
      <button
        ref={ref}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-ink underline decoration-dotted decoration-edge underline-offset-[5px] transition-colors hover:bg-ink/10 hover:decoration-ink-subtle"
      >
        {label}
        <ChevronDown
          size={13}
          className={`text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <AnchoredMenu anchorRef={ref} open={open} onClose={close} width={210}>
        <div className="overflow-hidden rounded-xl border border-edge bg-raised py-1 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.7)]">
          {options.map((o, i) => {
            const active = isActive(o.value);
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  onSelect(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-3 px-3.5 py-2 text-start text-[13px] transition-colors ${
                  active ? "text-ink" : "text-ink-muted hover:bg-elevated/60 hover:text-ink"
                }`}
              >
                {translate(o.label)}
                {active && <Check size={14} className="text-accent" />}
              </button>
            );
          })}
        </div>
      </AnchoredMenu>
    </span>
  );
}
