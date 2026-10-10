import { Check, Filter, FilterX, Pencil, Plus, Trash2 } from "./icons";
import { useRef, useState } from "react";
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
  label,
  disabled,
  onClick,
}: {
  on: boolean;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
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
  const activeFilter = filters.find((filter) => filter.id === settings.activeStreamFilterId && !isFilterEmpty(filter));
  const activeId = activeFilter?.id ?? null;
  const [editing, setEditing] = useState<CustomStreamFilter | null>(null);
  const [building, setBuilding] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CustomStreamFilter | null>(null);
  const createButtonRef = useRef<HTMLButtonElement>(null);

  const upsert = (filter: CustomStreamFilter) => {
    const exists = filters.some((f) => f.id === filter.id);
    update({
      customStreamFilters: exists
        ? filters.map((f) => (f.id === filter.id ? filter : f))
        : [...filters, filter],
      activeStreamFilterId: isFilterEmpty(filter)
        ? activeId === filter.id ? null : activeId
        : filter.id,
    });
    setEditing(null);
    setBuilding(false);
  };

  const toggleActive = (id: string) =>
    update({ activeStreamFilterId: activeId === id ? null : id });

  const remove = (id: string) => {
    update({
      customStreamFilters: filters.filter((f) => f.id !== id),
      ...(settings.activeStreamFilterId === id ? { activeStreamFilterId: null } : {}),
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
    requestAnimationFrame(() => createButtonRef.current?.focus({ preventScroll: true }));
  };

  return (
    <Section
      title={t("Saved stream filters")}
      subtitle={t("Save the stream quality you prefer. Streams must match every category you set; leave a category blank to accept any value. If nothing matches, Harbor uses the next best available source.")}
    >
      <SettingRow
        label={t("No filter")}
        icon={<FilterX size={18} />}
        desc={t("Remove the saved quality preference. Your other stream settings still apply.")}
      >
        <ActiveButton
          on={activeId == null}
          label={t("Use no saved stream filter")}
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
              t("No preferences selected. Edit this filter to choose the streams you prefer.")
            ) : (
              <FilterSummary filter={f} />
            )
          }
        >
          <span className="flex flex-wrap items-center gap-2.5">
            <ActiveButton
              on={activeId === f.id}
              label={activeId === f.id
                ? t("Turn off {name}", { name: f.name.trim() || t("Untitled filter") })
                : t("Use {name}", { name: f.name.trim() || t("Untitled filter") })}
              disabled={isFilterEmpty(f)}
              onClick={() => toggleActive(f.id)}
            />
            <button
              type="button"
              aria-label={t("Edit {name}", { name: f.name.trim() || t("Untitled filter") })}
              onClick={() => {
                setBuilding(false);
                setEditing(f);
              }}
              className={ROW_ACTION}
            >
              <Pencil size={18} strokeWidth={2} />
              {t("Edit")}
            </button>
            <button type="button" onClick={() => askDelete(f.id)} aria-label={t("Delete {name}", { name: f.name.trim() || t("Untitled filter") })} className={ROW_ACTION_DANGER}>
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
            ? t("Create your first filter with the stream quality you prefer.")
            : t("Choose a name, then select the resolutions, sources, codecs and audio you prefer.")
        }
        tip={t("A filter applies everywhere Harbor picks a stream: the source picker, the instant pick, and Big Picture on TV.")}
      >
        <button
          type="button"
          ref={createButtonRef}
          aria-label={t("Create a stream filter")}
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
        dismissible={pendingDelete == null}
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
