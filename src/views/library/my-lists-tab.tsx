import { CreateListModal } from "@/components/lists/create-list-modal";
import { ListCard } from "@/components/lists/list-card";
import { MAX_LISTS, useCustomLists } from "@/lib/custom-lists";
import { useT } from "@/lib/i18n";
import { Layers, Plus } from "lucide-react";
import { useState } from "react";

import { ListDetail } from "./list-detail";

export function MyListsTab() {
  const t = useT();
  const lists = useCustomLists();
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (selectedListId) {
    return <ListDetail listId={selectedListId} onBack={() => setSelectedListId(null)} />;
  }

  const atMax = lists.length >= MAX_LISTS;

  return (
    <section className="flex flex-col gap-6">
      {lists.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="text-[12px] tabular-nums text-ink-muted">
            {t("{n} / {max} lists", { n: lists.length, max: MAX_LISTS })}
          </span>
          <button
            type="button"
            disabled={atMax}
            onClick={() => setCreating(true)}
            className="flex h-10 items-center gap-2 rounded-full border border-edge bg-canvas/80 px-4 text-[13.5px] font-semibold text-ink transition-colors hover:border-ink-subtle hover:bg-canvas/95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus size={16} strokeWidth={2.2} />
            {t("Create new list")}
          </button>
        </div>
      )}

      {lists.length === 0 ? (
        <EmptyLists onCreate={() => setCreating(true)} />
      ) : (
        <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
          {lists.map((l) => (
            <ListCard key={l.id} list={l} onOpen={setSelectedListId} />
          ))}
        </div>
      )}

      {creating && <CreateListModal onClose={() => setCreating(false)} onCreated={(id) => setSelectedListId(id)} />}
    </section>
  );
}

function EmptyLists({ onCreate }: { onCreate: () => void }) {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-8 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-elevated/60 text-ink-subtle ring-1 ring-edge-soft/60">
        <Layers size={24} strokeWidth={1.6} />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-[20px] font-medium text-ink">{t("Create your first list")}</h2>
        <p className="max-w-sm text-[13px] leading-relaxed text-ink-muted">
          {t("Group the movies and shows you love. Rewatch shelf, weekend picks, whatever keeps them close.")}
        </p>
      </div>
      <button
        type="button"
        onClick={onCreate}
        className="mt-1 flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold text-canvas shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
      >
        <Plus size={17} strokeWidth={2.2} />
        {t("New list")}
      </button>
    </div>
  );
}
