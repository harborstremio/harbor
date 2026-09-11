import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { deleteList, renameList, updateListDescription, type CustomList } from "@/lib/custom-lists";
import { useT } from "@/lib/i18n";
import { unfeatureListByName } from "@/lib/social/featured-lists";
import { AnchoredMenu } from "@/components/anchored-menu";
import { emitListToast } from "@/components/lists/list-toast";

export function ListSettingsMenu({ list, onDeleted }: { list: CustomList; onDeleted: () => void }) {
  const t = useT();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        aria-label={t("List settings")}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-edge bg-canvas/80 text-ink transition-colors hover:border-ink-subtle hover:bg-canvas/95"
      >
        <MoreHorizontal size={18} strokeWidth={2} />
      </button>

      <AnchoredMenu anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} width={200}>
        <div className="animate-popover-in overflow-hidden rounded-xl border border-edge-soft bg-elevated p-1 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.6)]">
          <MenuItem
            icon={<Pencil size={14} strokeWidth={2} />}
            label={t("Rename list")}
            onClick={() => {
              setOpen(false);
              setRenaming(true);
            }}
          />
          <MenuItem
            icon={<Trash2 size={14} strokeWidth={2} />}
            label={t("Delete list")}
            danger
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
          />
        </div>
      </AnchoredMenu>

      {renaming && (
        <RenameModal
          initial={list.name}
          initialDescription={list.description ?? ""}
          onClose={() => setRenaming(false)}
          onSubmit={(name, description) => {
            renameList(list.id, name);
            updateListDescription(list.id, description);
            emitListToast(t("List renamed"));
            setRenaming(false);
          }}
        />
      )}

      {confirming && (
        <ConfirmDelete
          name={list.name}
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            deleteList(list.id);
            void unfeatureListByName(list.name);
            emitListToast(t('Deleted "{name}"', { name: list.name }));
            setConfirming(false);
            onDeleted();
          }}
        />
      )}
    </>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-start text-[13px] transition-colors hover:bg-raised ${
        danger ? "text-danger" : "text-ink"
      }`}
    >
      <span className={danger ? "text-danger" : "text-ink-muted"}>{icon}</span>
      {label}
    </button>
  );
}

function RenameModal({
  initial,
  initialDescription,
  onClose,
  onSubmit,
}: {
  initial: string;
  initialDescription: string;
  onClose: () => void;
  onSubmit: (name: string, description: string) => void;
}) {
  const t = useT();
  const [name, setName] = useState(initial);
  const [description, setDescription] = useState(initialDescription);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, description);
  };

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[230] flex items-center justify-center bg-canvas/80"
      onClick={onClose}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="animate-modal-in flex w-[min(92vw,380px)] flex-col gap-5 rounded-2xl border border-edge-soft bg-elevated p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <h2 className="font-display text-[22px] font-medium tracking-tight text-ink">
          {t("Rename list")}
        </h2>
        <input
          value={name}
          autoFocus
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          spellCheck={false}
          className="h-11 w-full rounded-xl border border-edge bg-canvas px-3.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-ink"
        />
        <textarea
          value={description}
          maxLength={240}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t("A short note about this list")}
          rows={3}
          className="w-full resize-none rounded-xl border border-edge bg-canvas px-3.5 py-2.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-ink"
        />
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center rounded-xl px-4 text-[13px] font-medium text-ink-subtle transition-colors hover:text-ink"
          >
            {t("Cancel")}
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="flex h-11 items-center rounded-xl border border-edge bg-raised px-5 text-[14px] font-semibold text-ink transition-colors hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("Save")}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

function ConfirmDelete({
  name,
  onClose,
  onConfirm,
}: {
  name: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[230] flex items-center justify-center bg-canvas/80"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in flex w-[min(92vw,380px)] flex-col gap-4 rounded-2xl border border-edge-soft bg-elevated p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-[22px] font-medium tracking-tight text-ink">
            {t("Delete this list?")}
          </h2>
          <p className="text-[13px] leading-snug text-ink-muted">
            {t('"{name}" and everything in it will be removed. This cannot be undone.', { name })}
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 items-center rounded-xl px-4 text-[13px] font-medium text-ink-subtle transition-colors hover:text-ink"
          >
            {t("Keep it")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex h-11 items-center rounded-xl border border-danger/45 bg-danger/15 px-5 text-[14px] font-semibold text-danger transition-colors hover:bg-danger/22"
          >
            {t("Delete")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
