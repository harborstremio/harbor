import { confirmDialog } from "@/lib/dialog";
import { useT } from "@/lib/i18n";
import { sourceLabel, type CustomList } from "@/lib/lists/types";
import { Check, ChevronDown, Copy, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { AddListForm } from "./add-list-form";
import { SOURCE_DOT } from "./source-dot";

type Mode = "list" | "add" | "edit";
type ActionsState = { id: string; copied: boolean };

export function ListPicker({
  lists,
  activeId,
  count,
  onSelect,
  onAdd,
  onEdit,
  onRemove,
}: {
  lists: CustomList[];
  activeId: string | null;
  count: number | null;
  onSelect: (id: string) => void;
  onAdd: (ref: string, name?: string) => void;
  onEdit: (id: string, ref: string, name?: string) => void;
  onRemove: (id: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionsState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const close = () => {
    setOpen(false);
    setMode("list");
    setEditingId(null);
    setActions(null);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (actions) setActions(null);
      else if (mode !== "list") setMode("list");
      else close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, mode, actions]);

  const active = lists.find((l) => l.id === activeId) ?? null;
  const editing = editingId ? (lists.find((l) => l.id === editingId) ?? null) : null;

  const copyRef = async (ref: string, id: string) => {
    try {
      await navigator.clipboard.writeText(ref);
      setActions({ id, copied: true });
      window.setTimeout(() => setActions((cur) => (cur?.id === id ? null : cur)), 1200);
    } catch {
      /* noop */
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 items-center gap-2.5 rounded-xl border border-edge-soft/55 bg-elevated px-3.5 pe-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-raised"
      >
        <span
          className={`flex h-2 w-2 shrink-0 rounded-full ${active ? SOURCE_DOT[active.source] : "bg-ink-subtle/45"}`}
        />
        <span className="max-w-[200px] truncate">{active?.name ?? t("No lists yet")}</span>
        {count != null && (
          <span className="rounded-full bg-canvas/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-muted">
            {count.toLocaleString()}
          </span>
        )}
        <ChevronDown
          size={15}
          strokeWidth={2}
          className={`text-ink-subtle transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute start-0 top-[calc(100%+8px)] z-[100] w-[340px] overflow-hidden rounded-2xl border border-edge-soft bg-elevated shadow-[0_18px_50px_-15px_rgba(0,0,0,0.6)]">
          {mode === "list" && (
            <>
              <div className="max-h-[280px] overflow-y-auto py-1.5">
                {lists.length === 0 && (
                  <p className="px-3.5 py-3 text-[12.5px] text-ink-subtle">{t("No lists saved yet.")}</p>
                )}
                {lists.map((l) => {
                  const isOpen = actions?.id === l.id;
                  return (
                    <ListRow
                      key={l.id}
                      list={l}
                      isActive={l.id === activeId}
                      isMenuOpen={isOpen}
                      copied={isOpen && (actions?.copied ?? false)}
                      onSelect={() => {
                        onSelect(l.id);
                        close();
                      }}
                      onToggleMenu={() => setActions(isOpen ? null : { id: l.id, copied: false })}
                      onCloseMenu={() => setActions(null)}
                      onEdit={() => {
                        setEditingId(l.id);
                        setMode("edit");
                        setActions(null);
                      }}
                      onCopy={() => void copyRef(l.ref, l.id)}
                      onDelete={async () => {
                        if (await confirmDialog(t('Remove list "{name}"?', { name: l.name }))) {
                          onRemove(l.id);
                          setActions(null);
                        }
                      }}
                    />
                  );
                })}
              </div>
              <div className="border-t border-edge-soft/55 p-1.5">
                <button
                  onClick={() => setMode("add")}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-start text-[13px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                >
                  <Plus size={15} strokeWidth={2} />
                  {t("Add a list")}
                </button>
              </div>
            </>
          )}

          {mode === "add" && (
            <AddListForm
              submitLabel={t("Add")}
              onCancel={() => setMode("list")}
              onSubmit={({ ref, name }) => {
                onAdd(ref, name);
                close();
              }}
            />
          )}

          {mode === "edit" && editing && (
            <AddListForm
              initialRef={editing.ref}
              initialName={editing.name}
              submitLabel={t("Save")}
              onCancel={() => {
                setMode("list");
                setEditingId(null);
              }}
              onSubmit={({ ref, name }) => {
                onEdit(editing.id, ref, name);
                setMode("list");
                setEditingId(null);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

function ListRow({
  list,
  isActive,
  isMenuOpen,
  copied,
  onSelect,
  onToggleMenu,
  onCloseMenu,
  onEdit,
  onCopy,
  onDelete,
}: {
  list: CustomList;
  isActive: boolean;
  isMenuOpen: boolean;
  copied: boolean;
  onSelect: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      <div
        className={`group flex items-center pe-1.5 transition-colors ${
          isActive ? "bg-raised text-ink" : "text-ink-muted hover:bg-raised hover:text-ink"
        }`}
      >
        <button onClick={onSelect} className="flex flex-1 items-center gap-2.5 px-3.5 py-2.5 text-start text-[13.5px]">
          <span
            className={`h-2 w-2 shrink-0 rounded-full ${isActive ? SOURCE_DOT[list.source] : "bg-ink-subtle/45"}`}
          />
          <span className="truncate">{list.name}</span>
        </button>
        <button
          ref={triggerRef}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu();
          }}
          aria-label={t("More for {name}", { name: list.name })}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-opacity ${
            isMenuOpen ? "text-ink" : "text-ink-subtle opacity-0 hover:text-ink group-hover:opacity-100"
          }`}
        >
          <MoreHorizontal size={15} strokeWidth={2} />
        </button>
      </div>
      {isMenuOpen && (
        <PortalMenu triggerRef={triggerRef} onClose={onCloseMenu}>
          <MenuItem icon={<Pencil size={14} strokeWidth={1.9} />} onClick={onEdit}>
            {t("Edit")}
          </MenuItem>
          <MenuItem
            icon={copied ? <Check size={14} strokeWidth={2.2} /> : <Copy size={14} strokeWidth={1.9} />}
            onClick={onCopy}
            accent={copied}
          >
            {copied ? t("Copied to clipboard") : t("Copy URL")}
          </MenuItem>
          <div className="my-0.5 mx-2 h-px bg-edge-soft/60" />
          <MenuItem icon={<Trash2 size={14} strokeWidth={1.9} />} onClick={onDelete} danger>
            {t("Delete")}
          </MenuItem>
          <div className="border-t border-edge-soft/40 px-3 py-2 text-[10.5px] uppercase tracking-[0.16em] text-ink-subtle">
            {t("From {source}", { source: sourceLabel(list.source) })}
          </div>
        </PortalMenu>
      )}
    </>
  );
}

function PortalMenu({
  triggerRef,
  onClose,
  children,
}: {
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const t = triggerRef.current;
      const m = menuRef.current;
      if (!t || !m) return;
      const r = t.getBoundingClientRect();
      const mw = m.offsetWidth || 220;
      const mh = m.offsetHeight || 200;
      const pad = 6;
      let left = r.right - mw;
      let top = r.bottom + pad;
      if (top + mh > window.innerHeight - pad) top = r.top - mh - pad;
      left = Math.max(pad, Math.min(window.innerWidth - mw - pad, left));
      setPos({ left, top });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [triggerRef]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [onClose, triggerRef]);

  return createPortal(
    <div
      ref={menuRef}
      className="fixed z-[9999] w-[220px] overflow-hidden rounded-xl border border-edge-soft bg-canvas shadow-[0_14px_40px_-10px_rgba(0,0,0,0.7)]"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? -9999, opacity: pos ? 1 : 0 }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body,
  );
}

function MenuItem({
  icon,
  children,
  onClick,
  danger,
  accent,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  accent?: boolean;
}) {
  const tone = danger
    ? "text-danger hover:bg-danger/10"
    : accent
      ? "text-accent"
      : "text-ink-muted hover:bg-raised hover:text-ink";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-start text-[12.5px] font-medium transition-colors ${tone}`}
    >
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      {children}
    </button>
  );
}
