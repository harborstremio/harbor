import type { ChromeConfig, ChromeNavId } from "@/lib/theme";
import { ChevronDown, ChevronUp, Code2, PanelLeft, PanelTop, Plus, RotateCcw, Shapes, X } from "lucide-react";
import { useState } from "react";

import { NAV_CATALOG, NAV_LABELS } from "./chrome-config";
import { iconComponent } from "./chrome-icons";
import { IconPicker } from "./icon-picker";

export function CustomChromeBuilder({
  config,
  dirty,
  onChange,
  onRegenerate,
  onOpenCode,
}: {
  config: ChromeConfig;
  dirty: boolean;
  onChange: (next: ChromeConfig) => void;
  onRegenerate: () => void;
  onOpenCode: () => void;
}) {
  const enabled = config.items;
  const available = NAV_CATALOG.filter((id) => !enabled.includes(id));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= enabled.length) return;
    const items = [...enabled];
    [items[index], items[target]] = [items[target], items[index]];
    onChange({ ...config, items });
  };

  const rename = (id: ChromeNavId, label: string) => onChange({ ...config, labels: { ...config.labels, [id]: label } });

  const setIcon = (id: ChromeNavId, icon: string | null) => {
    const icons = { ...config.icons };
    if (icon) icons[id] = icon;
    else delete icons[id];
    onChange({ ...config, icons });
  };

  return (
    <div className="flex flex-col gap-4 px-5 pb-5 pt-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold text-ink">Your navigation</span>
        <span className="text-[13px] leading-snug text-ink-subtle">
          {dirty
            ? "You're editing the chrome by hand, so the visual builder stays out of your way."
            : "Pick a position, name it, then choose your menu items."}
        </span>
      </div>

      {!dirty && (
        <>
          <Field label="Position">
            <div className="grid grid-cols-2 gap-2">
              <PosButton
                active={config.position === "sidebar"}
                icon={<PanelLeft size={16} strokeWidth={2} />}
                label="Sidebar"
                onClick={() => onChange({ ...config, position: "sidebar" })}
              />
              <PosButton
                active={config.position === "topbar"}
                icon={<PanelTop size={16} strokeWidth={2} />}
                label="Top bar"
                onClick={() => onChange({ ...config, position: "topbar" })}
              />
            </div>
          </Field>

          <Field label="Brand name">
            <input
              type="text"
              value={config.brand}
              onChange={(e) => onChange({ ...config, brand: e.target.value })}
              placeholder="Harbor"
              className="h-12 rounded-lg border border-edge-soft bg-canvas/60 px-3.5 text-[15px] text-ink placeholder:text-ink-subtle transition-colors focus:border-accent/70 focus:bg-canvas/80 focus:outline-none"
            />
          </Field>

          <Field label="Menu items">
            <div className="flex flex-col gap-1.5">
              {enabled.map((id, i) => (
                <MenuItemRow
                  key={id}
                  label={config.labels?.[id] ?? NAV_LABELS[id]}
                  iconId={config.icons?.[id]}
                  isFirst={i === 0}
                  isLast={i === enabled.length - 1}
                  onRename={(label) => rename(id, label)}
                  onSetIcon={(icon) => setIcon(id, icon)}
                  onMoveUp={() => move(i, -1)}
                  onMoveDown={() => move(i, 1)}
                  onRemove={() => onChange({ ...config, items: enabled.filter((x) => x !== id) })}
                />
              ))}
              {enabled.length === 0 && <p className="px-1 text-[12px] text-ink-subtle">Add at least one item below.</p>}
            </div>
            {available.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {available.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChange({ ...config, items: [...enabled, id] })}
                    className="flex h-10 items-center gap-1 rounded-md border border-edge-soft bg-canvas/40 px-3 text-[13.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink"
                  >
                    <Plus size={12} strokeWidth={2.4} />
                    {NAV_LABELS[id]}
                  </button>
                ))}
              </div>
            )}
          </Field>
        </>
      )}

      <button
        type="button"
        onClick={onOpenCode}
        className="flex h-12 items-center justify-center gap-2 rounded-lg border border-edge-soft text-[15px] font-semibold text-ink-muted transition-colors hover:border-edge hover:bg-white/[0.03] hover:text-ink"
      >
        <Code2 size={16} strokeWidth={2.2} />
        Edit the HTML and CSS by hand
      </button>

      {dirty && (
        <button
          type="button"
          onClick={onRegenerate}
          className="flex h-8 items-center justify-center gap-1.5 text-[12px] font-medium text-ink-subtle transition-colors hover:text-ink-muted"
        >
          <RotateCcw size={12} strokeWidth={2.2} />
          Rebuild from the visual builder
        </button>
      )}
    </div>
  );
}

function MenuItemRow({
  label,
  iconId,
  isFirst,
  isLast,
  onRename,
  onSetIcon,
  onMoveUp,
  onMoveDown,
  onRemove,
}: {
  label: string;
  iconId?: string;
  isFirst: boolean;
  isLast: boolean;
  onRename: (label: string) => void;
  onSetIcon: (icon: string | null) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const isImage = !!iconId?.startsWith("data:");
  const CurrentIcon = iconId && !isImage ? iconComponent(iconId) : undefined;
  const hasIcon = isImage || !!CurrentIcon;

  return (
    <div className="flex flex-col rounded-lg border border-edge-soft bg-canvas/50">
      <div className="flex items-center gap-1 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          aria-label="Choose icon"
          className={`flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border transition-colors ${
            picking
              ? "border-accent/70 text-ink"
              : hasIcon
                ? "border-edge-soft text-ink hover:border-edge"
                : "border-dashed border-edge-soft text-ink-subtle hover:border-edge hover:text-ink-muted"
          }`}
        >
          {isImage ? (
            <img src={iconId} alt="" className="h-[18px] w-[18px] rounded object-contain" />
          ) : CurrentIcon ? (
            <CurrentIcon size={18} strokeWidth={2} />
          ) : (
            <Shapes size={15} strokeWidth={2} />
          )}
        </button>
        <input
          value={label}
          onChange={(e) => onRename(e.target.value)}
          aria-label="Rename item"
          className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-[15px] font-medium text-ink outline-none transition-colors hover:bg-canvas/40 focus:bg-canvas/55"
        />
        <IconBtn label="Move up" disabled={isFirst} onClick={onMoveUp}>
          <ChevronUp size={14} strokeWidth={2.4} />
        </IconBtn>
        <IconBtn label="Move down" disabled={isLast} onClick={onMoveDown}>
          <ChevronDown size={14} strokeWidth={2.4} />
        </IconBtn>
        <IconBtn label="Remove" onClick={onRemove}>
          <X size={13} strokeWidth={2.4} />
        </IconBtn>
      </div>
      {picking && (
        <IconPicker
          value={iconId}
          onSelect={(v) => {
            onSetIcon(v);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">{label}</span>
      {children}
    </div>
  );
}

function PosButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-16 flex-col items-center justify-center gap-1.5 rounded-lg border text-[13px] font-semibold transition-all ${
        active
          ? "border-accent/80 bg-canvas/40 text-ink"
          : "border-edge-soft bg-canvas/30 text-ink-muted hover:border-edge hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-subtle transition-colors hover:bg-raised hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
