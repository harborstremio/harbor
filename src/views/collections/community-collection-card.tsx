import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { posterPlate } from "@/components/poster";
import type { Collection } from "@/lib/collections";
import { CommunityShareButton } from "./community-share-button";

function coverFor(collection: Collection): string | undefined {
  return collection.coverImage || collection.items.find((it) => it.poster)?.poster;
}

export function CommunityCollectionCard({
  collection,
  onOpen,
  onEdit,
  onDelete,
}: {
  collection: Collection;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const cover = coverFor(collection);
  const count = collection.items.length;

  return (
    <div className="group/card relative">
      <button
        type="button"
        onClick={() => onOpen(collection.id)}
        className="relative block aspect-[16/9] w-full overflow-hidden rounded-2xl border border-edge-soft text-start shadow-[0_6px_22px_-14px_rgba(0,0,0,0.6)] transition-[border-color,transform] duration-300 hover:-translate-y-0.5 hover:border-edge"
        style={cover ? undefined : { background: posterPlate(collection.id + collection.name) }}
      >
        {cover && (
          <img
            src={cover}
            alt=""
            loading="lazy"
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
        <span className="absolute start-3.5 top-3 inline-flex items-center rounded-full bg-black/45 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/85 backdrop-blur-md">
          {count === 1 ? t("{n} title", { n: count }) : t("{n} titles", { n: count })}
        </span>
        <h3 className="absolute inset-x-4 bottom-3.5 line-clamp-2 font-display text-[20px] font-medium leading-[1.1] tracking-tight text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.7)]">
          {collection.name}
        </h3>
      </button>

      <div className="absolute end-2.5 top-2.5 flex items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover/card:opacity-100 focus-within:opacity-100">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(collection.id);
          }}
          title={t("Edit")}
          aria-label={t("Edit")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-edge-soft bg-canvas/85 text-ink-muted backdrop-blur-md transition-colors hover:border-edge hover:text-ink"
        >
          <Pencil size={14} strokeWidth={2} />
        </button>
        <CommunityShareButton collectionId={collection.id} variant="icon" />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setConfirming(true);
          }}
          title={t("Delete")}
          aria-label={t("Delete")}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-edge-soft bg-canvas/85 text-ink-muted backdrop-blur-md transition-colors hover:border-danger/50 hover:text-danger"
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </div>

      {confirming && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-canvas/85 p-4 text-center backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-[13.5px] font-medium text-ink">
            {t("Delete this collection?")}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-9 rounded-full border border-edge px-4 text-[13px] font-semibold text-ink-muted transition-colors hover:text-ink"
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onDelete(collection.id);
              }}
              className="h-9 rounded-full bg-danger px-4 text-[13px] font-semibold text-white transition-transform hover:scale-[1.03]"
            >
              {t("Delete")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
