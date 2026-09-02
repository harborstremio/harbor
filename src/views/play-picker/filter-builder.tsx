import { Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
import { badgeFor, type BadgeDimension } from "./filter-builder/badge-maps";

const EXIT_MS = 190;

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
      className={`flex h-11 items-center gap-2.5 rounded-sm px-3 text-[13.5px] font-semibold outline-none transition-[background-color,box-shadow] duration-150 active:scale-[0.98] motion-reduce:active:scale-100 ${
        active
          ? "bg-accent/12 text-ink ring-1 ring-accent"
          : "bg-elevated/45 text-ink-muted ring-1 ring-edge-soft hover:bg-elevated hover:text-ink"
      }`}
    >
      {badge && (
        <span className="flex h-5 shrink-0 items-center overflow-hidden [&_img]:!h-5 [&_img]:!max-h-5 [&_img]:!w-auto">
          <FormatBadge kind={badge} size="sm" />
        </span>
      )}
      <span className="min-w-0 flex-1 truncate text-start">{label}</span>
    </button>
  );
}

function SectionLabel({ title, count }: { title: string; count?: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-ink-subtle">{title}</span>
      {count != null && count > 0 && (
        <span className="text-[11.5px] font-semibold tabular-nums text-accent">{count}</span>
      )}
    </div>
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
  return (
    <div className="flex flex-col gap-2.5">
      <SectionLabel title={title} count={selected.length} />
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
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      aria-pressed={value}
      className={`flex items-center justify-between gap-4 rounded-[8px] px-4 py-3 text-start transition-[background-color,box-shadow] ${
        value ? "bg-accent/10 ring-1 ring-accent" : "bg-canvas/40 ring-1 ring-edge-soft hover:ring-edge"
      }`}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14.5px] font-semibold text-ink">{title}</span>
        <span className="text-[12.5px] text-ink-subtle">{sub}</span>
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
  onChange,
}: {
  title: string;
  sub: string;
  placeholder: string;
  value: number | null | undefined;
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[8px] bg-canvas/40 px-4 py-3 ring-1 ring-edge-soft">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14.5px] font-semibold text-ink">{title}</span>
        <span className="text-[12.5px] text-ink-subtle">{sub}</span>
      </div>
      <input
        type="number"
        min={0}
        inputMode="numeric"
        value={value == null ? "" : value}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.trim();
          if (raw === "") {
            onChange(null);
            return;
          }
          const n = Number(raw);
          onChange(Number.isFinite(n) ? n : null);
        }}
        className="h-10 w-24 shrink-0 rounded-sm border border-edge bg-elevated px-3 text-end text-[14.5px] tabular-nums text-ink outline-none transition-colors focus:border-accent placeholder:text-ink-subtle/55"
      />
    </div>
  );
}

export function FilterBuilder({
  open,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  open: boolean;
  initial: CustomStreamFilter | null;
  onSave: (filter: CustomStreamFilter) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<CustomStreamFilter>(() => initial ?? newCustomFilter(""));
  const [shown, setShown] = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (open) {
      setDraft(initial ?? newCustomFilter(""));
      setClosing(false);
      const r = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
  }, [open, initial]);

  const requestClose = useMemo(
    () => () => {
      if (closing) return;
      setClosing(true);
      window.clearTimeout(closeTimer.current);
      closeTimer.current = window.setTimeout(onClose, EXIT_MS);
    },
    [closing, onClose],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const isEdit = initial != null;
  const summary = useMemo(() => summarizeFilter(draft), [draft]);
  const canSave = draft.name.trim().length > 0;
  const visible = shown && !closing;

  if (!open) return null;

  const toggleMulti = <T extends string>(key: BadgeDimension, value: T) => {
    setDraft((d) => {
      const current = (d[key] as T[] | undefined) ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...d, [key]: next };
    });
  };

  const save = () => {
    if (!canSave) return;
    onSave({ ...draft, name: draft.name.trim() });
  };

  return createPortal(
    <div
      className={`fixed inset-0 z-[210] flex items-center justify-center p-4 transition-opacity duration-200 ease-out ${
        visible ? "bg-canvas/80 opacity-100" : "bg-canvas/0 opacity-0"
      }`}
      onClick={requestClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ transformOrigin: "center", transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0.24, 1)" }}
        className={`flex max-h-[90vh] w-[min(96vw,640px)] flex-col overflow-hidden rounded-[12px] border border-edge bg-elevated shadow-[0_40px_100px_-24px_rgba(0,0,0,0.75)] transition-[transform,opacity] duration-200 ${
          visible ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-[0.98] opacity-0"
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-edge-soft px-6 pb-4 pt-5">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-display text-[21px] font-medium leading-none tracking-tight text-ink">
              {isEdit ? t("Edit filter") : t("New filter")}
            </h2>
            <p className="truncate text-[12.5px] text-ink-muted">{summary}</p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            aria-label={t("Close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm text-ink-subtle transition-colors hover:bg-raised hover:text-ink active:scale-90 motion-reduce:active:scale-100"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-2">
            <SectionLabel title={t("Name")} />
            <input
              value={draft.name}
              autoFocus
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

          <MultiSection
            title={t("Resolution")}
            options={RESOLUTION_OPTIONS}
            dimension="resolution"
            selected={draft.resolution ?? []}
            onToggle={(v) => toggleMulti("resolution", v)}
          />
          <MultiSection
            title={t("Source")}
            options={SOURCE_OPTIONS}
            dimension="source"
            selected={draft.source ?? []}
            onToggle={(v) => toggleMulti("source", v)}
          />
          <MultiSection
            title={t("Codec")}
            options={CODEC_OPTIONS}
            dimension="codec"
            selected={draft.codec ?? []}
            onToggle={(v) => toggleMulti("codec", v)}
          />
          <MultiSection
            title={t("Audio")}
            options={AUDIO_OPTIONS}
            dimension="audio"
            selected={draft.audio ?? []}
            onToggle={(v) => toggleMulti("audio", v)}
          />

          <div className="flex flex-col gap-2">
            <ToggleSection
              title={t("HDR only")}
              sub={t("Keep Dolby Vision, HDR10, HLG. Drop SDR.")}
              value={draft.requireHdr === true}
              onChange={(v) => setDraft((d) => ({ ...d, requireHdr: v }))}
            />
            <ToggleSection
              title={t("Cached only")}
              sub={t("Only streams already in your debrid library.")}
              value={draft.cachedOnly === true}
              onChange={(v) => setDraft((d) => ({ ...d, cachedOnly: v }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <NumberSection
              title={t("Min seeders")}
              sub={t("Excludes direct and debrid streams with no seeders.")}
              placeholder={t("Any")}
              value={draft.minSeeders}
              onChange={(v) => setDraft((d) => ({ ...d, minSeeders: v }))}
            />
            <NumberSection
              title={t("Max size (GB)")}
              sub={t("Caps file size. Unknown sizes still pass.")}
              placeholder={t("Any")}
              value={draft.maxSizeGb}
              onChange={(v) => setDraft((d) => ({ ...d, maxSizeGb: v }))}
            />
          </div>

          {isFilterEmpty(draft) && (
            <p className="rounded-[8px] bg-raised/50 px-4 py-3 text-[12.5px] text-ink-muted">
              {t("No dimensions set. This filter matches every stream.")}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-edge-soft px-6 pb-5 pt-4">
          {isEdit && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(draft.id)}
              className="flex items-center gap-2 rounded-sm px-3 py-2 text-[13.5px] font-semibold text-danger transition-colors hover:bg-danger/12 active:scale-95 motion-reduce:active:scale-100"
            >
              <Trash2 size={15} />
              {t("Delete")}
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={requestClose}
              className="rounded-sm px-4 py-2.5 text-[13.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="rounded-sm bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-canvas transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:brightness-100 motion-reduce:active:scale-100"
            >
              {isEdit ? t("Save") : t("Create")}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
