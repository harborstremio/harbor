import { useEffect, useState } from "react";
import { useSettings } from "@/lib/settings";

const GOLD = new Set(["HDR", "HDR10+", "DV"]);
const STABLE_MS = 1500;

function useEntered(): boolean {
  const [entered, setEntered] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(r);
  }, []);
  return entered;
}

function Chip({ label, on, index }: { label: string; on: boolean; index: number }) {
  const gold = GOLD.has(label);
  return (
    <span
      style={{ transitionDelay: on ? `${index * 60}ms` : "0ms" }}
      className={`inline-flex shrink-0 select-none items-center rounded-md border px-1.5 py-[3px] text-[10.5px] font-bold uppercase leading-none tracking-[0.09em] tabular-nums shadow-[0_1px_3px_rgba(0,0,0,0.28)] transition-[opacity,transform] duration-[280ms] ease-out ${
        on ? "translate-y-0 opacity-100" : "translate-y-[7px] opacity-0"
      } ${
        gold
          ? "border-amber-300/40 bg-amber-300/[0.12] text-amber-200"
          : "border-white/25 bg-white/[0.08] text-white/90"
      }`}
    >
      {label}
    </span>
  );
}

function BarReveal({ labels, on }: { labels: string[]; on: boolean }) {
  return (
    <div className="flex items-stretch gap-2.5 self-start pt-[2px]">
      <span
        aria-hidden
        className={`w-[2.5px] shrink-0 origin-top rounded-full bg-accent transition-transform duration-[440ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          on ? "scale-y-100" : "scale-y-0"
        }`}
      />
      <div className="flex flex-col justify-center gap-[5px]">
        {labels.map((label, i) => {
          const gold = GOLD.has(label);
          return (
            <span
              key={label}
              style={{ transitionDelay: on ? `${200 + i * 85}ms` : "0ms" }}
              className={`text-[12.5px] font-semibold uppercase leading-none tracking-[0.1em] tabular-nums drop-shadow-[0_1px_4px_rgba(0,0,0,0.6)] transition-[opacity,transform] duration-[320ms] ease-out ${
                on ? "translate-x-0 opacity-100" : "-translate-x-1.5 opacity-0"
              } ${gold ? "text-amber-300" : "text-white/90"}`}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function QualityBadgeDisplay({ items, show, bar }: { items: string[]; show: boolean; bar: boolean }) {
  const entered = useEntered();
  const on = show && entered;
  if (bar) return <BarReveal labels={items} on={on} />;
  return (
    <>
      {items.map((l, i) => (
        <Chip key={l} label={l} on={on} index={i} />
      ))}
    </>
  );
}

export function QualityInfo({
  labels,
  show = true,
}: {
  labels: (string | null | undefined)[];
  show?: boolean;
}) {
  const { settings } = useSettings();
  const items = labels.filter((l): l is string => !!l);
  const key = items.join("|");
  const [settledKey, setSettledKey] = useState<string | null>(null);
  useEffect(() => {
    if (!key) {
      setSettledKey(null);
      return;
    }
    if (key === settledKey) return;
    const timer = window.setTimeout(() => setSettledKey(key), STABLE_MS);
    return () => window.clearTimeout(timer);
  }, [key, settledKey]);
  if (!key || settledKey !== key) return null;
  return <QualityBadgeDisplay items={items} show={show} bar={settings.qualityBadgeStyle === "bar"} />;
}
