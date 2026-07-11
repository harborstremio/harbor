import { useT } from "@/lib/i18n";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  COUNTRY_OPTIONS,
  LANGUAGE_OPTIONS,
  RATING_OPTIONS,
  SORT_OPTIONS,
  VOTES_OPTIONS,
  YEAR_OPTIONS,
  genreNamesFor,
  hasActiveFilters,
  type GenreFilters,
  type Option,
} from "./genre-filter-model";

function GenreSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (v: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);
  const current = options.find((o) => o.value === value) ?? options[0];
  const active = Boolean(value);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-medium ring-1 transition-colors ${
          active
            ? "bg-white/[0.14] text-white ring-white/20"
            : "bg-white/[0.06] text-white/80 ring-white/10 hover:bg-white/10 hover:text-white"
        }`}
      >
        <span className="text-white/40">{t(label)}</span>
        <span>{t(current.label)}</span>
        <ChevronDown
          size={13}
          strokeWidth={2.3}
          className={`text-white/45 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-40 max-h-64 w-max min-w-[132px] overflow-y-auto rounded-xl bg-neutral-900 p-1 ring-1 ring-white/12 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.85)] [scrollbar-width:thin]">
          {options.map((o) => {
            const selected = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`block w-full rounded-lg px-3 py-1.5 text-start text-[13px] transition-colors ${
                  selected
                    ? "bg-white/[0.14] font-semibold text-white"
                    : "text-white/70 hover:bg-white/[0.08] hover:text-white"
                }`}
              >
                {t(o.label)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MediaToggle({
  mediaType,
  onMediaType,
}: {
  mediaType: "movie" | "tv";
  onMediaType: (mt: "movie" | "tv") => void;
}) {
  const t = useT();
  return (
    <div className="inline-flex shrink-0 gap-0.5 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10">
      {(["movie", "tv"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onMediaType(m)}
          className={`rounded-full px-3.5 py-1 text-[12.5px] font-semibold transition-colors ${
            mediaType === m ? "bg-white text-black" : "text-white/60 hover:text-white"
          }`}
        >
          {m === "movie" ? t("Movies") : t("Shows")}
        </button>
      ))}
    </div>
  );
}

function GenreChips({
  mediaType,
  genreName,
  onGenre,
}: {
  mediaType: "movie" | "tv";
  genreName: string;
  onGenre: (name: string) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-2">
      {genreNamesFor(mediaType).map((name) => {
        const active = name === genreName;
        return (
          <button
            key={name}
            type="button"
            onClick={() => onGenre(name)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
              active
                ? "bg-white text-black"
                : "bg-white/[0.06] text-white/70 ring-1 ring-white/10 hover:bg-white/12 hover:text-white"
            }`}
          >
            {t(name)}
          </button>
        );
      })}
    </div>
  );
}

export function GenreToolbar({
  mediaType,
  genreName,
  filters,
  onMediaType,
  onGenre,
  onFilters,
  onClear,
}: {
  mediaType: "movie" | "tv";
  genreName: string;
  filters: GenreFilters;
  onMediaType: (mt: "movie" | "tv") => void;
  onGenre: (name: string) => void;
  onFilters: (patch: Partial<GenreFilters>) => void;
  onClear: () => void;
}) {
  const t = useT();
  const dirty = hasActiveFilters(filters);
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[22px] font-semibold text-white">{t(genreName)}</h2>
        <MediaToggle mediaType={mediaType} onMediaType={onMediaType} />
      </div>

      <GenreChips mediaType={mediaType} genreName={genreName} onGenre={onGenre} />

      <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-3.5">
        <span className="mr-0.5 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-white/35">
          <SlidersHorizontal size={13} strokeWidth={2.2} />
          {t("Refine")}
        </span>
        <GenreSelect
          label="From"
          value={filters.yearFrom}
          options={YEAR_OPTIONS}
          onChange={(v) => onFilters({ yearFrom: v })}
        />
        <GenreSelect
          label="To"
          value={filters.yearTo}
          options={YEAR_OPTIONS}
          onChange={(v) => onFilters({ yearTo: v })}
        />
        <GenreSelect
          label="Rating"
          value={filters.minRating}
          options={RATING_OPTIONS}
          onChange={(v) => onFilters({ minRating: v })}
        />
        <GenreSelect
          label="Votes"
          value={filters.minVotes}
          options={VOTES_OPTIONS}
          onChange={(v) => onFilters({ minVotes: v })}
        />
        <GenreSelect
          label="Language"
          value={filters.language}
          options={LANGUAGE_OPTIONS}
          onChange={(v) => onFilters({ language: v })}
        />
        <GenreSelect
          label="Country"
          value={filters.country}
          options={COUNTRY_OPTIONS}
          onChange={(v) => onFilters({ country: v })}
        />
        <GenreSelect
          label="Sort"
          value={filters.sort}
          options={SORT_OPTIONS}
          onChange={(v) => onFilters({ sort: v })}
        />
        {dirty && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[12.5px] font-medium text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={13} strokeWidth={2.4} />
            {t("Clear")}
          </button>
        )}
      </div>
    </div>
  );
}
