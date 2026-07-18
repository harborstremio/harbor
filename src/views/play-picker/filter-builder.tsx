import { Check, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { FormatBadge, type BadgeKind } from "@/components/format-badge";
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

function MultiPill({
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
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
        active
          ? "bg-ink text-canvas"
          : "bg-elevated/50 text-ink-muted ring-1 ring-edge-soft/60 hover:bg-elevated hover:text-ink"
      }`}
    >
      {badge && (
        <span className="flex h-4 items-center overflow-hidden [&_img]:!h-4 [&_img]:!max-h-4 [&_img]:!w-auto">
          <FormatBadge kind={badge} size="sm" />
        </span>
      )}
      {label}
    </button>
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
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
        {title}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <MultiPill
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
      className="flex items-center justify-between gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3 text-start transition-colors hover:border-edge"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14px] font-medium text-ink">{title}</span>
        <span className="text-[12.5px] text-ink-subtle">{sub}</span>
      </div>
      <span
        aria-hidden
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${value ? "bg-ink" : "bg-edge"}`}
      >
        <span
          className={`absolute start-[2px] top-0.5 h-5 w-5 rounded-full bg-canvas transition-transform ${
            value ? "translate-x-4 rtl:-translate-x-4" : "translate-x-0"
          }`}
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
    <div className="flex items-center justify-between gap-4 rounded-xl border border-edge-soft bg-canvas/40 px-4 py-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[14px] font-medium text-ink">{title}</span>
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
        className="h-10 w-24 shrink-0 rounded-lg border border-edge bg-elevated px-3 text-end text-[14px] tabular-nums text-ink outline-none transition-colors focus:border-ink placeholder:text-ink-subtle/55"
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
  const [draft, setDraft] = useState<CustomStreamFilter>(() => initial ?? newCustomFilter(""));

  useEffect(() => {
    if (open) setDraft(initial ?? newCustomFilter(""));
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const isEdit = initial != null;
  const summary = useMemo(() => summarizeFilter(draft), [draft]);
  const canSave = draft.name.trim().length > 0;

  if (!open) return null;

  const toggleMulti = <T extends string>(key: BadgeDimension, value: T) => {
    setDraft((d) => {
      const current = (d[key] as T[] | undefined) ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...d, [key]: next };
    });
  };

  const save = () => {
    if (!canSave) return;
    onSave({ ...draft, name: draft.name.trim() });
  };

  return createPortal(
    <div
      className="animate-fade-in fixed inset-0 z-[210] flex items-center justify-center bg-canvas/80 p-4"
      onClick={onClose}
    >
      <div
        data-tv-focus-scope
        onClick={(e) => e.stopPropagation()}
        className="animate-modal-in flex max-h-[88vh] w-[min(94vw,560px)] flex-col rounded-2xl border border-edge-soft bg-elevated shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-edge-soft px-6 pb-4 pt-6">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="font-display text-[20px] font-medium tracking-tight text-ink">
              {isEdit ? "Edit filter" : "New filter"}
            </h2>
            <p className="truncate text-[12.5px] text-ink-muted">{summary}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-tv-modal-close
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto px-6 py-5">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
              Name
            </span>
            <input
              value={draft.name}
              autoFocus
              spellCheck={false}
              placeholder="My filter"
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && canSave) {
                  e.preventDefault();
                  save();
                }
              }}
              className="h-12 w-full rounded-xl border border-edge bg-canvas px-4 text-[15px] text-ink outline-none transition-colors focus:border-ink placeholder:text-ink-subtle/55"
            />
          </div>

          <MultiSection
            title="Resolution"
            options={RESOLUTION_OPTIONS}
            dimension="resolution"
            selected={draft.resolution ?? []}
            onToggle={(v) => toggleMulti("resolution", v)}
          />
          <MultiSection
            title="Source"
            options={SOURCE_OPTIONS}
            dimension="source"
            selected={draft.source ?? []}
            onToggle={(v) => toggleMulti("source", v)}
          />
          <MultiSection
            title="Codec"
            options={CODEC_OPTIONS}
            dimension="codec"
            selected={draft.codec ?? []}
            onToggle={(v) => toggleMulti("codec", v)}
          />
          <MultiSection
            title="Audio"
            options={AUDIO_OPTIONS}
            dimension="audio"
            selected={draft.audio ?? []}
            onToggle={(v) => toggleMulti("audio", v)}
          />

          <div className="flex flex-col gap-2.5">
            <ToggleSection
              title="HDR only"
              sub="Keep Dolby Vision, HDR10, HLG. Drop SDR."
              value={draft.requireHdr === true}
              onChange={(v) => setDraft((d) => ({ ...d, requireHdr: v }))}
            />
            <ToggleSection
              title="Cached only"
              sub="Only streams already in your debrid library."
              value={draft.cachedOnly === true}
              onChange={(v) => setDraft((d) => ({ ...d, cachedOnly: v }))}
            />
          </div>

          <div className="flex flex-col gap-2.5">
            <NumberSection
              title="Min seeders"
              sub="Excludes direct and debrid streams with no seeders."
              placeholder="Any"
              value={draft.minSeeders}
              onChange={(v) => setDraft((d) => ({ ...d, minSeeders: v }))}
            />
            <NumberSection
              title="Max size (GB)"
              sub="Caps file size. Unknown sizes still pass."
              placeholder="Any"
              value={draft.maxSizeGb}
              onChange={(v) => setDraft((d) => ({ ...d, maxSizeGb: v }))}
            />
          </div>

          {isFilterEmpty(draft) && (
            <p className="rounded-lg bg-raised/60 px-3.5 py-2.5 text-[12.5px] text-ink-muted">
              No dimensions set. This filter matches every stream.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-edge-soft px-6 pb-6 pt-4">
          {isEdit && onDelete ? (
            <button
              type="button"
              onClick={() => onDelete(draft.id)}
              className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-danger transition-colors hover:bg-danger/12"
            >
              <Trash2 size={15} />
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-ink-muted transition-colors hover:text-ink"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!canSave}
              className="flex items-center gap-1.5 rounded-xl bg-ink px-5 py-2.5 text-[13.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
            >
              <Check size={15} strokeWidth={2.6} />
              {isEdit ? "Save" : "Create"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
