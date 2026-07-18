import { Filter, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { summarizeFilter, type CustomStreamFilter } from "@/lib/streams/custom-filters";
import { FilterBuilder } from "../play-picker/filter-builder";
import { Section } from "./shared";

export function StreamFiltersPanel() {
  const t = useT();
  const { settings, update } = useSettings();
  const filters = settings.customStreamFilters ?? [];
  const [editing, setEditing] = useState<CustomStreamFilter | null>(null);
  const [building, setBuilding] = useState(false);

  const persist = (next: CustomStreamFilter[]) => update({ customStreamFilters: next });

  const upsert = (filter: CustomStreamFilter) => {
    const exists = filters.some((f) => f.id === filter.id);
    persist(exists ? filters.map((f) => (f.id === filter.id ? filter : f)) : [...filters, filter]);
    setEditing(null);
    setBuilding(false);
  };

  const rename = (id: string, name: string) =>
    persist(filters.map((f) => (f.id === id ? { ...f, name } : f)));

  const remove = (id: string) => persist(filters.filter((f) => f.id !== id));

  const closeBuilder = () => {
    setEditing(null);
    setBuilding(false);
  };

  return (
    <Section
      title={t("Saved stream filters")}
      subtitle={t(
        "Build a named filter once, then apply it in the source picker to hide everything that doesn't match. Each filter ANDs its dimensions and ignores any you leave blank.",
      )}
    >
      <div className="flex flex-col gap-3 rounded-xl border border-edge-soft bg-canvas/40 p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-[0.16em] text-ink-subtle">
            <Filter size={11} strokeWidth={2.3} />
            {t("YOUR FILTERS")}
          </span>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setBuilding(true);
            }}
            className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            <Plus size={13} strokeWidth={2.4} />
            {t("New filter")}
          </button>
        </div>

        {filters.length === 0 ? (
          <div className="rounded-lg border border-dashed border-edge-soft/60 bg-canvas/20 px-3 py-6 text-center text-[12.5px] text-ink-subtle">
            {t("No saved filters yet. Hit New filter to build one.")}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {filters.map((f) => (
              <li
                key={f.id}
                className="flex items-center gap-3 rounded-lg border border-edge-soft bg-elevated/40 px-3.5 py-2.5"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <input
                    type="text"
                    value={f.name}
                    onChange={(e) => rename(f.id, e.target.value)}
                    placeholder={t("Untitled filter")}
                    maxLength={60}
                    spellCheck={false}
                    className="w-full max-w-[280px] bg-transparent text-[13px] font-semibold text-ink outline-none placeholder:text-ink-subtle/70"
                  />
                  <span className="w-fit max-w-full truncate rounded-full bg-canvas/70 px-2 py-0.5 text-[11px] font-medium text-ink-muted ring-1 ring-edge-soft/60">
                    {summarizeFilter(f)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setBuilding(false);
                    setEditing(f);
                  }}
                  aria-label={t("Edit filter")}
                  className="flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-medium text-ink-muted transition-colors hover:bg-canvas/60 hover:text-ink"
                >
                  <Pencil size={12} strokeWidth={2} />
                  {t("Edit")}
                </button>
                <button
                  type="button"
                  onClick={() => remove(f.id)}
                  aria-label={t("Delete filter")}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-danger/15 hover:text-danger"
                >
                  <Trash2 size={12} strokeWidth={1.9} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <FilterBuilder
        open={building || editing != null}
        initial={editing}
        onSave={upsert}
        onDelete={remove}
        onClose={closeBuilder}
      />
    </Section>
  );
}
