import { ChevronDown, ChevronUp, Eye, EyeOff } from "lucide-react";
import type { ReactNode } from "react";
import { LazyMount } from "@/components/lazy-mount";
import { useT } from "@/lib/i18n";
import { orderedSectionKeys, type DetailCustomization } from "@/lib/detail-customization";

export type DetailSection = {
  key: string;
  label: string;
  node: ReactNode;
  minHeight?: number;
};

export function ContentRails({
  sections,
  custom,
  editMode,
  onMove,
  onToggleHidden,
}: {
  sections: DetailSection[];
  custom: DetailCustomization;
  editMode: boolean;
  onMove: (key: string, delta: -1 | 1) => void;
  onToggleHidden: (key: string) => void;
}) {
  const available = sections.map((s) => s.key);
  const order = orderedSectionKeys(available, custom);
  const byKey = new Map(sections.map((s) => [s.key, s]));
  return (
    <div className="flex flex-col gap-10">
      {order.map((key, idx) => {
        const s = byKey.get(key);
        if (!s) return null;
        const hidden = custom.hidden.includes(key);
        if (hidden && !editMode) return null;
        return (
          <div key={key} className="flex flex-col gap-3">
            {editMode && (
              <RailControls
                label={s.label}
                hidden={hidden}
                canUp={idx > 0}
                canDown={idx < order.length - 1}
                onUp={() => onMove(key, -1)}
                onDown={() => onMove(key, 1)}
                onToggleHidden={() => onToggleHidden(key)}
              />
            )}
            {!hidden && <LazyMount minHeight={s.minHeight ?? 280}>{s.node}</LazyMount>}
          </div>
        );
      })}
    </div>
  );
}

function RailControls({
  label,
  hidden,
  canUp,
  canDown,
  onUp,
  onDown,
  onToggleHidden,
}: {
  label: string;
  hidden: boolean;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  onToggleHidden: () => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-2 rounded-xl border border-edge-soft bg-elevated/40 px-3 py-2">
      <span
        className={`flex-1 truncate text-[13px] font-semibold ${hidden ? "text-ink-subtle" : "text-ink"}`}
      >
        {label}
      </span>
      <button
        type="button"
        onClick={onUp}
        disabled={!canUp}
        aria-label={t("Move up")}
        title={t("Move up")}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronUp size={16} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        onClick={onDown}
        disabled={!canDown}
        aria-label={t("Move down")}
        title={t("Move down")}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent"
      >
        <ChevronDown size={16} strokeWidth={2.2} />
      </button>
      <button
        type="button"
        onClick={onToggleHidden}
        aria-label={hidden ? t("Show") : t("Hide")}
        title={hidden ? t("Show") : t("Hide")}
        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-raised ${
          hidden ? "text-ink-subtle hover:text-ink" : "text-ink-muted hover:text-ink"
        }`}
      >
        {hidden ? <EyeOff size={16} strokeWidth={2.2} /> : <Eye size={16} strokeWidth={2.2} />}
      </button>
    </div>
  );
}
