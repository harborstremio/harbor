import { fillStyle } from "@/components/slider";
import { useT } from "@/lib/i18n";
import { NewBadge } from "../new-badge";
import { SettingRow } from "../kit";
import { Segmented } from "../shared";
import type { TvChoice } from "./model-lists";

function TvOnly() {
  const t = useT();
  return (
    <span className="shrink-0 rounded-full bg-canvas px-2 py-[3px] text-[9.5px] font-semibold uppercase tracking-wider text-ink-subtle">
      {t("TV only")}
    </span>
  );
}

function RowLabel({ label, tvOnly, newId }: { label: string; tvOnly?: boolean; newId?: string }) {
  const t = useT();
  return (
    <>
      {t(label)}
      {tvOnly && <TvOnly />}
      {newId && <NewBadge id={newId} />}
    </>
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
      wide={options.length > 4}
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
      <StepButton glyph="minus" label={t("Minus")} onClick={() => onChange(clamp(value - step))} />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(clamp(Number.parseInt(e.target.value, 10)))}
        className="harbor-slider min-w-0 flex-1"
        style={fillStyle(value, min, max)}
      />
      <StepButton glyph="plus" label={t("Plus")} onClick={() => onChange(clamp(value + step))} />
      <span className="w-12 shrink-0 text-end text-[13px] font-semibold tabular-nums text-ink">
        {value}
        {unit ?? ""}
      </span>
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
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-raised text-ink-muted transition-colors hover:text-ink"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
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
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  return (
    <SettingRow
      wide
      label={<RowLabel label={label} tvOnly={tvOnly} newId={newId} />}
      desc={sub ? t(sub) : undefined}
    >
      <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {options.map((o) => {
          const at = value.indexOf(o.value);
          const on = at >= 0;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                on ? "bg-ink text-canvas" : "bg-canvas text-ink-muted hover:text-ink"
              }`}
            >
              {ordered && on && (
                <span className="text-[10.5px] font-bold tabular-nums opacity-60">{at + 1}</span>
              )}
              {t(o.label)}
            </button>
          );
        })}
      </div>
      {value.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="shrink-0 self-start text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
        >
          {t("Clear")}
        </button>
      )}
    </SettingRow>
  );
}
