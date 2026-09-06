import { useT } from "@/lib/i18n";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Eye, EyeOff, RotateCcw, X } from "../icons";
import { useRef } from "react";
import { tvFocus } from "@/lib/keyboard-navigation";
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
import { stripArrowKeys } from "../shared";

const OVERLAY_LABEL =
  "text-[13px] font-extrabold uppercase leading-[17px] tracking-[0.72px]";
const OVERLAY_TITLE = "text-[16.5px] font-medium leading-[24px] tracking-[-0.1px] text-white";
const SEG_BTN =
  "flex h-11 shrink-0 items-center whitespace-nowrap rounded-md px-3 text-[15px] font-medium transition-colors";

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
  const t = useT();
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const stateRefs = useRef<(HTMLButtonElement | null)[]>([]);
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
  const states = controlStates(selectedId);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-6 z-30 flex flex-col items-center gap-2 px-6">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-stretch gap-1 rounded-md border border-white/12 bg-black/85 p-2 harbor-float backdrop-blur-2xl">
        <div className="flex shrink-0 flex-col items-start justify-center px-3 py-1">
          <span className={`${OVERLAY_LABEL} text-white/60`}>{t(meta.group)}</span>
          <span className={`whitespace-nowrap ${OVERLAY_TITLE}`}>{t(meta.label)}</span>
        </div>

        <Divider />

        <Group label={t("Slot")}>
          <IconBtn
            icon={<ArrowLeft size={18} strokeWidth={2.3} className="dir-icon" />}
            onClick={() => onMoveSlot(-1)}
            title={t("Move to previous slot")}
          />
          <Chip>{t(SLOT_LABEL[control.slot])}</Chip>
          <IconBtn
            icon={<ArrowRight size={18} strokeWidth={2.3} className="dir-icon" />}
            onClick={() => onMoveSlot(1)}
            title={t("Move to next slot")}
          />
        </Group>

        <Divider />

        <Group label={t("Order")}>
          <IconBtn
            btnRef={upRef}
            icon={<ArrowUp size={18} strokeWidth={2.3} />}
            onClick={() => {
              handOff(upRef.current, indexInSlot <= 1 ? downRef.current : null);
              onMoveOrder(-1);
            }}
            disabled={peers.length <= 1 || indexInSlot <= 0}
            title={t("Move up")}
          />
          <Chip mono>
            {indexInSlot + 1} / {peers.length}
          </Chip>
          <IconBtn
            btnRef={downRef}
            icon={<ArrowDown size={18} strokeWidth={2.3} />}
            onClick={() => {
              handOff(downRef.current, indexInSlot >= peers.length - 2 ? upRef.current : null);
              onMoveOrder(1);
            }}
            disabled={peers.length <= 1 || indexInSlot >= peers.length - 1}
            title={t("Move down")}
          />
        </Group>

        {states.length > 0 && (
          <>
            <Divider />
            <Group label={t("Preview state")}>
              <div
                onKeyDown={stripArrowKeys(stateRefs, (i) => onSetPreviewState(selectedId, states[i]))}
                className="flex items-center gap-0.5 rounded-md bg-white/8 p-0.5"
              >
                {states.map((s, i) => {
                  const active = (previewStates[selectedId] ?? states[0]) === s;
                  return (
                    <button
                      key={s}
                      ref={(el) => {
                        stateRefs.current[i] = el;
                      }}
                      type="button"
                      onClick={() => onSetPreviewState(selectedId, s)}
                      className={`${SEG_BTN} ${
                        active ? "bg-white/18 text-white" : "text-white/70 hover:text-white"
                      }`}
                    >
                      {STATE_LABEL[s] ? t(STATE_LABEL[s]) : s}
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
            <Group label={t("Size")}>
              <VariantPicker
                value={control.variant ?? "auto"}
                onChange={(v) => onSetVariant(selectedId, v === "auto" ? null : v)}
              />
            </Group>
          </>
        )}

        <Divider />

        <Group label={t("Icon")}>
          <IconUpload
            currentUrl={config.customIcons?.[selectedId]}
            replaceable={isIconReplaceable(selectedId)}
            controlId={selectedId}
            states={(() => {
              if (states.length === 0) return undefined;
              return states.map((s) => ({
                id: s,
                label: STATE_LABEL[s] ? t(STATE_LABEL[s]) : s,
                url: config.customIcons?.[iconKey(selectedId, s)],
              }));
            })()}
            onUpload={(url, state) => onSetCustomIcon(selectedId, url, state)}
            onReset={(state) => onSetCustomIcon(selectedId, null, state)}
            onApplyToAll={(url) => {
              for (const s of states) onSetCustomIcon(selectedId, url, s);
            }}
          />
        </Group>

        <Divider />

        <Group label={t(control.hidden ? "Hidden" : "Visible")}>
          <IconBtn
            icon={
              control.hidden ? (
                <EyeOff size={18} strokeWidth={2.3} />
              ) : (
                <Eye size={18} strokeWidth={2.3} />
              )
            }
            onClick={onToggleHidden}
            variant={control.hidden ? "active" : "default"}
            title={t(control.hidden ? "Show this control" : "Hide this control")}
          />
          <IconBtn
            icon={<RotateCcw size={18} strokeWidth={2.3} />}
            onClick={onResetControl}
            title={t("Reset to default")}
          />
        </Group>

        <Divider />

        <IconBtn
          btnRef={closeRef}
          icon={<X size={18} strokeWidth={2.3} />}
          onClick={() => {
            handOff(closeRef.current, document.querySelector(`[data-control-id="${selectedId}"]`));
            onSelect(null);
          }}
          title={t("Deselect")}
        />
      </div>

      {crowded && (
        <div className="pointer-events-auto max-w-[66ch] rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-[15.5px] font-medium leading-[22px] text-accent backdrop-blur-xl">
          {t("Slot is getting crowded ({count}/{limit}). May overflow on narrow screens.", {
            count: peers.length,
            limit,
          })}
        </div>
      )}
    </div>
  );
}

function handOff(from: HTMLElement | null, to: Element | null) {
  if (!from || !to || !(to instanceof HTMLElement) || document.activeElement !== from) return;
  tvFocus(to);
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-1 px-1.5 py-1">
      <span className={`${OVERLAY_LABEL} text-white/60`}>{label}</span>
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
  btnRef,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  variant?: "default" | "active";
  btnRef?: React.Ref<HTMLButtonElement>;
}) {
  const tone =
    variant === "active"
      ? "bg-accent-soft text-canvas hover:bg-accent"
      : "text-white/85 hover:bg-white/15 hover:text-white";
  return (
    <button
      ref={btnRef}
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition duration-150 active:scale-[0.94] ${
        disabled ? "cursor-not-allowed text-white/30" : tone
      }`}
    >
      {icon}
    </button>
  );
}

function Chip({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <span
      className={`flex h-11 shrink-0 items-center whitespace-nowrap rounded-md bg-white/10 px-3.5 text-[15px] text-white ${
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
  const t = useT();
  const placeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const closeRef = useRef<HTMLButtonElement>(null);
  const meta = PANEL_META[panelId];
  const cfg = panelConfig(config, panelId);
  const eyebrow = t(panelId === "episodes" ? "Series tab" : "Watch Together panel");
  const sides = ["left", "right"] as const;
  const placeCommit = (i: number) => {
    if (meta.placementMode === "side") onSetCorner(panelId, sides[i] === "left" ? "top-left" : "top-right");
    else onSetCorner(panelId, PANEL_CORNERS[i]);
  };
  return (
    <div className="pointer-events-none absolute inset-x-0 top-6 z-40 flex flex-col items-center gap-2 px-6">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-stretch gap-1 rounded-md border border-white/12 bg-black/85 p-2 harbor-float backdrop-blur-2xl">
        <div className="flex shrink-0 flex-col items-start justify-center px-3 py-1">
          <span className={`${OVERLAY_LABEL} text-white/60`}>{eyebrow}</span>
          <span className={`whitespace-nowrap ${OVERLAY_TITLE}`}>{t(meta.label)}</span>
        </div>

        <Divider />

        <div className="flex shrink-0 flex-col items-center gap-1 px-1.5 py-1">
          <span className={`${OVERLAY_LABEL} text-white/60`}>
            {t(meta.placementMode === "side" ? "Side" : "Corner")}
          </span>
          <div onKeyDown={stripArrowKeys(placeRefs, placeCommit)} className="flex items-center gap-1">
            {meta.placementMode === "side"
              ? sides.map((side, i) => {
                  const active = sideFromCorner(cfg.corner) === side;
                  const targetCorner: PanelCorner = side === "left" ? "top-left" : "top-right";
                  return (
                    <button
                      key={side}
                      ref={(el) => {
                        placeRefs.current[i] = el;
                      }}
                      type="button"
                      onClick={() => onSetCorner(panelId, targetCorner)}
                      title={t(SIDE_LABEL[side])}
                      className={`${SEG_BTN} ${
                        active ? "bg-white/18 text-white" : "text-white/70 hover:text-white"
                      }`}
                    >
                      {t(SIDE_LABEL[side])}
                    </button>
                  );
                })
              : PANEL_CORNERS.map((c, i) => {
                  const active = cfg.corner === c;
                  return (
                    <button
                      key={c}
                      ref={(el) => {
                        placeRefs.current[i] = el;
                      }}
                      type="button"
                      onClick={() => onSetCorner(panelId, c)}
                      title={t(CORNER_LABEL[c])}
                      className={`${SEG_BTN} ${
                        active ? "bg-white/18 text-white" : "text-white/70 hover:text-white"
                      }`}
                    >
                      {t(CORNER_LABEL[c])}
                    </button>
                  );
                })}
          </div>
        </div>

        <Divider />

        <Group label={t(cfg.hidden ? "Hidden" : "Visible")}>
          <IconBtn
            icon={
              cfg.hidden ? (
                <EyeOff size={18} strokeWidth={2.3} />
              ) : (
                <Eye size={18} strokeWidth={2.3} />
              )
            }
            onClick={() => onToggleHidden(panelId)}
            variant={cfg.hidden ? "active" : "default"}
            title={t(cfg.hidden ? "Show this panel" : "Hide this panel")}
          />
        </Group>

        <Divider />

        <IconBtn
          btnRef={closeRef}
          icon={<X size={18} strokeWidth={2.3} />}
          onClick={() => {
            handOff(closeRef.current, document.querySelector(`[data-panel-id="${panelId}"]`));
            onSelect(null);
          }}
          title={t("Deselect")}
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
  const t = useT();
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  return (
    <div
      onKeyDown={stripArrowKeys(btnRefs, (i) => onChange(VARIANT_OPTIONS[i].value))}
      className="flex items-center gap-0.5 rounded-md bg-white/8 p-0.5"
    >
      {VARIANT_OPTIONS.map((opt, i) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`${SEG_BTN} ${
              active ? "bg-white/18 text-white" : "text-white/70 hover:text-white"
            }`}
          >
            {t(opt.label)}
          </button>
        );
      })}
    </div>
  );
}
