import { PanelRightClose, Redo2, Undo2, X } from "lucide-react";

export function StudioHeader({
  name,
  onCancel,
  onHidePanel,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  name: string;
  onCancel: () => void;
  onHidePanel: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  return (
    <header
      data-tauri-drag-region
      className="flex h-14 shrink-0 items-center gap-1 border-b border-edge-soft bg-surface/80 px-2.5 backdrop-blur-md"
    >
      <button
        type="button"
        onClick={onHidePanel}
        aria-label="Minimize panel"
        title="Minimize to preview (Esc)"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
      >
        <PanelRightClose size={18} strokeWidth={2.2} className="dir-icon" />
      </button>
      <div className="flex min-w-0 flex-1 flex-col px-1">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-subtle">Theme studio</span>
        <span className="truncate text-[14px] font-semibold text-ink">{name || "Untitled theme"}</span>
      </div>
      <div className="flex items-center">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          aria-label="Undo"
          title="Undo (Ctrl/Cmd + Z)"
          className="flex h-10 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-30"
        >
          <Undo2 size={17} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          aria-label="Redo"
          title="Redo (Ctrl/Cmd + Shift + Z)"
          className="flex h-10 w-9 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-elevated hover:text-ink disabled:pointer-events-none disabled:opacity-30"
        >
          <Redo2 size={17} strokeWidth={2.2} />
        </button>
      </div>
      <div className="mx-1 h-6 w-px bg-edge-soft" />
      <button
        type="button"
        onClick={onCancel}
        aria-label="Close studio"
        title="Close"
        className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-danger/12 hover:text-danger"
      >
        <X size={18} strokeWidth={2.4} />
      </button>
    </header>
  );
}
