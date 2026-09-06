import {
  ChevronDown,
  ChevronUp,
  Code2,
  PanelLeft,
  PanelTop,
  Plus,
  RotateCcw,
  Shapes,
  X,
} from "../../icons";
import { useState } from "react";
import type { ChromeConfig, ChromeNavId } from "@/lib/theme";
import { useT } from "@/lib/i18n";
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
  const t = useT();
  const enabled = config.items;
  const available = NAV_CATALOG.filter((id) => !enabled.includes(id));

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= enabled.length) return;
    const items = [...enabled];
    [items[index], items[target]] = [items[target], items[index]];
    onChange({ ...config, items });
  };

  const rename = (id: ChromeNavId, label: string) =>
    onChange({ ...config, labels: { ...config.labels, [id]: label } });

  const setIcon = (id: ChromeNavId, icon: string | null) => {
    const icons = { ...config.icons };
    if (icon) icons[id] = icon;
    else delete icons[id];
    onChange({ ...config, icons });
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="flex flex-col gap-0.5">
        <span className="text-[16.5px] font-medium leading-[24px] tracking-[-0.1px] text-ink">
          {t("Your navigation")}
        </span>
        <span className="max-w-[66ch] text-[15.5px] leading-[22px] text-ink-subtle">
          {dirty
            ? t("You're editing the chrome by hand, so the visual builder stays out of your way.")
            : t("Pick a position, name it, then choose your menu items.")}
        </span>
      </div>

      {!dirty && (
        <>
          <Field label={t("Position")}>
            <div className="grid grid-cols-2 gap-2">
              <PosButton
                active={config.position === "sidebar"}
                icon={<PanelLeft size={16} strokeWidth={2} />}
                label={t("Sidebar")}
                onClick={() => onChange({ ...config, position: "sidebar" })}
              />
              <PosButton
                active={config.position === "topbar"}
                icon={<PanelTop size={16} strokeWidth={2} />}
                label={t("Top bar")}
                onClick={() => onChange({ ...config, position: "topbar" })}
              />
            </div>
          </Field>

          <Field label={t("Brand name")}>
            <input
              type="text"
              value={config.brand}
              onChange={(e) => onChange({ ...config, brand: e.target.value })}
              placeholder="Harbor"
              className="h-12 rounded-md bg-canvas px-3.5 text-[16.5px] text-ink transition-colors placeholder:text-ink-subtle/70 focus:bg-canvas focus:outline-none"
            />
          </Field>

          <Field label={t("Menu items")}>
            <div className="flex flex-col gap-1.5">
              {enabled.map((id, i) => (
                <MenuItemRow
                  key={id}
                  label={config.labels?.[id] ?? t(NAV_LABELS[id])}
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
              {enabled.length === 0 && (
                <p className="px-1 text-[15.5px] leading-[22px] text-ink-subtle">
                  {t("Add at least one item below.")}
                </p>
              )}
            </div>
            {available.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-2">
                {available.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => onChange({ ...config, items: [...enabled, id] })}
                    className="flex h-11 items-center gap-1.5 rounded-md bg-canvas px-3 text-[15.5px] font-medium text-ink-muted transition-colors hover:bg-surface hover:text-ink"
                  >
                    <Plus size={16} strokeWidth={2.4} />
                    {t(NAV_LABELS[id])}
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
        className="flex h-12 items-center justify-center gap-2 rounded-md text-[15.5px] font-semibold text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
      >
        <Code2 size={16} strokeWidth={2.2} />
        {t("Edit the HTML and CSS by hand")}
      </button>

      {dirty && (
        <button
          type="button"
          onClick={onRegenerate}
          className="flex h-11 items-center justify-center gap-1.5 rounded-md text-[15.5px] font-medium text-ink-subtle transition-colors hover:text-ink-muted"
        >
          <RotateCcw size={16} strokeWidth={2.2} />
          {t("Rebuild from the visual builder")}
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
  const t = useT();
  const [picking, setPicking] = useState(false);
  const isImage = !!iconId?.startsWith("data:");
  const CurrentIcon = iconId && !isImage ? iconComponent(iconId) : undefined;
  const hasIcon = isImage || !!CurrentIcon;

  return (
    <div className="flex flex-col rounded-md bg-canvas">
      <div className="flex items-center gap-1 px-2.5 py-2">
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          aria-label={t("Choose icon")}
          className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border transition-colors ${
            picking
              ? "border-accent text-ink"
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
            <Shapes size={16} strokeWidth={2} />
          )}
        </button>
        <input
          value={label}
          onChange={(e) => onRename(e.target.value)}
          aria-label={t("Rename item")}
          className="h-11 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-[16.5px] font-medium text-ink outline-none transition-colors hover:bg-canvas focus:bg-canvas"
        />
        <IconBtn label={t("Move up")} disabled={isFirst} onClick={onMoveUp}>
          <ChevronUp size={17} strokeWidth={2.4} />
        </IconBtn>
        <IconBtn label={t("Move down")} disabled={isLast} onClick={onMoveDown}>
          <ChevronDown size={17} strokeWidth={2.4} />
        </IconBtn>
        <IconBtn label={t("Remove")} onClick={onRemove}>
          <X size={17} strokeWidth={2.4} />
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
      <span className="text-[13px] font-extrabold uppercase leading-[18px] tracking-[0.72px] text-ink-subtle">{label}</span>
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
      className={`flex h-[72px] flex-col items-center justify-center gap-1.5 rounded-md border text-[15.5px] font-semibold transition ${
        active
          ? "border-accent bg-canvas text-ink"
          : "border-edge-soft bg-canvas text-ink-muted hover:border-edge hover:text-ink"
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
      className="flex h-11 w-9 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-raised hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}
