import { ChevronDown, ChevronUp, Eye, EyeOff, GripVertical } from "../../../icons";
import { useEffect, useRef, useState } from "react";
import type { NavItem } from "@/chrome/nav-items";
import { useT } from "@/lib/i18n";
import { tvFocus } from "@/lib/keyboard-navigation";
import { isBackKey } from "@/lib/keyboard-navigation/geometry";

export function NavRow({
  item,
  name,
  hidden,
  renamable,
  isRenamed,
  dragging,
  dropBefore,
  dropAfter,
  isFirst,
  isLast,
  onRename,
  onToggleHidden,
  onMoveUp,
  onMoveDown,
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
  isFirst: boolean;
  isLast: boolean;
  onRename: (label: string) => void;
  onToggleHidden: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDragStart: () => void;
  onOver: (pos: "before" | "after") => void;
  onDropItem: (pos: "before" | "after") => void;
  onDragEnd: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(name);
  const upRef = useRef<HTMLButtonElement>(null);
  const downRef = useRef<HTMLButtonElement>(null);
  useEffect(() => setDraft(name), [name]);

  const posFrom = (e: { clientY: number; currentTarget: HTMLElement }): "before" | "after" => {
    const rect = e.currentTarget.getBoundingClientRect();
    return e.clientY < rect.top + rect.height / 2 ? "before" : "after";
  };

  const commit = (value: string) => {
    if (value.trim() !== name) onRename(value);
  };

  const move = (up: boolean) => {
    if (up) onMoveUp();
    else onMoveDown();
    requestAnimationFrame(() => {
      const self = up ? upRef.current : downRef.current;
      if (!self || !self.disabled) return;
      const other = up ? downRef.current : upRef.current;
      if (other && !other.disabled) tvFocus(other);
    });
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
      className={`relative flex items-center gap-2 rounded-md border bg-canvas px-2 py-1.5 transition-colors ${
        dragging ? "border-accent opacity-50" : "border-edge-soft"
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
        aria-label={t("Drag to reorder")}
        className="flex h-8 w-5 shrink-0 cursor-grab items-center justify-center text-ink-subtle transition-colors hover:text-ink active:cursor-grabbing"
      >
        <GripVertical size={16} strokeWidth={2} />
      </span>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md text-ink-muted">
        {item.render(false)}
      </span>
      {renamable ? (
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit(e.currentTarget.value);
            }
            if (isBackKey(e.nativeEvent)) {
              setDraft(name);
              e.currentTarget.value = name;
            }
          }}
          aria-label={t("Rename {name}", { name })}
          className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-[15px] font-medium text-ink outline-none transition-colors hover:bg-canvas focus:bg-canvas"
        />
      ) : (
        <span
          title={t("This layout shows icons only, so labels are not displayed.")}
          className="min-w-0 flex-1 truncate px-1.5 py-1 text-[15px] font-medium text-ink-muted"
        >
          {name}
        </span>
      )}
      {renamable && isRenamed && (
        <button
          type="button"
          onClick={() => onRename("")}
          title={t("Reset to default name")}
          className="shrink-0 rounded-md bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-accent transition-colors hover:bg-accent-soft"
        >
          {t("Renamed")}
        </button>
      )}
      <MoveBtn ref={upRef} label={t("Move up")} disabled={isFirst} onClick={() => move(true)}>
        <ChevronUp size={16} strokeWidth={2.4} />
      </MoveBtn>
      <MoveBtn ref={downRef} label={t("Move down")} disabled={isLast} onClick={() => move(false)}>
        <ChevronDown size={16} strokeWidth={2.4} />
      </MoveBtn>
      <button
        type="button"
        onClick={onToggleHidden}
        title={hidden ? t("Show in nav") : t("Hide from nav")}
        aria-pressed={hidden}
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors ${
          hidden
            ? "bg-danger/15 text-danger hover:bg-danger/25"
            : "text-ink-subtle hover:bg-raised hover:text-ink"
        }`}
      >
        {hidden ? <EyeOff size={16} strokeWidth={2.2} /> : <Eye size={16} strokeWidth={2.2} />}
      </button>
    </div>
  );
}

function MoveBtn({
  ref,
  label,
  disabled,
  onClick,
  children,
}: {
  ref: React.Ref<HTMLButtonElement>;
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      ref={ref}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-raised hover:text-ink disabled:opacity-25 disabled:hover:bg-transparent"
    >
      {children}
    </button>
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
