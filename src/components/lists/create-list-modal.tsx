import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createList, MAX_LISTS, useCustomLists } from "@/lib/custom-lists";
import { useT } from "@/lib/i18n";
import { emitListToast } from "./list-toast";

export function CreateListModal({
  onClose,
  onCreated,
  contextLayer = false,
  create = createList,
  error,
}: {
  onClose: () => void;
  onCreated?: (id: string) => void;
  contextLayer?: boolean;
  create?: (name: string) => string | null;
  error?: string;
}) {
  const t = useT();
  const lists = useCustomLists();
  const [name, setName] = useState("");
  const atMax = lists.length >= MAX_LISTS;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || atMax) return;
    const id = create(trimmed);
    if (!id) return;
    emitListToast(t('Created "{name}"', { name: trimmed }));
    onCreated?.(id);
    onClose();
  };

  return createPortal(
    <div
      data-harbor-context-layer={contextLayer || undefined}
      data-context-submenu={contextLayer || undefined}
      data-harbor-menu-panel={contextLayer || undefined}
      style={contextLayer ? { zIndex: 2147482002 } : undefined}
      className="animate-fade-in fixed inset-0 z-[230] flex items-center justify-center bg-canvas/80"
      onClick={onClose}
      onKeyDown={(event) => {
        if (contextLayer && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={t("New list")}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(event) => {
          if (!contextLayer || event.key !== "Tab") return;
          const controls = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(
              "input:not(:disabled),button:not(:disabled)",
            ),
          );
          const first = controls[0];
          const last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onSubmit={submit}
        className="animate-modal-in flex w-[min(92vw,380px)] flex-col gap-5 rounded-2xl border border-edge-soft bg-elevated p-7 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <div className="flex flex-col gap-1.5">
          <h2 className="font-display text-[22px] font-medium tracking-tight text-ink">
            {t("New list")}
          </h2>
          <p className="text-[13px] leading-snug text-ink-muted">
            {t("Group the movies and shows you want to keep close.")}
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
            {t("List name")}
          </span>
          <input
            value={name}
            autoFocus
            maxLength={60}
            disabled={atMax}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("Weekend watchlist")}
            spellCheck={false}
            className="h-11 w-full rounded-xl border border-edge bg-canvas px-3.5 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-subtle focus:border-ink disabled:opacity-50"
          />
        </label>

        {error && (
          <p role="alert" className="text-[12.5px] text-danger">
            {error}
          </p>
        )}
        {atMax && (
          <p className="rounded-lg bg-danger/12 px-3 py-2 text-[12.5px] text-danger">
            {t("You have reached {max} lists. Remove one to make room.", { max: MAX_LISTS })}
          </p>
        )}

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
            disabled={!name.trim() || atMax}
            className="flex h-11 items-center rounded-xl border border-edge bg-raised px-5 text-[14px] font-semibold text-ink transition-colors hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("Create")}
          </button>
        </div>
      </form>
    </div>,
    contextLayer ? (document.fullscreenElement ?? document.body) : document.body,
  );
}
