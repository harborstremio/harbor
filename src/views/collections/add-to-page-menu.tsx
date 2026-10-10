import { Check, LayoutGrid } from "lucide-react";
import { type RefObject } from "react";
import { useT } from "@/lib/i18n";
import { AnchoredMenu } from "@/components/anchored-menu";
import { emitListToast } from "@/components/lists/list-toast";
import {
  COLLECTION_ROW_PAGES,
  addCollectionToPage,
  collectionPageCap,
  removeCollectionFromPage,
  usePagesForCollection,
  type CollectionRowPage,
} from "@/lib/page-collection-rows";

export function AddToPageMenu({
  collectionId,
  anchorRef,
  open,
  onClose,
}: {
  collectionId: string;
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
}) {
  const t = useT();
  const pages = usePagesForCollection(collectionId);

  const toggle = (page: CollectionRowPage, label: string) => {
    if (pages.has(page)) {
      removeCollectionFromPage(page, collectionId);
      emitListToast(t("Removed from {page}", { page: t(label) }));
    } else {
      if (collectionPageCap(page)) {
        emitListToast(t("That page is full"));
        return;
      }
      addCollectionToPage(page, collectionId);
      emitListToast(t("Added to {page}", { page: t(label) }));
    }
  };

  return (
    <AnchoredMenu anchorRef={anchorRef} open={open} onClose={onClose} width={272}>
      <div className="animate-popover-in overflow-hidden rounded-2xl border border-edge-soft bg-elevated shadow-[0_18px_50px_-15px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-2 border-b border-edge-soft/55 px-3.5 pt-3 pb-2.5">
          <LayoutGrid size={14} strokeWidth={2} className="text-ink-subtle" />
          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-subtle">
            {t("Show as a row on")}
          </span>
        </div>
        <div className="py-1.5">
          {COLLECTION_ROW_PAGES.map(({ id, label }) => {
            const on = pages.has(id);
            return (
              <button
                key={id}
                type="button"
                onClick={() => toggle(id, label)}
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-start text-[13.5px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    on ? "border-accent bg-accent/15 text-accent" : "border-edge"
                  }`}
                >
                  {on && <Check size={13} strokeWidth={2.6} />}
                </span>
                <span className="flex-1 truncate">{t(label)}</span>
              </button>
            );
          })}
        </div>
        <p className="border-t border-edge-soft/55 px-3.5 py-2.5 text-[11.5px] leading-snug text-ink-subtle">
          {t("The collection shows up as its own row you can reorder or hide from that page.")}
        </p>
      </div>
    </AnchoredMenu>
  );
}
