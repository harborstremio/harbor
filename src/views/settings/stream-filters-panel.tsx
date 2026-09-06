import { Check, Filter, FilterX, Pencil, Plus, Trash2 } from "./icons";
import { useState } from "react";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { isFilterEmpty, type CustomStreamFilter } from "@/lib/streams/custom-filters";
import { FilterBuilder } from "../play-picker/filter-builder";
import { Section } from "./shared";
import {
  ModalButton,
  ROW_ACTION,
  ROW_ACTION_DANGER,
  ROW_ACTION_PRIMARY,
  ROW_DESC,
  SettingRow,
  SettingsModal,
} from "./kit";

const ACTIVE_BUTTON = "min-w-[140px] justify-center";

function dimensionText(values: string[] | undefined): string | null {
  if (!values || values.length === 0) return null;
  if (values.length <= 3) return values.join(", ");
  return `${values.slice(0, 3).join(", ")}, +${values.length - 3}`;
}

function FilterSummary({ filter }: { filter: CustomStreamFilter }) {
  const t = useT();
  const parts: string[] = [];
  const resolution = dimensionText(filter.resolution);
  if (resolution) parts.push(resolution);
  const source = dimensionText(filter.source);
  if (source) parts.push(source);
  const codec = dimensionText(filter.codec);
  if (codec) parts.push(codec);
  const audio = dimensionText(filter.audio);
  if (audio) parts.push(audio);
  if (filter.requireHdr === true) parts.push(t("HDR"));
  if (filter.cachedOnly === true) parts.push(t("Cached"));
  if (typeof filter.minSeeders === "number" && filter.minSeeders > 0)
    parts.push(t("{n}+ seeds", { n: filter.minSeeders }));
  if (typeof filter.maxSizeGb === "number" && filter.maxSizeGb > 0)
    parts.push(t("Max {n} GB", { n: filter.maxSizeGb }));
  if (parts.length === 0) return null;
  return <span className="block">{parts.join(" · ")}</span>;
}

function ActiveButton({
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
      className={`${on ? ROW_ACTION_PRIMARY : ROW_ACTION} ${ACTIVE_BUTTON}`}
    >
      {on && <Check size={18} strokeWidth={2.4} />}
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
      <SettingRow
        label={t("No filter")}
        icon={<FilterX size={18} />}
        desc={t("Show every stream, with no quality preference applied.")}
      >
        <ActiveButton
          on={activeId == null}
          onClick={() => update({ activeStreamFilterId: null })}
        />
      </SettingRow>

      {filters.map((f) => (
        <SettingRow
          key={f.id}
          wide
          icon={
            <Filter size={18} className={activeId === f.id ? "text-accent" : undefined} />
          }
          label={f.name.trim() || t("Untitled filter")}
          desc={
            isFilterEmpty(f) ? (
              t("No dimensions set. This filter matches every stream.")
            ) : (
              <FilterSummary filter={f} />
            )
          }
        >
          <span className="flex flex-wrap items-center gap-2.5">
            <ActiveButton
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
              className={ROW_ACTION}
            >
              <Pencil size={18} strokeWidth={2} />
              {t("Edit")}
            </button>
            <button type="button" onClick={() => askDelete(f.id)} className={ROW_ACTION_DANGER}>
              <Trash2 size={18} strokeWidth={2} />
              {t("Delete")}
            </button>
          </span>
        </SettingRow>
      ))}

      <SettingRow
        label={t("New filter")}
        icon={<Plus size={18} />}
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
          className={ROW_ACTION_PRIMARY}
        >
          <Plus size={18} strokeWidth={2.4} />
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
            <button type="button" onClick={confirmDelete} className={ROW_ACTION_DANGER}>
              <Trash2 size={18} strokeWidth={2.2} />
              {t("Delete")}
            </button>
          </>
        }
      >
        <p className={`max-w-[66ch] ${ROW_DESC}`}>
          {t("Delete {name}? Saved filters cannot be brought back.", {
            name: pendingDelete?.name.trim() || t("Untitled filter"),
          })}
        </p>
      </SettingsModal>
    </Section>
  );
}
