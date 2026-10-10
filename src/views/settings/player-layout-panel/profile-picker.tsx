import {
  Check,
  ChevronDown,
  Download,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
  X,
} from "../icons";
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import type { LayoutProfile } from "@/lib/player-chrome-profiles";
import { advanceFocus, captureFocusReturn, tvFocus } from "@/lib/keyboard-navigation";
import { getDirection, isBackKey, navOwnsFocus } from "@/lib/keyboard-navigation/geometry";
import { useT } from "@/lib/i18n";
import { ROW_ACTION, ROW_ACTION_DANGER, ROW_ACTION_PRIMARY, ROW_DESC } from "../kit";

const OVERLAY_LABEL =
  "text-[13px] font-extrabold uppercase leading-[17px] tracking-[0.72px]";
const MENU_ITEM =
  "flex min-h-11 w-full items-center gap-2.5 rounded-md px-3 py-2 text-start text-[15.5px] leading-[22px] transition-colors";

type Dialog =
  | {
      kind: "input";
      title: string;
      placeholder: string;
      initial: string;
      confirmLabel: string;
      onConfirm: (value: string) => void;
    }
  | {
      kind: "confirm";
      title: string;
      message: string;
      confirmLabel: string;
      danger?: boolean;
      onConfirm: () => void;
    };

type Props = {
  profiles: LayoutProfile[];
  activeProfileId: string | null;
  onSwitch: (id: string) => void;
  onSaveAsNew: (name: string) => void;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onExport: () => void;
  onImport: (text: string) => void;
  onResetToDefaults: () => void;
};

export function ProfilePicker({
  profiles,
  activeProfileId,
  onSwitch,
  onSaveAsNew,
  onRename,
  onDelete,
  onExport,
  onImport,
  onResetToDefaults,
}: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pos, setPos] = useState<{ top: number; end: number; maxH: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const rtl = getComputedStyle(btn).direction === "rtl";
      const end = rtl ? r.left : window.innerWidth - r.right;
      const gap = 8;
      const pad = 12;
      const below = window.innerHeight - r.bottom - gap - pad;
      const above = r.top - gap - pad;
      const h = menuRef.current?.offsetHeight ?? 0;
      const flip = h > below && above > below;
      const maxH = Math.max(180, flip ? above : below);
      const top = flip ? Math.max(pad, r.top - gap - Math.min(h || maxH, maxH)) : r.bottom + gap;
      setPos({ top, end, maxH });
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  const menuItems = () =>
    Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? []);
  const holdsFocus = () => !!menuRef.current?.contains(document.activeElement);
  const close = (restore: boolean) => {
    setOpen(false);
    const trigger = btnRef.current;
    if (restore && trigger) advanceFocus(trigger);
  };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      close(holdsFocus());
    };
    const onKey = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      close(true);
    };
    window.addEventListener("pointerdown", onDoc);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  const placed = pos != null;
  const entered = useRef(false);
  useEffect(() => {
    if (!open) {
      entered.current = false;
      return;
    }
    if (!placed || entered.current) return;
    entered.current = true;
    const items = menuItems();
    const at = profiles.findIndex((p) => p.id === activeProfileId);
    const el = items[at < 0 ? 0 : at];
    if (el) advanceFocus(el);
  }, [open, placed, profiles, activeProfileId]);

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir = getDirection(e.nativeEvent);
    const items = menuItems();
    const edge = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : null;
    if (edge === null && dir !== "up" && dir !== "down") return;
    e.preventDefault();
    const from = items.indexOf(e.target as HTMLButtonElement);
    if (from < 0) return;
    const at = edge ?? from + (dir === "down" ? 1 : -1);
    const el = items[at];
    if (!el || at === from) return;
    advanceFocus(el, at > from ? "down" : "up");
  };

  const active = profiles.find((p) => p.id === activeProfileId) ?? null;
  const label = active?.name ?? t("No profile");

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onImport(reader.result);
    };
    reader.onerror = () => window.alert(t("Could not read the file."));
    reader.readAsText(file);
  };

  const askSaveAsNew = () => {
    close(true);
    setDialog({
      kind: "input",
      title: t("Save layout profile"),
      placeholder: t("Profile name"),
      initial: "",
      confirmLabel: t("Save"),
      onConfirm: (name) => onSaveAsNew(name),
    });
  };

  const askRename = () => {
    if (!active) return;
    close(true);
    setDialog({
      kind: "input",
      title: t("Rename profile"),
      placeholder: t("Profile name"),
      initial: active.name,
      confirmLabel: t("Rename"),
      onConfirm: (name) => onRename(name),
    });
  };

  const askDelete = () => {
    if (!active) return;
    close(true);
    setDialog({
      kind: "confirm",
      title: t("Delete profile"),
      message: t('Delete "{name}"? This can\'t be undone.', { name: active.name }),
      confirmLabel: t("Delete"),
      danger: true,
      onConfirm: onDelete,
    });
  };

  const askReset = () => {
    close(true);
    setDialog({
      kind: "confirm",
      title: t("Reset to defaults"),
      message: t("Reset this profile to factory defaults? Your tweaks on it will be lost."),
      confirmLabel: t("Reset"),
      onConfirm: onResetToDefaults,
    });
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={handleImport}
        className="hidden"
      />
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-11 max-w-[240px] items-center gap-2 rounded-full border border-white/15 bg-white/8 ps-4 pe-3 text-[15px] font-medium text-white/90 transition-colors hover:bg-white/15 hover:text-white"
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          size={17}
          strokeWidth={2.3}
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            onKeyDown={onMenuKeyDown}
            style={{
              position: "fixed",
              top: pos?.top ?? -9999,
              insetInlineEnd: pos?.end ?? 0,
              maxBlockSize: pos?.maxH,
              visibility: pos ? "visible" : "hidden",
            }}
            className="z-[350] flex w-[320px] flex-col overflow-hidden rounded-md border border-white/12 bg-black/95 harbor-float backdrop-blur-2xl"
          >
            <div className={`px-4 pt-3.5 pb-1.5 ${OVERLAY_LABEL} text-white/60`}>
              {t("Profiles")}
            </div>
            <ul className="min-h-0 flex-1 overflow-y-auto px-1.5">
              {profiles.length === 0 ? (
                <li className="px-3 py-2 text-[15.5px] leading-[22px] text-white/60">
                  {t("No saved profiles yet.")}
                </li>
              ) : (
                profiles.map((p) => {
                  const isActive = p.id === activeProfileId;
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onSwitch(p.id);
                          close(true);
                        }}
                        className={`${MENU_ITEM} ${
                          isActive
                            ? "bg-white/10 text-white"
                            : "text-white/80 hover:bg-white/8 hover:text-white"
                        }`}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                          {isActive && <Check size={18} strokeWidth={2.4} />}
                        </span>
                        <span className="truncate">{p.name}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="my-1 h-px shrink-0 bg-white/8" />

            <div className="shrink-0 px-1.5 py-1">
              <MenuItem
                icon={<Plus size={18} strokeWidth={2.3} />}
                label={t("Save as new profile...")}
                onClick={askSaveAsNew}
              />
              <MenuItem
                icon={<Pencil size={18} strokeWidth={2.3} />}
                label={t("Rename current")}
                disabled={!active}
                onClick={askRename}
              />
              <MenuItem
                icon={<Trash2 size={18} strokeWidth={2.3} />}
                label={t("Delete current")}
                disabled={!active}
                danger
                onClick={askDelete}
              />
            </div>

            <div className="my-1 h-px shrink-0 bg-white/8" />

            <div className="shrink-0 px-1.5 pb-2 pt-1">
              <MenuItem
                icon={<Download size={18} strokeWidth={2.3} />}
                label={t("Export as file")}
                disabled={!active}
                onClick={() => {
                  onExport();
                  close(true);
                }}
              />
              <MenuItem
                icon={<Upload size={18} strokeWidth={2.3} />}
                label={t("Import from file...")}
                onClick={() => {
                  fileRef.current?.click();
                  close(true);
                }}
              />
              <MenuItem
                icon={<RotateCcw size={18} strokeWidth={2.3} />}
                label={t("Reset to defaults")}
                onClick={askReset}
              />
            </div>
          </div>,
          document.body,
        )}

      {dialog && <LayoutDialog dialog={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function LayoutDialog({ dialog, onClose }: { dialog: Dialog; onClose: () => void }) {
  const t = useT();
  const [value, setValue] = useState(dialog.kind === "input" ? dialog.initial : "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => captureFocusReturn(), []);

  useEffect(() => {
    if (dialog.kind !== "input") return;
    const el = inputRef.current;
    if (!el) return;
    const opener = document.activeElement;
    if (opener instanceof HTMLElement && navOwnsFocus(opener)) {
      tvFocus(el);
      return;
    }
    el.focus();
    el.select();
  }, [dialog]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isBackKey(e)) return;
      if (inputRef.current?.hasAttribute("data-search-editing")) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const canConfirm = dialog.kind !== "input" || value.trim().length > 0;

  const confirm = () => {
    if (!canConfirm) return;
    if (dialog.kind === "input") dialog.onConfirm(value.trim());
    else dialog.onConfirm();
    onClose();
  };

  return createPortal(
    <div
      className="harbor-layout-dialog animate-scrim-in fixed inset-0 z-[400] grid place-items-center p-8"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="animate-dialog-in flex max-h-[86vh] w-[min(640px,100%)] flex-col overflow-hidden rounded-md bg-surface"
      >
        <div className="flex items-start gap-4 px-6 pt-6">
          <h2 className="min-w-0 flex-1 text-[17px] font-semibold tracking-tight text-ink">
            {dialog.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("Close")}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-6">
          {dialog.kind === "input" ? (
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                const el = e.currentTarget;
                if (el.hasAttribute("data-tv-focused") && !el.hasAttribute("data-search-editing"))
                  return;
                e.preventDefault();
                confirm();
              }}
              placeholder={dialog.placeholder}
              className="h-11 w-full rounded-md bg-canvas px-3.5 text-[16.5px] text-ink outline-none transition-colors placeholder:text-ink-subtle focus:bg-elevated"
            />
          ) : (
            <p className={`max-w-[70ch] ${ROW_DESC}`}>{dialog.message}</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className={ROW_ACTION}
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className={
              dialog.kind === "confirm" && dialog.danger ? ROW_ACTION_DANGER : ROW_ACTION_PRIMARY
            }
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${MENU_ITEM} ${
        disabled
          ? "cursor-not-allowed text-white/30"
          : danger
            ? "text-danger hover:bg-danger/15"
            : "text-white/80 hover:bg-white/8 hover:text-white"
      }`}
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">{icon}</span>
      {label}
    </button>
  );
}
