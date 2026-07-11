import { confirmDialog } from "@/lib/dialog";
import { useT } from "@/lib/i18n";
import type { IptvPlaylistSource } from "@/lib/iptv/types";
import {
  ArrowUpToLine,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { EMPTY_FORM, PlaylistForm, type PlaylistFormValue } from "./source-picker/playlist-form";

type ActionsState = { id: string; copied: boolean };

export function SourcePicker({
  sources,
  activeId,
  exportEnabled,
  onSelect,
  onAdd,
  onEdit,
  onRemove,
  onMove,
  onMoveTop,
  onRefresh,
  onExport,
  fetchedAt,
  channelCount,
  loading,
}: {
  sources: IptvPlaylistSource[];
  activeId: string | null;
  exportEnabled: boolean;
  onSelect: (id: string) => void;
  onAdd: (entry: PlaylistFormValue) => void;
  onEdit: (id: string, entry: PlaylistFormValue) => void;
  onRemove: (id: string) => void;
  onMove?: (id: string, delta: number) => void;
  onMoveTop?: (id: string) => void;
  onRefresh: () => void;
  onExport: (id: string) => void;
  fetchedAt: number | null;
  channelCount: number | null;
  loading: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "add" | "edit">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [actions, setActions] = useState<ActionsState | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (actions) setActions(null);
        else if (mode !== "list") setMode("list");
        else close();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, mode, actions]);

  const close = () => {
    setOpen(false);
    setMode("list");
    setEditingId(null);
    setActions(null);
  };

  const editing = editingId ? (sources.find((s) => s.id === editingId) ?? null) : null;
  const active = sources.find((s) => s.id === activeId);
  const ago = fetchedAt ? formatAgo(Date.now() - fetchedAt, t) : null;

  const copyUrl = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setActions({ id, copied: true });
      window.setTimeout(() => {
        setActions((cur) => (cur && cur.id === id ? null : cur));
      }, 1200);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div ref={wrapRef} className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex h-11 items-center gap-2.5 rounded-xl border border-edge-soft/55 bg-elevated px-3.5 pe-3 text-[13.5px] font-medium text-ink transition-colors hover:bg-raised"
        >
          <span className="flex h-2 w-2 shrink-0 rounded-full bg-danger" />
          <span className="max-w-[200px] truncate">{active?.name ?? t("No playlist")}</span>
          {channelCount != null && (
            <span className="rounded-full bg-canvas/70 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-ink-muted">
              {channelCount.toLocaleString()}
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
                  {sources.map((s, idx) => {
                    const isActive = s.id === activeId;
                    const isOpen = actions?.id === s.id;
                    return (
                      <SourceRow
                        key={s.id}
                        source={s}
                        index={idx}
                        total={sources.length}
                        onMove={onMove ? (d) => onMove(s.id, d) : undefined}
                        onMoveTop={onMoveTop ? () => onMoveTop(s.id) : undefined}
                        isActive={isActive}
                        isMenuOpen={isOpen}
                        copied={isOpen && (actions?.copied ?? false)}
                        exportEnabled={exportEnabled && isActive}
                        onSelect={() => {
                          onSelect(s.id);
                          close();
                        }}
                        onToggleMenu={() => setActions(isOpen ? null : { id: s.id, copied: false })}
                        onCloseMenu={() => setActions(null)}
                        onEdit={() => {
                          setEditingId(s.id);
                          setMode("edit");
                          setActions(null);
                        }}
                        onCopy={() => void copyUrl(s.url, s.id)}
                        onExport={() => {
                          onExport(s.id);
                          setActions(null);
                        }}
                        onDelete={async () => {
                          if (await confirmDialog(t('Remove playlist "{name}"?', { name: s.name }))) {
                            onRemove(s.id);
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
                    {t("Add another playlist")}
                  </button>
                </div>
              </>
            )}
            {mode === "add" && (
              <PlaylistForm
                initial={EMPTY_FORM}
                submitLabel={t("Add")}
                onCancel={() => setMode("list")}
                onSubmit={(v) => {
                  onAdd(v);
                  close();
                }}
              />
            )}
            {mode === "edit" && editing && (
              <PlaylistForm
                initial={{
                  name: editing.name,
                  kind: editing.kind ?? "m3u",
                  url: editing.url,
                  epgUrl: editing.epgUrl ?? "",
                  xtream: editing.xtream ?? { server: "", username: "", password: "" },
                }}
                submitLabel={t("Save")}
                onCancel={() => {
                  setMode("list");
                  setEditingId(null);
                }}
                onSubmit={(v) => {
                  onEdit(editing.id, v);
                  setMode("list");
                  setEditingId(null);
                }}
              />
            )}
          </div>
        )}
      </div>
      <button
        onClick={onRefresh}
        disabled={loading || !activeId}
        title={ago ? t("Last updated {ago}", { ago }) : t("Refresh playlist")}
        className="flex h-11 w-11 items-center justify-center rounded-xl border border-edge-soft/55 bg-elevated text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-40"
      >
        <RefreshCw size={15} strokeWidth={2} className={loading ? "animate-spin" : ""} />
      </button>
    </div>
  );
}

function SourceRow({
  source,
  index,
  total,
  onMove,
  onMoveTop,
  isActive,
  isMenuOpen,
  copied,
  exportEnabled,
  onSelect,
  onToggleMenu,
  onCloseMenu,
  onEdit,
  onCopy,
  onExport,
  onDelete,
}: {
  source: IptvPlaylistSource;
  index: number;
  total: number;
  onMove?: (delta: number) => void;
  onMoveTop?: () => void;
  isActive: boolean;
  isMenuOpen: boolean;
  copied: boolean;
  exportEnabled: boolean;
  onSelect: () => void;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onExport: () => void;
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
          <span className={`h-2 w-2 shrink-0 rounded-full ${isActive ? "bg-danger" : "bg-ink-subtle/45"}`} />
          <span className="truncate">{source.name}</span>
        </button>
        {onMove && total > 1 && (
          <div className="flex shrink-0 flex-col opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove(-1);
              }}
              disabled={index === 0}
              aria-label={t("Move up")}
              className="flex h-4 w-6 items-center justify-center text-ink-subtle transition-colors hover:text-ink disabled:opacity-25"
            >
              <ChevronUp size={13} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove(1);
              }}
              disabled={index === total - 1}
              aria-label={t("Move down")}
              className="flex h-4 w-6 items-center justify-center text-ink-subtle transition-colors hover:text-ink disabled:opacity-25"
            >
              <ChevronDown size={13} strokeWidth={2.2} />
            </button>
          </div>
        )}
        <button
          ref={triggerRef}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMenu();
          }}
          aria-label={t("More for {name}", { name: source.name })}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-opacity ${
            isMenuOpen ? "text-ink" : "text-ink-subtle opacity-0 hover:text-ink group-hover:opacity-100"
          }`}
        >
          <MoreHorizontal size={15} strokeWidth={2} />
        </button>
      </div>
      {isMenuOpen && (
        <PortalMenu triggerRef={triggerRef} onClose={onCloseMenu}>
          {onMoveTop && index > 0 && (
            <MenuItem icon={<ArrowUpToLine size={14} strokeWidth={1.9} />} onClick={onMoveTop}>
              {t("Move to top")}
            </MenuItem>
          )}
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
          <MenuItem
            icon={<Download size={14} strokeWidth={1.9} />}
            onClick={onExport}
            disabled={!exportEnabled}
            hint={!isActive ? t("Switch to this playlist first") : undefined}
          >
            {t("Export as .m3u")}
          </MenuItem>
          <div className="my-0.5 mx-2 h-px bg-edge-soft/60" />
          <MenuItem icon={<Trash2 size={14} strokeWidth={1.9} />} onClick={onDelete} danger>
            {t("Delete")}
          </MenuItem>
          <div className="border-t border-edge-soft/40 px-3 py-2 text-[10.5px] uppercase tracking-[0.16em] text-ink-subtle">
            {source.epgUrl ? t("URL + EPG saved") : t("URL saved")}
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
      style={{
        left: pos?.left ?? -9999,
        top: pos?.top ?? -9999,
        opacity: pos ? 1 : 0,
      }}
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
  disabled,
  hint,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  accent?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const tone = danger
    ? "text-danger hover:bg-danger/10"
    : accent
      ? "text-accent"
      : "text-ink-muted hover:bg-raised hover:text-ink";
  return (
    <button
      type="button"
      disabled={disabled}
      title={hint}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 px-3 py-2 text-start text-[12.5px] font-medium transition-colors ${tone} disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ink-muted`}
    >
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      {children}
    </button>
  );
}

function formatAgo(ms: number, t: (key: string, vars?: Record<string, string | number>) => string): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return t("just now");
  const m = Math.floor(s / 60);
  if (m < 60) return t("{m}m ago", { m });
  const h = Math.floor(m / 60);
  if (h < 24) return t("{h}h ago", { h });
  return t("{d}d ago", { d: Math.floor(h / 24) });
}
