import { PanelRightClose, Redo2, Undo2, X } from "../../icons";
import { useT } from "@/lib/i18n";

export function StudioHeader({
  name,
  minimizeRef,
  onCancel,
  onHidePanel,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  dragHandleProps,
}: {
  name: string;
  minimizeRef?: React.Ref<HTMLButtonElement>;
  onCancel: () => void;
  onHidePanel: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  dragHandleProps?: React.HTMLAttributes<HTMLElement>;
}) {
  const t = useT();
  return (
    <header
      {...dragHandleProps}
      className="flex h-[60px] shrink-0 items-center gap-1 bg-canvas px-2 cursor-grab select-none active:cursor-grabbing"
    >
      <button
        type="button"
        ref={minimizeRef}
        onClick={onHidePanel}
        aria-label={t("Minimize panel")}
        title={t("Minimize to preview (Ctrl/Cmd + P)")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
      >
        <PanelRightClose size={18} strokeWidth={2.2} className="dir-icon" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col px-1">
        <span className="text-[13px] font-extrabold uppercase leading-[18px] tracking-[0.72px] text-ink-subtle">
          {t("Theme studio")}
        </span>
        <span className="truncate text-[16.5px] font-semibold leading-[24px] tracking-[-0.1px] text-ink">
          {name || t("Untitled theme")}
        </span>
      </div>
      <div className="flex items-center">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label={t("Undo")}
          title={t("Undo (Ctrl/Cmd + Z)")}
          className="flex h-11 w-9 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-30"
        >
          <Undo2 size={18} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label={t("Redo")}
          title={t("Redo (Ctrl/Cmd + Shift + Z)")}
          className="flex h-11 w-9 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-30"
        >
          <Redo2 size={18} strokeWidth={2.2} />
        </button>
      </div>
      <div className="mx-1 h-6 w-px bg-edge-soft" />
      <button
        type="button"
        onClick={onCancel}
        aria-label={t("Close studio")}
        title={t("Close")}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-danger/25 hover:text-danger"
      >
        <X size={18} strokeWidth={2.4} />
      </button>
    </header>
  );
}
