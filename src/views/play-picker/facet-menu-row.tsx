import { FormatBadge, type BadgeKind } from "@/components/format-badge";
import { summarizeFilter, type CustomStreamFilter } from "@/lib/streams/custom-filters";
import { Check, ChevronDown, Pencil, Plus } from "lucide-react";
import { useState } from "react";

import { facetBadge } from "./filter-builder/badge-maps";
import type { FacetDim, FacetOption } from "./stream-facets";

export type FacetRowEntry = {
  dim: FacetDim;
  options: FacetOption[];
  total: number;
  value: string;
};

export function FacetMenuRow({
  facets,
  onFacet,
  filters,
  activeFilterId,
  onSelectFilter,
  onNewFilter,
  onEditFilter,
}: {
  facets: FacetRowEntry[];
  onFacet: (key: string, value: string) => void;
  filters: CustomStreamFilter[];
  activeFilterId: string | null;
  onSelectFilter: (id: string | null) => void;
  onNewFilter: () => void;
  onEditFilter: (filter: CustomStreamFilter) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const visible = facets.filter((f) => f.options.length >= 2 || f.value !== "all");
  const narrowed = facets.some((f) => f.value !== "all") || activeFilterId !== null;
  const reset = () => {
    for (const f of facets) if (f.value !== "all") onFacet(f.dim.key, "all");
    if (activeFilterId !== null) onSelectFilter(null);
    setOpenKey(null);
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {visible.map((f) => (
        <FacetMenu
          key={f.dim.key}
          entry={f}
          open={openKey === f.dim.key}
          onToggle={() => setOpenKey((k) => (k === f.dim.key ? null : f.dim.key))}
          onClose={() => setOpenKey(null)}
          onPick={(v) => {
            onFacet(f.dim.key, v);
            setOpenKey(null);
          }}
        />
      ))}
      {(visible.length > 0 || filters.length > 0) && <span className="mx-1 h-4 w-px shrink-0 bg-edge-soft" />}
      {filters.map((f) => (
        <SavedChip
          key={f.id}
          filter={f}
          active={activeFilterId === f.id}
          onToggle={() => onSelectFilter(activeFilterId === f.id ? null : f.id)}
          onEdit={() => onEditFilter(f)}
        />
      ))}
      <button
        type="button"
        onClick={onNewFilter}
        title={filters.length > 0 ? "New filter" : "Create a custom filter"}
        className="flex items-center gap-1 rounded-full bg-elevated/50 px-2.5 py-1.5 text-[12.5px] font-semibold text-ink-muted ring-1 ring-edge-soft/60 transition-colors hover:bg-elevated hover:text-ink"
      >
        <Plus size={13} strokeWidth={2.6} />
        {filters.length === 0 && "Filter"}
      </button>
      {narrowed && (
        <button
          type="button"
          onClick={reset}
          className="px-2 py-1.5 text-[11.5px] font-semibold text-ink-subtle transition-colors hover:text-ink"
        >
          Reset
        </button>
      )}
    </div>
  );
}

function FacetMenu({
  entry,
  open,
  onToggle,
  onClose,
  onPick,
}: {
  entry: FacetRowEntry;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onPick: (value: string) => void;
}) {
  const active = entry.value !== "all";
  const badgeSlot = entry.options.some((o) => facetBadge(entry.dim.key, o.key) !== null);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${
          active
            ? "bg-ink text-canvas"
            : "bg-elevated/50 text-ink-muted ring-1 ring-edge-soft/60 hover:bg-elevated hover:text-ink"
        }`}
      >
        {active ? entry.value : entry.dim.label}
        <ChevronDown
          size={12}
          strokeWidth={2.4}
          className={`transition-transform duration-150 ${open ? "rotate-180" : ""} ${
            active ? "text-canvas/70" : "text-ink-subtle"
          }`}
        />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="absolute start-0 top-full z-20 mt-1 min-w-[176px] rounded-xl bg-elevated p-1 ring-1 ring-edge shadow-[0_18px_44px_-14px_rgba(0,0,0,0.7)]">
            <MenuItem
              label="All"
              count={entry.total}
              selected={!active}
              badge={null}
              badgeSlot={badgeSlot}
              onClick={() => onPick("all")}
            />
            {entry.options.map((o) => (
              <MenuItem
                key={o.key}
                label={o.key}
                count={o.count}
                selected={entry.value === o.key}
                badge={facetBadge(entry.dim.key, o.key)}
                badgeSlot={badgeSlot}
                onClick={() => onPick(o.key)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MenuItem({
  label,
  count,
  selected,
  badge,
  badgeSlot,
  onClick,
}: {
  label: string;
  count: number;
  selected: boolean;
  badge: BadgeKind | null;
  badgeSlot: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-start text-[13px] transition-colors hover:bg-raised ${
        selected ? "font-semibold text-ink" : "text-ink-muted"
      }`}
    >
      {badgeSlot && (
        <span className="flex h-4 w-9 shrink-0 items-center overflow-hidden [&_img]:!h-4 [&_img]:!max-h-4 [&_img]:!w-auto">
          {badge && <FormatBadge kind={badge} size="sm" />}
        </span>
      )}
      <span className="flex-1 truncate">{label}</span>
      <span className="text-[11.5px] text-ink-subtle">{count}</span>
      <Check size={13} strokeWidth={2.6} className={selected ? "text-ink" : "invisible"} />
    </button>
  );
}

function SavedChip({
  filter,
  active,
  onToggle,
  onEdit,
}: {
  filter: CustomStreamFilter;
  active: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  return (
    <span
      className={`group flex items-center rounded-full text-[12.5px] font-semibold transition-colors ${
        active
          ? "bg-ink text-canvas"
          : "bg-elevated/50 text-ink-muted ring-1 ring-edge-soft/60 hover:bg-elevated hover:text-ink"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={active}
        title={summarizeFilter(filter)}
        className="max-w-[180px] truncate py-1.5 pe-1 ps-3"
      >
        {filter.name}
      </button>
      <button
        type="button"
        onClick={onEdit}
        aria-label={`Edit ${filter.name}`}
        className={`flex h-[26px] w-6 items-center justify-center rounded-full pe-1 transition-colors ${
          active ? "text-canvas/70 hover:text-canvas" : "text-ink-subtle hover:text-ink"
        }`}
      >
        <Pencil size={12} strokeWidth={2.2} />
      </button>
    </span>
  );
}
