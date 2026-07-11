import type { NavItem } from "@/chrome/nav-items";
import { Eye, EyeOff, GripVertical } from "lucide-react";
import { useEffect, useState } from "react";

export function NavRow({
  item,
  name,
  hidden,
  renamable,
  isRenamed,
  dragging,
  dropBefore,
  dropAfter,
  onRename,
  onToggleHidden,
  onDragStart,
  onOver,
  onDropItem,
  onDragEnd,
}: {
  item: NavItem;
  name: string;
  hidden: boolean;
  renamable: boolean;
  isRenamed: boolean;
  dragging: boolean;
  dropBefore: boolean;
  dropAfter: boolean;
  onRename: (label: string) => void;
  onToggleHidden: () => void;
  onDragStart: () => void;
  onOver: (pos: "before" | "after") => void;
  onDropItem: (pos: "before" | "after") => void;
  onDragEnd: () => void;
}) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);

  const posFrom = (e: { clientY: number; currentTarget: HTMLElement }): "before" | "after" => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
  };

  const commit = () => {
    if (draft.trim() !== name) onRename(draft);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onOver(posFrom(e));
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDropItem(posFrom(e));
      }}
      className={`relative flex items-center gap-2 rounded-lg border bg-canvas/50 px-2 py-1.5 transition-colors ${
        dragging ? "border-accent/60 opacity-50" : "border-edge-soft"
      } ${hidden ? "opacity-60" : ""}`}
    >
      {dropBefore && <DropLine className="top-[-4px]" />}
      {dropAfter && <DropLine className="bottom-[-4px]" />}
      <span
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", item.id);
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        aria-label="Drag to reorder"
        className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-ink-subtle transition-colors hover:text-ink active:cursor-grabbing"
      >
        <GripVertical size={16} strokeWidth={2} />
      </span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-edge-soft text-ink-muted">
        {item.render(false)}
      </span>
      {renamable ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              commit();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setDraft(name);
              e.currentTarget.blur();
            }
          }}
          aria-label={`Rename ${name}`}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-[15px] font-medium text-ink outline-none transition-colors hover:bg-canvas/40 focus:bg-canvas/55"
        />
      ) : (
        <span
          title="This layout shows icons only, so labels are not displayed."
          className="min-w-0 flex-1 truncate px-1.5 py-1 text-[15px] font-medium text-ink-muted"
        >
          {name}
        </span>
      )}
      {renamable && isRenamed && (
        <button
          type="button"
          onClick={() => onRename("")}
          title="Reset to default name"
          className="shrink-0 rounded-md bg-accent/15 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent transition-colors hover:bg-accent/25"
        >
          Renamed
        </button>
      )}
      <button
        type="button"
        onClick={onToggleHidden}
        title={hidden ? "Show in nav" : "Hide from nav"}
        aria-pressed={hidden}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
          hidden ? "bg-danger/15 text-danger hover:bg-danger/25" : "text-ink-subtle hover:bg-raised hover:text-ink"
        }`}
      >
        {hidden ? <EyeOff size={15} strokeWidth={2.2} /> : <Eye size={15} strokeWidth={2.2} />}
      </button>
    </div>
  );
}

function DropLine({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute inset-x-1.5 z-10 h-0.5 rounded-full bg-accent ${className}`}
    />
  );
}
