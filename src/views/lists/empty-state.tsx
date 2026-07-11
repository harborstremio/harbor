import { useT } from "@/lib/i18n";
import { SOURCE_LABELS, type ListSource } from "@/lib/lists/types";
import { ListPlus } from "lucide-react";

import { AddListForm } from "./add-list-form";
import { SOURCE_DOT } from "./source-dot";

const SOURCES = Object.keys(SOURCE_LABELS) as ListSource[];

export function ListsEmptyState({ onAdd }: { onAdd: (ref: string, name?: string) => void }) {
  const t = useT();
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-20">
      <div className="flex w-full max-w-[560px] flex-col items-center gap-6 rounded-2xl border border-dashed border-edge px-8 py-14 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-elevated text-ink-muted">
          <ListPlus size={24} strokeWidth={1.9} />
        </span>
        <h2 className="font-display text-[26px] font-medium tracking-tight text-ink">
          {t("Bring your lists with you")}
        </h2>
        <p className="max-w-[420px] text-[14px] leading-relaxed text-ink-muted">
          {t(
            "Paste a public list from Trakt, MDBList, TMDB, Letterboxd, IMDb, or MyAnimeList. Harbor pulls the titles in and keeps the artwork sharp.",
          )}
        </p>
        <div className="w-full rounded-xl border border-edge-soft/60 bg-canvas/40 p-1">
          <AddListForm submitLabel={t("Add list")} hideCancel onSubmit={({ ref, name }) => onAdd(ref, name)} />
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          {SOURCES.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-full bg-elevated px-2.5 py-1 text-[11px] font-semibold text-ink ring-1 ring-edge-soft"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${SOURCE_DOT[s]}`} />
              {SOURCE_LABELS[s]}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
