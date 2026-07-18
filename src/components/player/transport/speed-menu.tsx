import { Clock, Gauge, Plus, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  SLEEP_PRESETS,
  type SleepMode,
  type SleepTimerState,
} from "@/views/player/hooks/use-sleep-timer";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { useMenuSide } from "../menu-side";
import { Tooltip } from "./tooltip";

const CURATED_SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const CURATED_SLEEP_IDS = ["30", "60", "ep", "ep2"];

function formatRemaining(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function sleepMinuteLabel(m: number, t: ReturnType<typeof useT>): string {
  if (m >= 60 && m % 60 === 0) return t("{n} hr", { n: m / 60 });
  return t("{n} min", { n: m });
}

export function SpeedMenu({
  rate,
  onRate,
  sleep,
  onOpenChange,
}: {
  rate: number;
  onRate: (r: number) => void;
  sleep?: SleepTimerState;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useT();
  const { settings, update } = useSettings();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { side, measure } = useMenuSide(wrap, 400);
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  useEffect(() => {
    if (!open) setEditing(false);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const speedList = useMemo(() => {
    const entries = new Map<number, boolean>();
    for (const s of CURATED_SPEEDS) entries.set(s, false);
    for (const s of settings.customPlaybackSpeeds) if (!entries.has(s)) entries.set(s, true);
    return [...entries.entries()]
      .map(([value, custom]) => ({ value, custom }))
      .sort((a, b) => a.value - b.value);
  }, [settings.customPlaybackSpeeds]);

  const sleepList = useMemo(() => {
    const minutes = new Map<number, boolean>();
    for (const p of SLEEP_PRESETS) {
      if (p.mode.kind === "minutes" && CURATED_SLEEP_IDS.includes(p.id))
        minutes.set(p.mode.total, false);
    }
    for (const m of settings.customSleepMinutes) if (!minutes.has(m)) minutes.set(m, true);
    const minuteRows = [...minutes.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([total, custom]) => ({
        id: `m${total}`,
        label: sleepMinuteLabel(total, t),
        mode: { kind: "minutes", total, firesAt: 0 } as SleepMode,
        custom,
      }));
    const episodeRows = SLEEP_PRESETS.filter(
      (p) => CURATED_SLEEP_IDS.includes(p.id) && p.mode.kind !== "minutes",
    ).map((p) => ({ id: p.id, label: t(p.label), mode: p.mode, custom: false }));
    return [...minuteRows, ...episodeRows];
  }, [settings.customSleepMinutes, t]);

  const current = Math.abs(rate - 1) < 0.01 ? "1×" : `${rate}×`;
  const sleepActive = sleep != null && sleep.mode.kind !== "off";
  const accent = open || Math.abs(rate - 1) > 0.01 || sleepActive;
  const sleepLabel = (() => {
    if (!sleep || sleep.mode.kind === "off") return null;
    if (sleep.mode.kind === "minutes" && sleep.remainingMs != null)
      return formatRemaining(sleep.remainingMs);
    if (sleep.mode.kind === "end_episode") return t("End ep");
    if (sleep.mode.kind === "end_next_episode") return t("+{n} ep", { n: sleep.mode.remaining });
    return null;
  })();

  const addSpeed = (raw: number) => {
    const v = Math.round(raw * 100) / 100;
    if (!Number.isFinite(v) || v < 0.1 || v > 4) return false;
    if (CURATED_SPEEDS.includes(v) || settings.customPlaybackSpeeds.includes(v)) return false;
    update({ customPlaybackSpeeds: [...settings.customPlaybackSpeeds, v] });
    return true;
  };
  const removeSpeed = (v: number) =>
    update({ customPlaybackSpeeds: settings.customPlaybackSpeeds.filter((x) => x !== v) });
  const addSleep = (raw: number) => {
    const m = Math.round(raw);
    if (!Number.isFinite(m) || m < 1 || m > 1440) return false;
    if (settings.customSleepMinutes.includes(m)) return false;
    update({ customSleepMinutes: [...settings.customSleepMinutes, m] });
    return true;
  };
  const removeSleep = (total: number) =>
    update({ customSleepMinutes: settings.customSleepMinutes.filter((x) => x !== total) });

  return (
    <div ref={wrap} className="relative">
      <Tooltip label={sleep ? t("Speed & sleep") : t("Playback speed")}>
        <button
          onClick={() => {
            if (!open) measure();
            setOpen((o) => !o);
          }}
          aria-label={t("Speed and sleep timer")}
          className={`flex h-11 min-w-11 items-center justify-center gap-1 rounded-full px-2 transition-[background-color,color] ${
            accent
              ? "bg-white/22 text-white hover:bg-white/30"
              : "text-white/85 hover:bg-white/10 hover:text-white"
          }`}
        >
          <Gauge size={22} strokeWidth={1.9} />
          {sleepActive && sleepLabel ? (
            <span className="flex items-center gap-0.5 text-[11px] font-bold tabular-nums tracking-wider">
              <Clock size={11} strokeWidth={2.4} />
              {sleepLabel}
            </span>
          ) : Math.abs(rate - 1) > 0.01 ? (
            <span className="text-[11px] font-bold tabular-nums tracking-wider">{current}</span>
          ) : null}
        </button>
      </Tooltip>
      {open && (
        <div
          data-tv-focus-scope
          className={`absolute bottom-[calc(100%+10px)] ${side === "start" ? "start-0" : "end-0"} w-[400px] max-w-[calc(100vw-32px)] overflow-hidden rounded-2xl border border-edge bg-elevated shadow-[0_24px_60px_-18px_rgba(0,0,0,0.8)] backdrop-blur-xl`}
        >
          <button
            onClick={() => setOpen(false)}
            aria-label={t("Close")}
            data-tv-modal-close
            tabIndex={-1}
            className="hidden"
          />
          <div className={`grid ${sleep ? "grid-cols-2" : "grid-cols-1"}`}>
            <Section title={t("Playback speed")}>
              {speedList.map((s) => (
                <Row
                  key={s.value}
                  selected={Math.abs(s.value - rate) < 0.01}
                  label={s.value === 1 ? t("Normal") : `${s.value}×`}
                  hint={s.value === 1 ? t("default") : undefined}
                  onRemove={editing && s.custom ? () => removeSpeed(s.value) : undefined}
                  onClick={() => {
                    onRate(s.value);
                    setOpen(false);
                  }}
                />
              ))}
              {editing && (
                <AddPresetInput placeholder={t("e.g. 1.35")} suffix="×" onAdd={addSpeed} />
              )}
            </Section>
            {sleep && (
              <Section title={t("Sleep timer")} leftBorder>
                {sleepList.map((p) => {
                  const isSel =
                    (sleep.mode.kind === "minutes" &&
                      p.mode.kind === "minutes" &&
                      sleep.mode.total === p.mode.total) ||
                    (sleep.mode.kind === p.mode.kind && p.mode.kind !== "minutes");
                  const hint =
                    isSel && sleep.remainingMs != null && p.mode.kind === "minutes"
                      ? formatRemaining(sleep.remainingMs)
                      : undefined;
                  const total = p.mode.kind === "minutes" ? p.mode.total : null;
                  return (
                    <Row
                      key={p.id}
                      selected={isSel}
                      label={p.label}
                      hint={hint}
                      onRemove={
                        editing && p.custom && total != null ? () => removeSleep(total) : undefined
                      }
                      onClick={() => {
                        sleep.set(p.mode);
                        setOpen(false);
                      }}
                    />
                  );
                })}
                {editing && (
                  <AddPresetInput
                    placeholder={t("e.g. 20")}
                    units={{ labels: [t("min"), t("hr")], factor: 60 }}
                    onAdd={addSleep}
                  />
                )}
                {sleepActive && !editing && (
                  <button
                    onClick={() => {
                      sleep.cancel();
                      setOpen(false);
                    }}
                    className="mt-1 flex h-10 w-full items-center rounded-lg px-3 text-start text-[14px] font-medium text-danger transition-colors hover:bg-danger/10"
                  >
                    {t("Cancel timer")}
                  </button>
                )}
              </Section>
            )}
          </div>
          <div className="flex items-center justify-end border-t border-edge-soft px-3 py-2">
            <button
              onClick={() => setEditing((e) => !e)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                editing
                  ? "bg-canvas/55 text-ink"
                  : "text-ink-subtle hover:bg-canvas/55 hover:text-ink"
              }`}
            >
              <Settings2 size={13} strokeWidth={2} />
              {editing ? t("Done") : t("Customize")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  leftBorder,
  children,
}: {
  title: string;
  leftBorder?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`p-2 ${leftBorder ? "border-s border-edge-soft" : ""}`}>
      <div className="px-3 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
        {title}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function Row({
  selected,
  label,
  hint,
  onClick,
  onRemove,
}: {
  selected: boolean;
  label: string;
  hint?: string;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="relative flex items-center">
      <button
        onClick={onClick}
        className={`flex h-10 w-full items-center justify-between rounded-lg px-3 text-start text-[14px] transition-colors ${
          selected
            ? "bg-elevated text-ink ring-1 ring-edge"
            : "text-ink-muted hover:bg-canvas/55 hover:text-ink"
        } ${onRemove ? "pe-10" : ""}`}
      >
        <span className={selected ? "font-medium" : ""}>{label}</span>
        {hint && !onRemove && (
          <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
            {hint}
          </span>
        )}
      </button>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Remove preset"
          className="absolute end-2 flex h-6 w-6 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-danger/15 hover:text-danger"
        >
          <X size={13} strokeWidth={2.4} />
        </button>
      )}
    </div>
  );
}

function AddPresetInput({
  placeholder,
  suffix,
  units,
  onAdd,
}: {
  placeholder: string;
  suffix?: string;
  units?: { labels: [string, string]; factor: number };
  onAdd: (value: number) => boolean;
}) {
  const [val, setVal] = useState("");
  const [unit, setUnit] = useState(0);
  const submit = () => {
    const n = parseFloat(val.trim());
    if (!Number.isFinite(n)) return;
    const value = units && unit === 1 ? n * units.factor : n;
    if (onAdd(value)) setVal("");
  };
  return (
    <div className="mt-1 flex h-10 items-center gap-1.5 rounded-lg border border-edge-soft px-2.5">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        placeholder={placeholder}
        inputMode="decimal"
        className="min-w-0 flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-subtle focus:outline-none"
      />
      {units ? (
        <div className="flex items-center rounded-md bg-canvas/55 p-0.5">
          {units.labels.map((u, i) => (
            <button
              key={u}
              onClick={() => setUnit(i)}
              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold transition-colors ${
                unit === i ? "bg-raised text-ink" : "text-ink-subtle hover:text-ink"
              }`}
            >
              {u}
            </button>
          ))}
        </div>
      ) : (
        <span className="text-[12px] font-medium text-ink-subtle">{suffix}</span>
      )}
      <button
        onClick={submit}
        aria-label="Add preset"
        className="flex h-7 w-7 items-center justify-center rounded-md bg-raised text-ink-muted transition-colors hover:bg-canvas/55 hover:text-ink"
      >
        <Plus size={15} strokeWidth={2.4} />
      </button>
    </div>
  );
}
