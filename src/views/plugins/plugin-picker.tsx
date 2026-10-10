import { Check, ChevronDown, Puzzle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useT } from "@/lib/i18n";

/** What the picker holds when every plugin's rows are wanted. */
export const ALL_PLUGINS = "";

const TRIGGER =
  "flex h-10 items-center gap-2 rounded-full border border-edge-soft bg-elevated/40 px-3.5 text-[13px] text-ink transition-colors hover:bg-elevated/70";

export type PickerPlugin = { name: string; icon?: string };

/** Which plugin's rows the tab is showing, chosen the way the manga browser chooses a source:
 * a filter, everything at the top, and a tick on whatever is in force. */
export function PluginPicker({
  plugins,
  value,
  onChange,
}: {
  plugins: PickerPlugin[];
  value: string;
  onChange: (name: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const list = q ? plugins.filter((p) => p.name.toLowerCase().includes(q)) : plugins;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [plugins, filter]);

  const active = plugins.find((p) => p.name === value);
  const pick = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative shrink-0">
      <button type="button" onClick={() => setOpen((v) => !v)} className={TRIGGER}>
        {active?.icon ? (
          <img src={active.icon} alt="" className="h-[15px] w-[15px] shrink-0 rounded-[3px] object-contain" />
        ) : (
          <Puzzle size={15} className="text-ink-subtle" />
        )}
        <span className="max-w-[160px] truncate font-medium">
          {active ? active.name : t("All plugins")}
        </span>
        <ChevronDown size={14} className="text-ink-subtle" />
      </button>
      {open && (
        <div className="absolute end-0 z-30 mt-1.5 w-[260px] overflow-hidden rounded-lg border border-edge-soft bg-raised shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)]">
          {plugins.length > 6 && (
            <div className="border-b border-edge-soft/60 p-2">
              <input
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t("Filter plugins...")}
                className="h-8 w-full rounded-md bg-elevated/50 px-3 text-[12.5px] text-ink placeholder:text-ink-subtle outline-none focus:ring-1 focus:ring-edge"
              />
            </div>
          )}
          <div className="max-h-72 overflow-y-auto py-1">
            <Row
              label={t("All plugins")}
              active={value === ALL_PLUGINS}
              onClick={() => pick(ALL_PLUGINS)}
            />
            {shown.map((p) => (
              <Row
                key={p.name}
                label={p.name}
                icon={p.icon}
                active={p.name === value}
                onClick={() => pick(p.name)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-[13px] text-ink hover:bg-elevated/60"
    >
      <span className="flex min-w-0 items-center gap-2">
        {icon ? (
          <img src={icon} alt="" loading="lazy" className="h-4 w-4 shrink-0 rounded-sm object-contain" />
        ) : (
          <Puzzle size={14} className="shrink-0 text-ink-subtle" />
        )}
        <span className="truncate">{label}</span>
      </span>
      {active && <Check size={14} className="shrink-0 text-accent" />}
    </button>
  );
}
