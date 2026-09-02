import { PanelRightClose, Redo2, Undo2, X } from "lucide-react";
import { useT } from "@/lib/i18n";

export function StudioHeader({
  name,
  onCancel,
  onHidePanel,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  dragHandleProps,
}: {
  name: string;
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
      className="flex h-14 shrink-0 items-center gap-1 bg-canvas px-2.5 cursor-grab select-none active:cursor-grabbing"
    >
      <button
        type="button"
        onClick={onHidePanel}
        aria-label={t("Minimize panel")}
        title={t("Minimize to preview (Esc)")}
        className="flex h-10 w-10 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
      >
        <PanelRightClose size={18} strokeWidth={2.2} className="dir-icon" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col px-1">
        <span className="text-[10.5px] font-bold uppercase tracking-[0.2em] text-ink-subtle">
          {t("Theme studio")}
        </span>
        <span className="truncate text-[13.5px] font-semibold text-ink">
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
          className="flex h-10 w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-30"
        >
          <Undo2 size={18} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label={t("Redo")}
          title={t("Redo (Ctrl/Cmd + Shift + Z)")}
          className="flex h-10 w-9 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-30"
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
        className="flex h-10 w-10 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-danger/25 hover:text-danger"
      >
        <X size={18} strokeWidth={2.4} />
      </button>
    </header>
  );
}
