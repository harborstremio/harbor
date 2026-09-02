import { Check, ChevronRight, ListPlus, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  addToList,
  toggleInList,
  useCustomLists,
  useListsContaining,
  type ListItemInput,
} from "@/lib/custom-lists";
import { useInLocalWatchlist, useLocalWatchlist } from "@/lib/local-watchlist";
import { useT } from "@/lib/i18n";
import { emitListToast } from "@/components/lists/list-toast";
import { CreateListModal } from "@/components/lists/create-list-modal";

const FLYOUT_WIDTH = 244;
const FLYOUT_HEIGHT_ESTIMATE = 320;

export function MyListSubmenu({ item, onClose }: { item: ListItemInput; onClose: () => void }) {
  const t = useT();
  const lists = useCustomLists();
  const containing = useListsContaining(item.id);
  const local = useLocalWatchlist();
  const inDefault = useInLocalWatchlist(item.id);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const rowRef = useRef<HTMLButtonElement>(null);
  const timer = useRef(0);

  const anyIn = inDefault || containing.size > 0;

  const show = () => {
    window.clearTimeout(timer.current);
    const rect = rowRef.current?.getBoundingClientRect();
    if (rect) {
      const openLeft = rect.right + FLYOUT_WIDTH + 12 > window.innerWidth;
      const openUp = rect.top + FLYOUT_HEIGHT_ESTIMATE > window.innerHeight;
      setPos({
        left: openLeft ? Math.max(8, rect.left - FLYOUT_WIDTH - 4) : rect.right + 4,
        top: openUp ? Math.max(8, rect.bottom - FLYOUT_HEIGHT_ESTIMATE) : rect.top,
      });
    }
    setOpen(true);
  };
  const hide = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 180);
  };

  const toggleDefault = () => {
    local.toggle({
      id: item.id,
      type: item.type,
      name: item.name,
      poster: item.poster,
      addonOrigin: item.addonOrigin,
      videos: item.videos,
    });
    emitListToast(inDefault ? t("Removed from My List") : t("Added to My List"));
  };
  const toggleCustom = (listId: string, name: string) => {
    const nowIn = toggleInList(listId, item);
    emitListToast(nowIn ? t('Added to "{name}"', { name }) : t('Removed from "{name}"', { name }));
  };

  return (
    <div className="relative" onMouseEnter={show} onMouseLeave={hide}>
      <button
        ref={rowRef}
        role="menuitem"
        onClick={show}
        className={`flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-start text-[13px] transition-colors hover:bg-raised ${
          anyIn ? "text-accent" : "text-ink"
        }`}
      >
        <span className={anyIn ? "text-accent" : "text-ink-muted"}>
          <ListPlus size={14} strokeWidth={2} />
        </span>
        {t("Add to my list")}
        <ChevronRight size={14} strokeWidth={2.2} className="dir-icon ms-auto text-ink-subtle" />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            onMouseEnter={show}
            onMouseLeave={hide}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: FLYOUT_WIDTH }}
            className="z-[146] overflow-hidden rounded-xl border border-edge bg-elevated p-1 shadow-[0_18px_50px_-15px_rgba(0,0,0,0.7)] animate-popover-in"
          >
            <div className="max-h-[248px] overflow-y-auto">
              <ListRow
                label={t("My List")}
                checked={inDefault}
                count={local.count}
                onClick={toggleDefault}
              />
              {lists.map((l) => (
                <ListRow
                  key={l.id}
                  label={l.name}
                  checked={containing.has(l.id)}
                  count={l.items.length}
                  onClick={() => toggleCustom(l.id, l.name)}
                />
              ))}
            </div>
            <span aria-hidden className="my-1 block h-px bg-edge-soft/60" />
            <button
              onClick={() => setCreating(true)}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-3 text-start text-[13px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <Plus size={14} strokeWidth={2} /> {t("Create new list")}
            </button>
          </div>,
          document.body,
        )}

      {creating && (
        <CreateListModal
          onClose={() => {
            setCreating(false);
            onClose();
          }}
          onCreated={(id) => {
            addToList(id, item);
            emitListToast(t("Added to new list"));
          }}
        />
      )}
    </div>
  );
}

function ListRow({
  label,
  checked,
  count,
  onClick,
}: {
  label: string;
  checked: boolean;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
    >
      <span
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors ${
          checked ? "border-accent bg-accent/15 text-accent" : "border-edge"
        }`}
      >
        {checked && <Check size={12} strokeWidth={2.6} />}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[11px] tabular-nums text-ink-subtle">{count}</span>
    </button>
  );
}
