import { Check, Filter, FilterX, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { isFilterEmpty, type CustomStreamFilter } from "@/lib/streams/custom-filters";
import { FilterBuilder } from "../play-picker/filter-builder";
import { Section } from "./shared";
import { ModalButton, SettingGroup, SettingRow, SettingsModal } from "./kit";

function dimensionChips(values: string[] | undefined): string[] {
  if (!values || values.length === 0) return [];
  if (values.length === 1) return [values[0]];
  return [values[0], `+${values.length - 1}`];
}

function FilterChips({ filter }: { filter: CustomStreamFilter }) {
  const t = useT();
  const chips = [
    ...dimensionChips(filter.resolution),
    ...dimensionChips(filter.source),
    ...dimensionChips(filter.codec),
    ...dimensionChips(filter.audio),
  ];
  if (filter.requireHdr === true) chips.push(t("HDR"));
  if (filter.cachedOnly === true) chips.push(t("Cached"));
  if (typeof filter.minSeeders === "number" && filter.minSeeders > 0)
    chips.push(t("{n}+ seeds", { n: filter.minSeeders }));
  if (typeof filter.maxSizeGb === "number" && filter.maxSizeGb > 0)
    chips.push(t("Max {n} GB", { n: filter.maxSizeGb }));
  if (chips.length === 0) return null;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {chips.map((chip, i) => (
        <span
          key={`${chip}-${i}`}
          className="rounded-md bg-canvas px-2 py-[3px] text-[11.5px] font-semibold tabular-nums text-ink-muted"
        >
          {chip}
        </span>
      ))}
    </span>
  );
}

function ActiveChip({
  on,
  disabled,
  onClick,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      disabled={disabled}
      className={`harbor-press-pop flex h-8 min-w-[96px] shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-[12.5px] font-semibold transition-colors disabled:cursor-default disabled:opacity-40 ${
        on ? "bg-ink text-canvas" : "bg-canvas text-ink-muted hover:bg-raised hover:text-ink"
      }`}
    >
      {on && <Check size={12} strokeWidth={2.6} />}
      {on ? t("Active") : t("Set active")}
    </button>
  );
}

export function StreamFiltersPanel() {
  const t = useT();
  const { settings, update } = useSettings();
  const filters = settings.customStreamFilters ?? [];
  const activeId = settings.activeStreamFilterId;
  const [editing, setEditing] = useState<CustomStreamFilter | null>(null);
  const [building, setBuilding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CustomStreamFilter | null>(null);

  const persist = (next: CustomStreamFilter[]) => update({ customStreamFilters: next });

  const upsert = (filter: CustomStreamFilter) => {
    const exists = filters.some((f) => f.id === filter.id);
    update({
      customStreamFilters: exists
        ? filters.map((f) => (f.id === filter.id ? filter : f))
        : [...filters, filter],
      ...(isFilterEmpty(filter) ? {} : { activeStreamFilterId: filter.id }),
    });
    setEditing(null);
    setBuilding(false);
  };

  const rename = (id: string, name: string) =>
    persist(filters.map((f) => (f.id === id ? { ...f, name } : f)));

  const toggleActive = (id: string) =>
    update({ activeStreamFilterId: activeId === id ? null : id });

  const remove = (id: string) => {
    update({
      customStreamFilters: filters.filter((f) => f.id !== id),
      ...(activeId === id ? { activeStreamFilterId: null } : {}),
    });
  };

  const closeBuilder = () => {
    setEditing(null);
    setBuilding(false);
  };

  const askDelete = (id: string) => {
    const target = filters.find((f) => f.id === id);
    if (target) setPendingDelete(target);
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    remove(pendingDelete.id);
    setPendingDelete(null);
    closeBuilder();
  };

  return (
    <Section
      title={t("Saved stream filters")}
      subtitle={t("Build a named quality preference once and set it active. The picker prefers streams that match it, including the instant pick, and falls back to the next best source when nothing matches. Each filter ANDs its dimensions and ignores any you leave blank.")}
    >
      <SettingGroup label={t("Your filters")}>
        <SettingRow
          label={t("No filter")}
          icon={<FilterX size={16} />}
          desc={t("Show every stream, with no quality preference applied.")}
        >
          <ActiveChip on={activeId == null} onClick={() => update({ activeStreamFilterId: null })} />
        </SettingRow>

        {filters.map((f) => (
          <SettingRow
            key={f.id}
            icon={
              activeId === f.id ? (
                <span className="text-accent">
                  <Filter size={16} />
                </span>
              ) : (
                <Filter size={16} />
              )
            }
            label={
              <input
                type="text"
                value={f.name}
                onChange={(e) => rename(f.id, e.target.value)}
                aria-label={t("Name")}
                placeholder={t("Untitled filter")}
                maxLength={60}
                spellCheck={false}
                className="h-8 w-[204px] min-w-0 max-w-full rounded-md bg-canvas px-2.5 text-[13px] font-medium text-ink outline-none placeholder:text-ink-subtle"
              />
            }
            desc={
              isFilterEmpty(f) ? (
                t("No dimensions set. This filter matches every stream.")
              ) : (
                <FilterChips filter={f} />
              )
            }
          >
            <span className="flex shrink-0 items-center gap-1.5">
              <ActiveChip
                on={activeId === f.id}
                disabled={isFilterEmpty(f)}
                onClick={() => toggleActive(f.id)}
              />
              <button
                type="button"
                onClick={() => {
                  setBuilding(false);
                  setEditing(f);
                }}
                aria-label={t("Edit filter")}
                className="harbor-press-pop flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-canvas px-3 text-[12.5px] font-medium text-ink-muted transition-colors hover:bg-raised hover:text-ink"
              >
                <Pencil size={12} strokeWidth={2} />
                {t("Edit")}
              </button>
              <button
                type="button"
                onClick={() => askDelete(f.id)}
                aria-label={t("Delete filter")}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-subtle transition-colors hover:bg-raised hover:text-danger"
              >
                <Trash2 size={14} strokeWidth={1.9} />
              </button>
            </span>
          </SettingRow>
        ))}
      </SettingGroup>

      <SettingRow
        label={t("New filter")}
        icon={<Plus size={16} />}
        desc={
          filters.length === 0
            ? t("No saved filters yet. Hit New filter to build one.")
            : t("Name it, tick the resolutions, sources, codecs and audio you want, and leave the rest blank.")
        }
        tip={t("A filter applies everywhere Harbor picks a stream: the source picker, the instant pick, and Big Picture on TV.")}
      >
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setBuilding(true);
          }}
          className="harbor-press-pop flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-ink px-3.5 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
        >
          <Plus size={14} strokeWidth={2.4} />
          {t("Create")}
        </button>
      </SettingRow>

      <FilterBuilder
        open={building || editing != null}
        initial={editing}
        onSave={upsert}
        onDelete={askDelete}
        onClose={closeBuilder}
      />

      <SettingsModal
        open={pendingDelete != null}
        onClose={() => setPendingDelete(null)}
        title={t("Delete filter")}
        actions={
          <>
            <ModalButton ghost onClick={() => setPendingDelete(null)}>
              {t("Cancel")}
            </ModalButton>
            <button
              type="button"
              onClick={confirmDelete}
              className="harbor-press-pop flex h-9 items-center gap-1.5 rounded-md bg-danger/15 px-4 text-[12.5px] font-semibold text-danger transition-colors hover:bg-danger/25"
            >
              <Trash2 size={12} strokeWidth={2.4} />
              {t("Delete")}
            </button>
          </>
        }
      >
        <p className="rounded-md bg-elevated px-4 py-3.5 text-[13px] leading-relaxed text-ink-muted">
          {t("Delete {name}? Saved filters cannot be brought back.", {
            name: pendingDelete?.name.trim() || t("Untitled filter"),
          })}
        </p>
      </SettingsModal>
    </Section>
  );
}
