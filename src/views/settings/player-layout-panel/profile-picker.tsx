import {
  Check,
  ChevronDown,
  Download,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Upload,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import type { LayoutProfile } from "@/lib/player-chrome-profiles";

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
  const label = active?.name ?? "No profile";

  const handleImport = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onImport(reader.result);
    };
    reader.onerror = () => window.alert("Could not read the file.");
    reader.readAsText(file);
  };

  const askSaveAsNew = () => {
    setOpen(false);
    setDialog({
      kind: "input",
      title: "Save layout profile",
      placeholder: "Profile name",
      initial: "",
      confirmLabel: "Save",
      onConfirm: (name) => onSaveAsNew(name),
    });
  };

  const askRename = () => {
    if (!active) return;
    setOpen(false);
    setDialog({
      kind: "input",
      title: "Rename profile",
      placeholder: "Profile name",
      initial: active.name,
      confirmLabel: "Rename",
      onConfirm: (name) => onRename(name),
    });
  };

  const askDelete = () => {
    if (!active) return;
    setOpen(false);
    setDialog({
      kind: "confirm",
      title: "Delete profile",
      message: `Delete "${active.name}"? This can't be undone.`,
      confirmLabel: "Delete",
      danger: true,
      onConfirm: onDelete,
    });
  };

  const askReset = () => {
    setOpen(false);
    setDialog({
      kind: "confirm",
      title: "Reset to defaults",
      message: "Reset this profile to factory defaults? Your tweaks on it will be lost.",
      confirmLabel: "Reset",
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
        <div className="absolute end-0 top-[calc(100%+8px)] z-40 w-[280px] overflow-hidden rounded-2xl border border-white/12 bg-black/95 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
          <div className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
            Profiles
          </div>
          <ul className="max-h-[280px] overflow-y-auto px-1.5">
            {profiles.length === 0 ? (
              <li className="px-3 py-2 text-[12px] text-white/50">No saved profiles yet.</li>
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
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-[13px] transition-colors ${
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
              label="Save as new profile..."
              onClick={askSaveAsNew}
            />
            <MenuItem
              icon={<Pencil size={13} strokeWidth={2.3} />}
              label="Rename current"
              disabled={!active}
              onClick={askRename}
            />
            <MenuItem
              icon={<Trash2 size={13} strokeWidth={2.3} />}
              label="Delete current"
              disabled={!active}
              danger
              onClick={askDelete}
            />
          </div>

          <div className="my-1 h-px bg-white/8" />

          <div className="px-1.5 pb-2 pt-1">
            <MenuItem
              icon={<Download size={13} strokeWidth={2.3} />}
              label="Export as file"
              disabled={!active}
              onClick={() => {
                onExport();
                setOpen(false);
              }}
            />
            <MenuItem
              icon={<Upload size={13} strokeWidth={2.3} />}
              label="Import from file..."
              onClick={() => {
                fileRef.current?.click();
                setOpen(false);
              }}
            />
            <MenuItem
              icon={<RotateCcw size={13} strokeWidth={2.3} />}
              label="Reset to defaults"
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
      className="harbor-layout-dialog fixed inset-0 z-[400] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm rounded-2xl border border-white/12 bg-[#16161c] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.65)]"
      >
        <h2 className="text-[16px] font-semibold tracking-tight text-white">{dialog.title}</h2>
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
            className="mt-4 h-11 w-full rounded-xl border border-white/15 bg-white/5 px-3.5 text-[14px] text-white placeholder:text-white/35 transition-colors focus:border-white/40 focus:outline-none"
          />
        ) : (
          <p className="mt-2.5 text-[13.5px] leading-relaxed text-white/65">{dialog.message}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-full px-4 text-[13px] font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!canConfirm}
            className={`h-10 rounded-full px-5 text-[13px] font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 ${
              dialog.kind === "confirm" && dialog.danger
                ? "bg-red-500 text-white"
                : "bg-white text-black"
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
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-[12.5px] transition-colors ${
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
