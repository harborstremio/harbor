import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { isWindowsDesktop } from "@/lib/platform";
import {
  AUTO_DISPLAY,
  listMonitors,
  monitorCardName,
  monitorResolution,
  type DisplaySelection,
  type MonitorInfo,
} from "@/lib/monitors";
import { SettingRow } from "../kit";
import { Check, Monitor, Tv } from "../icons";
import { NewBadge } from "../new-badge";

const CELL =
  "relative flex flex-col items-center gap-2.5 rounded-[10px] border bg-canvas p-4 text-center transition-colors";
const BADGE =
  "inline-flex h-[22px] shrink-0 items-center gap-1 rounded-[6px] px-2 text-[13px] font-bold uppercase leading-[17px] tracking-[0.72px]";

function MonitorCard({
  icon,
  name,
  detail,
  selected,
  onSelect,
  ariaLabel,
}: {
  icon: React.ReactNode;
  name: string;
  detail: string;
  selected: boolean;
  onSelect: () => void;
  ariaLabel: string;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={ariaLabel}
      data-interactive=""
      className={`group w-full ${CELL} focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        selected ? "border-accent" : "border-edge-soft hover:bg-elevated"
      }`}
    >
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] transition-transform duration-200 group-hover:scale-[1.03] ${
          selected ? "bg-accent-soft text-accent" : "bg-elevated text-ink-subtle"
        }`}
      >
        {icon}
      </span>
      <span className="flex w-full min-w-0 flex-col items-center gap-1">
        <span className="harbor-settings-label max-w-full truncate text-ink">{name}</span>
        <span className="text-[14px] leading-[20px] text-ink-muted">{detail}</span>
      </span>
      <span className={`${BADGE} ${selected ? "bg-accent-soft text-accent" : "opacity-0"}`}>
        <Check size={13} strokeWidth={3} />
        {t("Selected")}
      </span>
    </button>
  );
}

/**
 * A monitor picker rendered as one card per display (Automatic + each monitor).
 * Renders nothing unless this is Windows and more than one display is attached,
 * so single-monitor and non-Windows users never see it.
 *
 * `value` defaults to Automatic (follow Harbor). When the stored monitor is no
 * longer connected the Rust side silently falls back to Automatic, so a stale
 * choice is harmless.
 */
export function DisplayPickerRow({
  label,
  desc,
  newId,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  newId?: string;
  value: DisplaySelection;
  onChange: (value: DisplaySelection) => void;
}) {
  const t = useT();
  const [monitors, setMonitors] = useState<MonitorInfo[] | null>(null);

  useEffect(() => {
    if (!isWindowsDesktop()) return;
    let alive = true;
    void listMonitors().then((list) => {
      if (alive) setMonitors(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!isWindowsDesktop() || monitors === null || monitors.length < 2) return null;

  const selectedId = value.mode === "explicit" ? value.monitor.id : "auto";

  return (
    <SettingRow
      wide
      label={
        <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0">{label}</span>
          {newId && <NewBadge id={newId} />}
        </span>
      }
      desc={desc}
    >
      <div className="grid w-full grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        <MonitorCard
          icon={<Tv size={26} strokeWidth={1.8} />}
          name={t("Automatic")}
          detail={t("Follow Harbor")}
          selected={selectedId === "auto"}
          onSelect={() => onChange(AUTO_DISPLAY)}
          ariaLabel={t("Open on the same monitor as Harbor")}
        />
        {monitors.map((m) => (
          <MonitorCard
            key={m.id}
            icon={<Monitor size={26} strokeWidth={1.8} />}
            name={monitorCardName(m)}
            detail={m.isPrimary ? `${monitorResolution(m)} · ${t("Primary")}` : monitorResolution(m)}
            selected={selectedId === m.id}
            onSelect={() => onChange({ mode: "explicit", monitor: m })}
            ariaLabel={t("Open on {name}", { name: monitorCardName(m) })}
          />
        ))}
      </div>
    </SettingRow>
  );
}
