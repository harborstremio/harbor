import type { ReactNode } from "react";
import { useKnobAnim } from "@/lib/knob-anim";

export const BARE_ICON =
  "harbor-press-pop grid h-11 w-11 shrink-0 place-items-center rounded-[8px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-45";

export function Chip({ accent, children }: { accent?: boolean; children: ReactNode }) {
  return (
    <span
      className={`inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[12px] font-bold uppercase leading-[17px] tracking-[0.06em] ${
        accent ? "bg-accent-soft text-accent" : "bg-elevated text-ink-subtle"
      }`}
    >
      {children}
    </span>
  );
}

export function Switch({
  value,
  locked,
  label,
  onChange,
}: {
  value: boolean;
  locked?: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  const effective = value && !locked;
  const knobAnim = useKnobAnim(effective);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={effective}
      aria-label={label}
      disabled={locked}
      data-ctl="switch"
      onClick={() => !locked && onChange(!value)}
      className={`shrink-0 ${locked ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <span
        aria-hidden
        className={`relative block h-8 w-12 rounded-full transition-colors ${effective ? "bg-ink" : "bg-edge"}`}
      >
        <span
          className={`absolute start-[3px] top-[3px] h-[26px] w-[26px] rounded-full bg-canvas ${
            effective ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"
          } ${knobAnim}`}
        />
      </span>
    </button>
  );
}

const ANY_LANGUAGE = new Set(["all", "multi", "*", "any"]);

export function languageNames(codes: string[], uiLang: string, allLabel: string): string {
  if (!codes.length) return "";
  if (codes.some((c) => ANY_LANGUAGE.has(c.toLowerCase()))) return allLabel;
  try {
    const names = new Intl.DisplayNames([uiLang], { type: "language" });
    return codes
      .slice(0, 3)
      .map((c) => {
        try {
          return names.of(c) ?? c;
        } catch {
          return c;
        }
      })
      .join(", ");
  } catch {
    return codes.slice(0, 3).join(", ");
  }
}
