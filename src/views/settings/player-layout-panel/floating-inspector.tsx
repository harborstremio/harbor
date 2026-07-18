import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, EyeOff, RotateCcw, X } from "lucide-react";
import {
  CONTROL_META,
  controlStates,
  isIconReplaceable,
  isVariantAware,
  PANEL_CORNERS,
  PANEL_META,
  STATE_LABEL,
  iconKey,
  type ControlVariant,
  type PanelCorner,
  type PanelId,
  type PlayerChromeConfig,
  type PlayerControlId,
} from "@/lib/player-chrome";
import { panelConfig } from "./editor-panels";
import { IconUpload } from "./icon-upload";
import { slotLimit, SLOT_LABEL, visibleInSlot } from "./panel-utils";

type Props = {
  config: PlayerChromeConfig;
  selectedId: PlayerControlId | null;
  onSelect: (id: PlayerControlId | null) => void;
  selectedPanelId: PanelId | null;
  onSelectPanel: (id: PanelId | null) => void;
  onSetPanelCorner: (id: PanelId, corner: PanelCorner) => void;
  onTogglePanelHidden: (id: PanelId) => void;
  onMoveSlot: (dir: -1 | 1) => void;
  onMoveOrder: (dir: -1 | 1) => void;
  onToggleHidden: () => void;
  onResetControl: () => void;
  onSetCustomIcon: (id: PlayerControlId, dataUrl: string | null, state?: string) => void;
  onSetVariant: (id: PlayerControlId, variant: ControlVariant | null) => void;
  previewStates: Partial<Record<PlayerControlId, string>>;
  onSetPreviewState: (id: PlayerControlId, state: string) => void;
};

export function FloatingInspector({
  config,
  selectedId,
  onSelect,
  onMoveSlot,
  onMoveOrder,
  onToggleHidden,
  onResetControl,
  onSetCustomIcon,
  onSetVariant,
  selectedPanelId,
  onSelectPanel,
  onSetPanelCorner,
  onTogglePanelHidden,
  previewStates,
  onSetPreviewState,
}: Props) {
  if (selectedPanelId) {
    return (
      <PanelInspector
        config={config}
        panelId={selectedPanelId}
        onSelect={onSelectPanel}
        onSetCorner={onSetPanelCorner}
        onToggleHidden={onTogglePanelHidden}
      />
    );
  }
  if (!selectedId) return null;
  const control = config.controls.find((c) => c.id === selectedId);
  if (!control) return null;
  const meta = CONTROL_META[selectedId];
  const peers = visibleInSlot(config, control.slot);
  const indexInSlot = peers.findIndex((c) => c.id === selectedId);
  const limit = slotLimit(control.slot);
  const crowded = peers.length >= limit;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-6 z-30 flex flex-col items-center gap-2 px-6">
      <div className="pointer-events-auto flex max-w-full items-stretch gap-1 overflow-x-auto rounded-2xl border border-white/12 bg-black/85 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="flex shrink-0 flex-col items-start justify-center px-3 py-1">
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/40">
            {meta.group}
          </span>
          <span className="whitespace-nowrap text-[13px] font-semibold text-white">
            {meta.label}
          </span>
        </div>

        <Divider />

        <Group label="Slot">
          <IconBtn
            icon={<ArrowLeft size={14} strokeWidth={2.3} />}
            onClick={() => onMoveSlot(-1)}
            title="Move to previous slot"
          />
          <Chip>{SLOT_LABEL[control.slot]}</Chip>
          <IconBtn
            icon={<ArrowRight size={14} strokeWidth={2.3} />}
            onClick={() => onMoveSlot(1)}
            title="Move to next slot"
          />
        </Group>

        <Divider />

        <Group label="Order">
          <IconBtn
            icon={<ArrowUp size={14} strokeWidth={2.3} />}
            onClick={() => onMoveOrder(-1)}
            disabled={peers.length <= 1 || indexInSlot <= 0}
            title="Move up"
          />
          <Chip mono>
            {indexInSlot + 1} / {peers.length}
          </Chip>
          <IconBtn
            icon={<ArrowDown size={14} strokeWidth={2.3} />}
            onClick={() => onMoveOrder(1)}
            disabled={peers.length <= 1 || indexInSlot >= peers.length - 1}
            title="Move down"
          />
        </Group>

        {controlStates(selectedId).length > 0 && (
          <>
            <Divider />
            <Group label="Preview state">
              <div className="flex items-center gap-0.5 rounded-lg bg-white/8 p-0.5">
                {controlStates(selectedId).map((s) => {
                  const active = (previewStates[selectedId] ?? controlStates(selectedId)[0]) === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => onSetPreviewState(selectedId, s)}
                      className={`h-8 whitespace-nowrap rounded-md px-2.5 text-[11px] font-medium transition-colors ${
                        active ? "bg-white/18 text-white" : "text-white/55 hover:text-white/85"
                      }`}
                    >
                      {STATE_LABEL[s] ?? s}
                    </button>
                  );
                })}
              </div>
            </Group>
          </>
        )}

        {isVariantAware(selectedId) && (
          <>
            <Divider />
            <Group label="Size">
              <VariantPicker
                value={control.variant ?? "auto"}
                onChange={(v) => onSetVariant(selectedId, v === "auto" ? null : v)}
              />
            </Group>
          </>
        )}

        <Divider />

        <Group label="Icon">
          <IconUpload
            currentUrl={config.customIcons?.[selectedId]}
            replaceable={isIconReplaceable(selectedId)}
            states={(() => {
              const list = controlStates(selectedId);
              if (list.length === 0) return undefined;
              return list.map((s) => ({
                id: s,
                label: STATE_LABEL[s] ?? s,
                url: config.customIcons?.[iconKey(selectedId, s)],
              }));
            })()}
            onUpload={(url, state) => onSetCustomIcon(selectedId, url, state)}
            onReset={(state) => onSetCustomIcon(selectedId, null, state)}
            onApplyToAll={(url) => {
              for (const s of controlStates(selectedId)) onSetCustomIcon(selectedId, url, s);
            }}
          />
        </Group>

        <Divider />

        <Group label={control.hidden ? "Hidden" : "Visible"}>
          <IconBtn
            icon={
              control.hidden ? (
                <EyeOff size={14} strokeWidth={2.3} />
              ) : (
                <Eye size={14} strokeWidth={2.3} />
              )
            }
            onClick={onToggleHidden}
            variant={control.hidden ? "active" : "default"}
            title={control.hidden ? "Show this control" : "Hide this control"}
          />
          <IconBtn
            icon={<RotateCcw size={13} strokeWidth={2.3} />}
            onClick={onResetControl}
            title="Reset to default"
          />
        </Group>

        <Divider />

        <IconBtn
          icon={<X size={14} strokeWidth={2.3} />}
          onClick={() => onSelect(null)}
          title="Deselect"
        />
      </div>

      {crowded && (
        <div className="pointer-events-auto rounded-full border border-amber-300/30 bg-amber-300/10 px-3.5 py-1.5 text-[11px] font-medium text-amber-200/90 backdrop-blur-xl">
          Slot is getting crowded ({peers.length}/{limit}). May overflow on narrow screens.
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1 px-1.5 py-1">
      <span className="text-[8.5px] font-semibold uppercase tracking-[0.18em] text-white/35">
        {label}
      </span>
      <div className="flex items-center gap-1">{children}</div>
    </div>
  );
}

function IconBtn({
  icon,
  onClick,
  disabled,
  title,
  variant,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  variant?: "default" | "active";
}) {
  const tone =
    variant === "active"
      ? "bg-accent/85 text-canvas hover:bg-accent"
      : "text-white/85 hover:bg-white/15 hover:text-white";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-150 active:scale-[0.94] ${
        disabled ? "cursor-not-allowed text-white/25" : tone
      }`}
    >
      {icon}
    </button>
  );
}

function Chip({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span
      className={`flex h-9 shrink-0 items-center whitespace-nowrap rounded-lg bg-white/10 px-3 text-[11.5px] text-white/90 ${
        mono ? "font-mono tabular-nums" : "font-medium"
      }`}
    >
      {children}
    </span>
  );
}

function Divider() {
  return <div className="my-1 w-px self-stretch bg-white/8" />;
}

const CORNER_LABEL: Record<PanelCorner, string> = {
  "top-left": "Top · left",
  "top-right": "Top · right",
  "bottom-left": "Bottom · left",
  "bottom-right": "Bottom · right",
};

const SIDE_LABEL: Record<"left" | "right", string> = {
  left: "Left edge",
  right: "Right edge",
};

function sideFromCorner(corner: PanelCorner): "left" | "right" {
  return corner === "top-left" || corner === "bottom-left" ? "left" : "right";
}

function PanelInspector({
  config,
  panelId,
  onSelect,
  onSetCorner,
  onToggleHidden,
}: {
  config: PlayerChromeConfig;
  panelId: PanelId;
  onSelect: (id: PanelId | null) => void;
  onSetCorner: (id: PanelId, corner: PanelCorner) => void;
  onToggleHidden: (id: PanelId) => void;
}) {
  const meta = PANEL_META[panelId];
  const cfg = panelConfig(config, panelId);
  const eyebrow = panelId === "episodes" ? "Series tab" : "Watch Together panel";
  return (
    <div className="pointer-events-none absolute inset-x-0 top-6 z-40 flex flex-col items-center gap-2 px-6">
      <div className="pointer-events-auto flex max-w-full items-stretch gap-1 overflow-x-auto rounded-2xl border border-white/12 bg-black/85 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
        <div className="flex shrink-0 flex-col items-start justify-center px-3 py-1">
          <span className="text-[9.5px] font-semibold uppercase tracking-[0.18em] text-white/40">
            {eyebrow}
          </span>
          <span className="whitespace-nowrap text-[13px] font-semibold text-white">
            {meta.label}
          </span>
        </div>

        <Divider />

        <div className="flex shrink-0 flex-col items-center gap-1 px-1.5 py-1">
          <span className="text-[8.5px] font-semibold uppercase tracking-[0.18em] text-white/35">
            {meta.placementMode === "side" ? "Side" : "Corner"}
          </span>
          <div className="flex items-center gap-1">
            {meta.placementMode === "side"
              ? (["left", "right"] as const).map((side) => {
                  const active = sideFromCorner(cfg.corner) === side;
                  const targetCorner: PanelCorner = side === "left" ? "top-left" : "top-right";
                  return (
                    <button
                      key={side}
                      type="button"
                      onClick={() => onSetCorner(panelId, targetCorner)}
                      title={SIDE_LABEL[side]}
                      className={`flex h-9 items-center whitespace-nowrap rounded-lg px-2.5 text-[11.5px] font-medium transition-colors ${
                        active ? "bg-white/18 text-white" : "text-white/55 hover:text-white/85"
                      }`}
                    >
                      {SIDE_LABEL[side]}
                    </button>
                  );
                })
              : PANEL_CORNERS.map((c) => {
                  const active = cfg.corner === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onSetCorner(panelId, c)}
                      title={CORNER_LABEL[c]}
                      className={`flex h-9 items-center whitespace-nowrap rounded-lg px-2.5 text-[11.5px] font-medium transition-colors ${
                        active ? "bg-white/18 text-white" : "text-white/55 hover:text-white/85"
                      }`}
                    >
                      {CORNER_LABEL[c]}
                    </button>
                  );
                })}
          </div>
        </div>

        <Divider />

        <Group label={cfg.hidden ? "Hidden" : "Visible"}>
          <IconBtn
            icon={
              cfg.hidden ? (
                <EyeOff size={14} strokeWidth={2.3} />
              ) : (
                <Eye size={14} strokeWidth={2.3} />
              )
            }
            onClick={() => onToggleHidden(panelId)}
            variant={cfg.hidden ? "active" : "default"}
            title={cfg.hidden ? "Show this panel" : "Hide this panel"}
          />
        </Group>

        <Divider />

        <IconBtn
          icon={<X size={14} strokeWidth={2.3} />}
          onClick={() => onSelect(null)}
          title="Deselect"
        />
      </div>
    </div>
  );
}

const VARIANT_OPTIONS: { value: ControlVariant; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "full", label: "Full" },
  { value: "condensed", label: "Icon" },
];

function VariantPicker({
  value,
  onChange,
}: {
  value: ControlVariant;
  onChange: (v: ControlVariant) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-white/8 p-0.5">
      {VARIANT_OPTIONS.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`h-8 whitespace-nowrap rounded-md px-2.5 text-[11px] font-medium transition-colors ${
              active ? "bg-white/18 text-white" : "text-white/55 hover:text-white/85"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
