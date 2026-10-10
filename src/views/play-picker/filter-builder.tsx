import { Trash2 } from "../settings/icons";
import { useEffect, useId, useState } from "react";
import { FormatBadge, type BadgeKind } from "@/components/format-badge";
import { useT } from "@/lib/i18n";
import {
  AUDIO_OPTIONS,
  CODEC_OPTIONS,
  RESOLUTION_OPTIONS,
  SOURCE_OPTIONS,
  isFilterEmpty,
  newCustomFilter,
  summarizeFilter,
  type CustomStreamFilter,
} from "@/lib/streams/custom-filters";
import { ModalButton, ROW_ACTION_DANGER, ROW_ACTION_PRIMARY, SettingsModal } from "../settings/kit";
import { badgeFor, type BadgeDimension } from "./filter-builder/badge-maps";

function BadgeCard({
  label,
  badge,
  active,
  onClick,
}: {
  label: string;
  badge: BadgeKind | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-11 items-center gap-2.5 rounded-sm px-3 text-[13.5px] font-semibold outline-none transition-[background-color,box-shadow] duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] motion-reduce:active:scale-100 ${
        active
          ? "bg-accent/12 text-ink ring-1 ring-accent"
          : "bg-elevated/45 text-ink-muted ring-1 ring-edge-soft hover:bg-elevated hover:text-ink"
      }`}
    >
      {badge && (
        <span aria-hidden className="flex h-5 shrink-0 items-center overflow-hidden [&_img]:!h-5 [&_img]:!max-h-5 [&_img]:!w-auto">
          <FormatBadge kind={badge} size="sm" />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-start">{label}</span>
    </button>
  );
}

function SectionLabel({ title, count, id }: { title: string; count?: number; id?: string }) {
  return (
    <span className="flex items-baseline justify-between gap-3">
      <span id={id} className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-subtle">{title}</span>
      {count != null && count > 0 && (
        <span className="text-[11.5px] font-semibold tabular-nums text-accent">{count}</span>
      )}
    </span>
  );
}

function MultiSection<T extends string>({
  title,
  options,
  dimension,
  selected,
  onToggle,
}: {
  title: string;
  options: readonly T[];
  dimension: BadgeDimension;
  selected: T[];
  onToggle: (value: T) => void;
}) {
  const titleId = useId();
  return (
    <div role="group" aria-labelledby={titleId} className="flex flex-col gap-2.5">
      <SectionLabel id={titleId} title={title} count={selected.length} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <BadgeCard
            key={o}
            label={o}
            badge={badgeFor(dimension, o)}
            active={selected.includes(o)}
            onClick={() => onToggle(o)}
          />
        ))}
      </div>
    </div>
  );
}

function ToggleSection({
  title,
  sub,
  value,
  onChange,
}: {
  title: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const titleId = useId();
  const descId = useId();
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      aria-labelledby={titleId}
      aria-describedby={descId}
      className={`flex items-center justify-between gap-4 rounded-[8px] px-4 py-3 text-start transition-[background-color,box-shadow] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        value ? "bg-accent/10 ring-1 ring-accent" : "bg-canvas/40 ring-1 ring-edge-soft hover:ring-edge"
      }`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span id={titleId} className="text-[14.5px] font-semibold text-ink">{title}</span>
        <span id={descId} className="text-[12.5px] text-ink-subtle">{sub}</span>
      </div>
      <span
        aria-hidden
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${value ? "bg-accent" : "bg-edge"}`}
      >
        <span
          className={`absolute start-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-canvas shadow-sm transition-transform duration-[240ms] ${
            value ? "translate-x-5 rtl:-translate-x-5" : "translate-x-0"
          }`}
          style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.4, 0.5, 1)" }}
        />
      </span>
    </button>
  );
}

function NumberSection({
  title,
  sub,
  placeholder,
  value,
  wholeNumber,
  error,
  onChange,
}: {
  title: string;
  sub: string;
  placeholder: string;
  value: string;
  wholeNumber?: boolean;
  error?: string;
  onChange: (value: string, badInput: boolean) => void;
}) {
  const inputId = useId();
  const descId = useId();
  const errorId = useId();
  return (
    <div className="flex flex-col gap-2 rounded-[8px] bg-canvas/40 px-4 py-3 ring-1 ring-edge-soft">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-0.5">
          <label htmlFor={inputId} className="text-[14.5px] font-semibold text-ink">{title}</label>
          <span id={descId} className="text-[12.5px] text-ink-subtle">{sub}</span>
        </div>
        <input
          id={inputId}
          type="number"
          min={0}
          step={wholeNumber ? 1 : "any"}
          inputMode={wholeNumber ? "numeric" : "decimal"}
          value={value}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? `${descId} ${errorId}` : descId}
          onChange={(e) => onChange(e.target.value, e.target.validity.badInput)}
          className="h-10 w-24 shrink-0 rounded-sm border border-edge bg-elevated px-3 text-end text-[14.5px] tabular-nums text-ink outline-none transition-colors focus:border-accent placeholder:text-ink-subtle/55"
        />
      </div>
      {error && <p id={errorId} role="alert" className="text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}

export function FilterBuilder({
  open,
  initial,
  onSave,
  onDelete,
  onClose,
  dismissible = true,
}: {
  open: boolean;
  initial: CustomStreamFilter | null;
  onSave: (filter: CustomStreamFilter) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  dismissible?: boolean;
}) {
  const t = useT();
  const nameId = useId();
  const [draft, setDraft] = useState<CustomStreamFilter>(() => initial ?? newCustomFilter(""));
  const [seeders, setSeeders] = useState(String(initial?.minSeeders ?? ""));
  const [sizeGb, setSizeGb] = useState(String(initial?.maxSizeGb ?? ""));
  const [seedersBadInput, setSeedersBadInput] = useState(false);
  const [sizeBadInput, setSizeBadInput] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDraft(initial ?? newCustomFilter(""));
    setSeeders(String(initial?.minSeeders ?? ""));
    setSizeGb(String(initial?.maxSizeGb ?? ""));
    setSeedersBadInput(false);
    setSizeBadInput(false);
  }, [open, initial]);

  const minSeeders = seeders.trim() === "" ? null : Number(seeders);
  const maxSizeGb = sizeGb.trim() === "" ? null : Number(sizeGb);
  const seedersInvalid = seedersBadInput || (minSeeders != null && (!Number.isSafeInteger(minSeeders) || minSeeders < 0));
  const sizeInvalid = sizeBadInput || (maxSizeGb != null && (!Number.isFinite(maxSizeGb) || maxSizeGb < 0));
  const filter = { ...draft, minSeeders, maxSizeGb };
  const isEdit = initial != null;
  const canSave = draft.name.trim().length > 0 && !seedersInvalid && !sizeInvalid;
  const summary = seedersInvalid || sizeInvalid
    ? t("Check the highlighted values before saving.")
    : isFilterEmpty(filter) ? t("Choose the streams you prefer.") : summarizeFilter(filter);

  const toggleMulti = <T extends string>(key: BadgeDimension, value: T) => {
    setDraft((d) => {
      const current = (d[key] as T[] | undefined) ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...d, [key]: next };
    });
  };

  const save = () => {
    if (!canSave) return;
    onSave({ ...filter, name: draft.name.trim() });
  };

  return (
    <SettingsModal
      open={open}
      onClose={onClose}
      dismissible={dismissible}
      title={isEdit ? t("Edit filter") : t("New filter")}
      sub={summary}
      width={640}
      actions={
        <div className="flex w-full flex-wrap items-center justify-between gap-3">
          {isEdit && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(draft.id)}
              aria-label={t("Delete {name}", { name: draft.name.trim() || t("Untitled filter") })}
              className={ROW_ACTION_DANGER}
            >
              <Trash2 size={16} />
              {t("Delete")}
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <ModalButton ghost onClick={onClose}>{t("Cancel")}</ModalButton>
            <button type="button" onClick={save} disabled={!canSave} className={ROW_ACTION_PRIMARY}>
              {isEdit ? t("Save") : t("Create")}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <label htmlFor={nameId}><SectionLabel title={t("Name")} /></label>
          <input
            id={nameId}
            value={draft.name}
            spellCheck={false}
            placeholder={t("My filter")}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && canSave) {
                e.preventDefault();
                save();
              }
            }}
            className="h-11 w-full rounded-sm border border-edge bg-canvas px-4 text-[15px] text-ink outline-none transition-colors focus:border-accent placeholder:text-ink-subtle/55"
          />
        </div>

        <MultiSection title={t("Resolution")} options={RESOLUTION_OPTIONS} dimension="resolution" selected={draft.resolution ?? []} onToggle={(v) => toggleMulti("resolution", v)} />
        <MultiSection title={t("Source")} options={SOURCE_OPTIONS} dimension="source" selected={draft.source ?? []} onToggle={(v) => toggleMulti("source", v)} />
        <MultiSection title={t("Codec")} options={CODEC_OPTIONS} dimension="codec" selected={draft.codec ?? []} onToggle={(v) => toggleMulti("codec", v)} />
        <MultiSection title={t("Audio")} options={AUDIO_OPTIONS} dimension="audio" selected={draft.audio ?? []} onToggle={(v) => toggleMulti("audio", v)} />

        <div className="flex flex-col gap-2">
          <ToggleSection title={t("HDR only")} sub={t("Match Dolby Vision, HDR10 and HLG streams.")} value={draft.requireHdr === true} onChange={(v) => setDraft((d) => ({ ...d, requireHdr: v }))} />
          <ToggleSection title={t("Cached only")} sub={t("Match streams marked as cached or already in your debrid library.")} value={draft.cachedOnly === true} onChange={(v) => setDraft((d) => ({ ...d, cachedOnly: v }))} />
        </div>

        <div className="flex flex-col gap-2">
          <NumberSection
            title={t("Minimum seeders")}
            sub={t("Excludes streams with fewer seeders or no seeder count. Leave blank or enter 0 for any.")}
            placeholder={t("Any")}
            value={seeders}
            wholeNumber
            error={seedersInvalid ? t("Enter a whole number of 0 or more.") : undefined}
            onChange={(value, badInput) => { setSeeders(value); setSeedersBadInput(badInput); }}
          />
          <NumberSection
            title={t("Maximum size (GB)")}
            sub={t("Unknown sizes still match. Leave blank or enter 0 for any.")}
            placeholder={t("Any")}
            value={sizeGb}
            error={sizeInvalid ? t("Enter a size of 0 or more.") : undefined}
            onChange={(value, badInput) => { setSizeGb(value); setSizeBadInput(badInput); }}
          />
        </div>

        {!seedersInvalid && !sizeInvalid && isFilterEmpty(filter) && (
          <p className="rounded-[8px] bg-raised/50 px-4 py-3 text-[12.5px] text-ink-muted">
            {t("No preferences selected. This filter matches every stream.")}
          </p>
        )}
      </div>
    </SettingsModal>
  );
}
