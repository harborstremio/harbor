import { AnchoredMenu } from "@/components/anchored-menu";
import { addToList, toggleInList, useCustomLists, useListsContaining, type ListItemInput } from "@/lib/custom-lists";
import { useT } from "@/lib/i18n";
import { Check, Plus } from "lucide-react";
import { useState, type RefObject } from "react";

import { CreateListModal } from "./create-list-modal";
import { emitListToast } from "./list-toast";

export function AddToListMenu({
  item,
  anchorRef,
  open,
  onClose,
}: {
  item: ListItemInput;
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const lists = useCustomLists();
  const containing = useListsContaining(item.id);
  const [creating, setCreating] = useState(false);

  const toggle = (listId: string, name: string) => {
    const nowIn = toggleInList(listId, item);
    emitListToast(nowIn ? t('Added to "{name}"', { name }) : t('Removed from "{name}"', { name }));
  };

  return (
    <>
      <AnchoredMenu anchorRef={anchorRef} open={open && !creating} onClose={onClose} width={280}>
        <div className="animate-popover-in overflow-hidden rounded-2xl border border-edge-soft bg-elevated shadow-[0_18px_50px_-15px_rgba(0,0,0,0.6)]">
          <div className="border-b border-edge-soft/55 px-3.5 pt-3 pb-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
              {t("Add to list")}
            </span>
          </div>
          <div className="max-h-[264px] overflow-y-auto py-1.5">
            {lists.length === 0 && (
              <p className="px-3.5 py-3 text-[12.5px] leading-snug text-ink-subtle">
                {t("No lists yet. Create your first one below.")}
              </p>
            )}
            {lists.map((l) => {
              const inList = containing.has(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => toggle(l.id, l.name)}
                  className="flex w-full items-center gap-3 px-3.5 py-2.5 text-start text-[13.5px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                      inList ? "border-accent bg-accent/15 text-accent" : "border-edge"
                    }`}
                  >
                    {inList && <Check size={13} strokeWidth={2.6} />}
                  </span>
                  <span className="flex-1 truncate">{l.name}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-subtle">{l.items.length}</span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-edge-soft/55 p-1.5">
            <button
              onClick={() => setCreating(true)}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-start text-[13px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <span className="flex h-5 w-5 items-center justify-center">
                <Plus size={15} strokeWidth={2} />
              </span>
              {t("Create new list")}
            </button>
          </div>
        </div>
      </AnchoredMenu>

      {creating && (
        <CreateListModal
          onClose={() => {
            setCreating(false);
            onClose();
          }}
          onCreated={(id) => {
            addToList(id, item);
          }}
        />
      )}
    </>
  );
}
