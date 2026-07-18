import { ArrowLeft, Layers, X } from "lucide-react";
import type { Meta } from "@/lib/cinemeta";
import { MAX_ITEMS, removeFromList, useList, type ListItem } from "@/lib/custom-lists";
import { relativeTime } from "@/lib/dates";
import { useT } from "@/lib/i18n";
import { PickCard } from "@/components/pick-card";
import { AddTitleSearch } from "./list-detail/add-title-search";
import { ListSettingsMenu } from "./list-detail/list-settings-menu";
import { Grid } from "./shared";

function itemToMeta(it: ListItem): Meta {
  return { id: it.id, type: it.type, name: it.name, poster: it.poster };
}

export function ListDetail({ listId, onBack }: { listId: string; onBack: () => void }) {
  const t = useT();
  const list = useList(listId);

  if (!list) return null;

  return (
    <section className="flex flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 self-start text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft size={16} strokeWidth={2.2} />
        {t("Back to lists")}
      </button>

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[34px] font-medium leading-[1.05] text-ink">
            {list.name}
          </h1>
          <p className="text-[12.5px] text-ink-muted">
            {t("{n} / {max} items", { n: list.items.length, max: MAX_ITEMS })}
            {list.updatedAt > 0 &&
              ` · ${t("Updated {when}", { when: relativeTime(list.updatedAt) })}`}
          </p>
        </div>
        <ListSettingsMenu list={list} onDeleted={onBack} />
      </div>

      <AddTitleSearch list={list} />

      {list.items.length === 0 ? (
        <EmptyList />
      ) : (
        <Grid>
          {list.items.map((it) => (
            <div key={it.id} className="group/item relative">
              <PickCard meta={itemToMeta(it)} />
              <button
                type="button"
                aria-label={t("Remove from list")}
                onClick={() => removeFromList(list.id, it.id)}
                className="absolute end-1.5 top-1.5 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-canvas/85 text-ink opacity-0 ring-1 ring-edge-soft/70 backdrop-blur-sm transition-opacity hover:bg-canvas hover:text-danger group-hover/item:opacity-100 focus:opacity-100"
              >
                <X size={14} strokeWidth={2.4} />
              </button>
            </div>
          ))}
        </Grid>
      )}
    </section>
  );
}

function EmptyList() {
  const t = useT();
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-8 py-16 text-center">
      <Layers size={26} strokeWidth={1.6} className="text-ink-subtle" />
      <h2 className="text-[15px] font-semibold text-ink">{t("Nothing here yet")}</h2>
      <p className="max-w-md text-[13px] leading-relaxed text-ink-muted">
        {t('Add titles with the search above, or hit "Add to list" on any movie or show\'s page.')}
      </p>
    </div>
  );
}
