import { Check, Plus } from "lucide-react";
import { ShowcaseIcon } from "@/components/icons/harbor-glyphs";
import { useState, type RefObject } from "react";
import {
  addToList,
  toggleInList,
  useCustomLists,
  useListsContaining,
  type ListItemInput,
} from "@/lib/custom-lists";
import { useT } from "@/lib/i18n";
import { AnchoredMenu } from "@/components/anchored-menu";
import { clearShowcase, setShowcase, useShowcaseMetaId } from "@/lib/social/showcase";
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
  const [busy, setBusy] = useState(false);
  const showcaseMetaId = useShowcaseMetaId();
  const isShowcase = showcaseMetaId === item.id;

  const toggle = (listId: string, name: string) => {
    const nowIn = toggleInList(listId, item);
    emitListToast(
      nowIn ? t('Added to "{name}"', { name }) : t('Removed from "{name}"', { name }),
    );
  };

  const toggleShowcase = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (isShowcase) {
        await clearShowcase();
        emitListToast(t("Removed from showcase"));
      } else {
        await setShowcase({
          metaId: item.id,
          title: item.name ?? item.id,
          posterUrl: item.poster,
          kind: "pinned",
        });
        emitListToast(t("Set as your showcase"));
      }
      onClose();
    } catch {
      emitListToast(t("Could not update showcase"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AnchoredMenu anchorRef={anchorRef} open={open && !creating} onClose={onClose} width={280}>
        <div className="animate-menu-pop overflow-hidden rounded-md bg-elevated shadow-[0_18px_44px_-18px_rgba(0,0,0,0.85)]">
          <div className="px-3 pt-2.5 pb-1.5">
            <span className="text-[10.5px] font-medium uppercase tracking-wider text-ink-subtle">
              {t("Add to list")}
            </span>
          </div>
          <div className="max-h-[264px] overflow-y-auto">
            {lists.length === 0 && (
              <p className="px-3 pb-2.5 text-[12.5px] leading-snug text-ink-subtle">
                {t("No lists yet. Create your first one below.")}
              </p>
            )}
            {lists.map((l) => {
              const inList = containing.has(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => toggle(l.id, l.name)}
                  className="flex min-h-[44px] w-full items-center gap-2.5 px-3 py-2 text-start text-[13px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
                >
                  <span
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] transition-colors ${
                      inList
                        ? "bg-accent text-canvas"
                        : "bg-canvas ring-1 ring-inset ring-edge-soft"
                    }`}
                  >
                    {inList && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="flex-1 truncate">{l.name}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-subtle">
                    {l.items.length}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-edge-soft">
            <button
              onClick={toggleShowcase}
              disabled={busy}
              className="flex min-h-[44px] w-full items-center gap-2.5 px-3 py-2 text-start text-[13px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink disabled:opacity-60"
            >
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                <ShowcaseIcon size={16} className={isShowcase ? "text-accent" : undefined} />
              </span>
              {isShowcase ? t("Remove from showcase") : t("Set as showcase")}
            </button>
            <button
              onClick={() => setCreating(true)}
              className="flex min-h-[44px] w-full items-center gap-2.5 px-3 py-2 text-start text-[13px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                <Plus size={16} strokeWidth={2.4} />
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
