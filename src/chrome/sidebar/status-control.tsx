import { Check } from "lucide-react";
import { useT } from "@/lib/i18n";
import { PRESENCE_META, PRESENCE_ORDER, type PresenceStatus } from "@/lib/social/presence";

export function StatusDot({
  status,
  onActivate,
}: {
  status: PresenceStatus;
  onActivate: (e: React.MouseEvent | React.KeyboardEvent) => void;
}) {
  const t = useT();
  const meta = PRESENCE_META[status];
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={t("Set status")}
      title={t(meta.label)}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate(e);
        }
      }}
      className={`absolute -bottom-1 -end-1 h-[15px] w-[15px] cursor-pointer rounded-full ring-2 ring-canvas transition-transform duration-150 hover:scale-110 motion-reduce:transition-none ${meta.dot}`}
    />
  );
}

export function StatusPicker({
  current,
  collapsed = false,
  placement = "up",
  align = "stretch",
  onPick,
}: {
  current: PresenceStatus;
  collapsed?: boolean;
  placement?: "up" | "down";
  align?: "stretch" | "end" | "start";
  onPick: (s: PresenceStatus) => void;
}) {
  const t = useT();
  const vpos = placement === "down" ? "top-full mt-2" : "bottom-full mb-2";
  const hpos = collapsed
    ? "start-0 w-64"
    : align === "end"
      ? "end-0 w-64"
      : align === "start"
        ? "start-0 w-64"
        : "start-2 end-2 lg:start-4 lg:end-4";
  return (
    <div
      className={`absolute z-10 overflow-hidden rounded-xl border border-edge bg-elevated shadow-[0_20px_40px_-10px_rgba(0,0,0,0.6)] ${vpos} ${hpos}`}
    >
      <div className="px-3.5 pb-1 pt-2.5 text-[10.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
        {t("Set status")}
      </div>
      <div className="flex flex-col p-1.5 pt-0.5">
        {PRESENCE_ORDER.map((s) => {
          const meta = PRESENCE_META[s];
          const active = s === current;
          return (
            <button
              key={s}
              onClick={() => onPick(s)}
              className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-start transition-colors hover:bg-raised"
            >
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13.5px] font-medium text-ink">{t(meta.label)}</span>
                <span className="truncate text-[11.5px] text-ink-subtle">{t(meta.help)}</span>
              </span>
              {active && <Check size={15} strokeWidth={2.6} className="shrink-0 text-accent" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
