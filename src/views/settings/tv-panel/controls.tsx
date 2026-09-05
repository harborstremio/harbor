import { useRef } from "react";
import { fillStyle } from "@/components/slider";
import { useT } from "@/lib/i18n";
import { tvFocus } from "@/lib/keyboard-navigation";
import { navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import { NewBadge } from "../new-badge";
import { SettingRow } from "../kit";
import { SButton } from "../ui";
import { Segmented } from "../shared";
import type { TvChoice } from "./model-lists";

const QUAL =
  "inline-flex h-[22px] shrink-0 items-center rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

export function segmentedWide(options: ReadonlyArray<TvChoice>): boolean {
  const n = options.length;
  if (n === 0) return false;
  const chars = options.reduce((sum, o) => sum + o.label.length, 0);
  return 8 + 2 * (n - 1) + 32 * n + 8.2 * chars * 1.3 > 320;
}

function TvOnly() {
  const t = useT();
  return <span className={`${QUAL} bg-elevated text-ink-subtle`}>{t("TV only")}</span>;
}

function RowLabel({ label, tvOnly, newId }: { label: string; tvOnly?: boolean; newId?: string }) {
  const t = useT();
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
      <span className="min-w-0">{t(label)}</span>
      {tvOnly && <TvOnly />}
      {newId && <NewBadge id={newId} />}
    </span>
  );
}

export function ChoiceRow({
  label,
  sub,
  tvOnly,
  newId,
  value,
  options,
  onChange,
}: {
  label: string;
  sub?: string;
  tvOnly?: boolean;
  newId?: string;
  value: string;
  options: TvChoice[];
  onChange: (v: string) => void;
}) {
  const t = useT();
  return (
    <SettingRow
      wide={segmentedWide(options)}
      label={<RowLabel label={label} tvOnly={tvOnly} newId={newId} />}
      desc={sub ? t(sub) : undefined}
    >
      <Segmented value={value} options={options} onChange={onChange} />
    </SettingRow>
  );
}

export function StepRow({
  label,
  sub,
  tvOnly,
  newId,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  sub?: string;
  tvOnly?: boolean;
  newId?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const t = useT();
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <SettingRow
      wide
      label={<RowLabel label={label} tvOnly={tvOnly} newId={newId} />}
      desc={sub ? t(sub) : undefined}
    >
      <div className="flex h-11 w-full max-w-[520px] items-center gap-4">
        <StepButton glyph="minus" label={t("Minus")} onClick={() => onChange(clamp(value - step))} />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={t(label)}
          onChange={(e) => onChange(clamp(Number.parseInt(e.target.value, 10)))}
          className="harbor-slider min-w-0 flex-1"
          style={fillStyle(value, min, max, step)}
        />
        <StepButton glyph="plus" label={t("Plus")} onClick={() => onChange(clamp(value + step))} />
        <span className="w-14 shrink-0 text-end text-[15.5px] font-semibold tabular-nums leading-[22px] text-ink">
          {value}
          {unit ?? ""}
        </span>
      </div>
    </SettingRow>
  );
}

function StepButton({
  glyph,
  label,
  onClick,
}: {
  glyph: "minus" | "plus";
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      data-tv-skip
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] bg-raised text-ink-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        {glyph === "plus" && (
          <path d="M12 5v14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        )}
      </svg>
    </button>
  );
}

export function ChipMulti({
  label,
  sub,
  tvOnly,
  newId,
  value,
  options,
  onChange,
  ordered,
}: {
  label: string;
  sub?: string;
  tvOnly?: boolean;
  newId?: string;
  value: string[];
  options: TvChoice[];
  onChange: (v: string[]) => void;
  ordered?: boolean;
}) {
  const t = useT();
  const firstChip = useRef<HTMLButtonElement | null>(null);
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  const clear = () => {
    const back = firstChip.current;
    if (back && navOwnsFocus(document.activeElement as HTMLElement | null)) tvFocus(back);
    onChange([]);
  };
  return (
    <SettingRow
      wide
      label={<RowLabel label={label} tvOnly={tvOnly} newId={newId} />}
      desc={sub ? t(sub) : undefined}
    >
      <div className="flex min-w-0 flex-1 flex-wrap gap-2">
        {options.map((o, i) => {
          const at = value.indexOf(o.value);
          const on = at >= 0;
          return (
            <button
              key={o.value}
              ref={i === 0 ? firstChip : undefined}
              type="button"
              onClick={() => toggle(o.value)}
              className={`flex h-11 items-center gap-2 rounded-full px-4 text-[15px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                on ? "bg-ink text-canvas" : "bg-canvas text-ink-muted hover:text-ink"
              }`}
            >
              {ordered && on && (
                <span className="text-[15px] font-bold tabular-nums opacity-60">{at + 1}</span>
              )}
              {t(o.label)}
            </button>
          );
        })}
      </div>
      {value.length > 0 && (
        <SButton className="shrink-0 self-start" onClick={clear}>
          {t("Clear")}
        </SButton>
      )}
    </SettingRow>
  );
}
