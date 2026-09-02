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
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import type { LayoutProfile } from "@/lib/player-chrome-profiles";
import { useT } from "@/lib/i18n";

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
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
    setOpen(false);
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
    setOpen(false);
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
    setOpen(false);
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
    setOpen(false);
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
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-11 max-w-[200px] items-center gap-2 rounded-full border border-white/15 bg-white/8 ps-4 pe-3 text-[13px] font-medium text-white/90 transition-colors hover:bg-white/15 hover:text-white"
      >
        <span className="truncate">{label}</span>
        <ChevronDown
          size={14}
          strokeWidth={2.3}
          className={open ? "rotate-180 transition-transform" : "transition-transform"}
        />
      </button>

      {open && (
        <div className="absolute end-0 top-[calc(100%+8px)] z-40 w-[280px] overflow-hidden rounded-md border border-white/12 bg-black/95 harbor-float backdrop-blur-2xl">
          <div className="px-4 pt-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/45">
            {t("Profiles")}
          </div>
          <ul className="max-h-[280px] overflow-y-auto px-1.5">
            {profiles.length === 0 ? (
              <li className="px-3 py-2 text-[12.5px] text-white/50">
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
                        setOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-start text-[13px] transition-colors ${
                        isActive
                          ? "bg-white/10 text-white"
                          : "text-white/80 hover:bg-white/8 hover:text-white"
                      }`}
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                        {isActive && <Check size={14} strokeWidth={2.4} />}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <div className="my-1 h-px bg-white/8" />

          <div className="px-1.5 py-1">
            <MenuItem
              icon={<Plus size={14} strokeWidth={2.3} />}
              label={t("Save as new profile...")}
              onClick={askSaveAsNew}
            />
            <MenuItem
              icon={<Pencil size={14} strokeWidth={2.3} />}
              label={t("Rename current")}
              disabled={!active}
              onClick={askRename}
            />
            <MenuItem
              icon={<Trash2 size={14} strokeWidth={2.3} />}
              label={t("Delete current")}
              disabled={!active}
              danger
              onClick={askDelete}
            />
          </div>

          <div className="my-1 h-px bg-white/8" />

          <div className="px-1.5 pb-2 pt-1">
            <MenuItem
              icon={<Download size={14} strokeWidth={2.3} />}
              label={t("Export as file")}
              disabled={!active}
              onClick={() => {
                onExport();
                setOpen(false);
              }}
            />
            <MenuItem
              icon={<Upload size={14} strokeWidth={2.3} />}
              label={t("Import from file...")}
              onClick={() => {
                fileRef.current?.click();
                setOpen(false);
              }}
            />
            <MenuItem
              icon={<RotateCcw size={14} strokeWidth={2.3} />}
              label={t("Reset to defaults")}
              onClick={askReset}
            />
          </div>
        </div>
      )}

      {dialog && <LayoutDialog dialog={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}

function LayoutDialog({ dialog, onClose }: { dialog: Dialog; onClose: () => void }) {
  const t = useT();
  const [value, setValue] = useState(dialog.kind === "input" ? dialog.initial : "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (dialog.kind !== "input") return;
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    el.select();
  }, [dialog]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
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
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-subtle transition-colors hover:bg-elevated hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-6">
          {dialog.kind === "input" ? (
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirm();
                }
              }}
              placeholder={dialog.placeholder}
              className="h-11 w-full rounded-md bg-canvas px-3.5 text-[13px] text-ink outline-none transition-colors placeholder:text-ink-subtle focus:bg-elevated"
            />
          ) : (
            <p className="text-[12.5px] leading-relaxed text-ink-muted">{dialog.message}</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 pb-6">
          <button
            type="button"
            onClick={onClose}
            className="harbor-press-pop h-9 rounded-md bg-elevated px-4 text-[12.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className={`harbor-press-pop h-9 rounded-md px-4 text-[12.5px] font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
              dialog.kind === "confirm" && dialog.danger
                ? "bg-danger text-white"
                : "bg-ink text-canvas"
            }`}
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
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-start text-[12.5px] transition-colors ${
        disabled
          ? "cursor-not-allowed text-white/25"
          : danger
            ? "text-red-300 hover:bg-red-500/15"
            : "text-white/80 hover:bg-white/8 hover:text-white"
      }`}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span>
      {label}
    </button>
  );
}
