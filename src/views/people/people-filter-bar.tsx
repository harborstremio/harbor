import { Search } from "@/components/icons/search-icon";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Dropdown } from "@/components/dropdown";
import { type PeopleDept } from "@/lib/harbor-rank";
import { useT } from "@/lib/i18n";

const DEPTS: Array<{ id: PeopleDept; label: string }> = [
  { id: "Acting", label: "Actors" },
  { id: "Directing", label: "Directors" },
  { id: "Production", label: "Producers" },
  { id: "Writing", label: "Writers" },
];

const GENRES = [
  "Action", "Adventure", "Animation", "Comedy", "Crime", "Documentary", "Drama",
  "Family", "Fantasy", "History", "Horror", "Music", "Mystery", "Romance",
  "Science Fiction", "Thriller", "War", "Western",
];

export function PeopleFilterBar({
  dept,
  onDept,
  country,
  onCountry,
  genre,
  onGenre,
  query,
  onQuery,
  countries,
  resultCount,
}: {
  dept: PeopleDept;
  onDept: (d: PeopleDept) => void;
  country: string | null;
  onCountry: (iso: string | null) => void;
  genre: string | null;
  onGenre: (g: string | null) => void;
  query: string;
  onQuery: (q: string) => void;
  countries: Array<{ iso: string; name: string }>;
  resultCount: { shown: number; total: number } | null;
}) {
  const t = useT();
  const listRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [ind, setInd] = useState<{ left: number; width: number }>({ left: 0, width: 0 });
  const [armed, setArmed] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const el = btnRefs.current[dept];
      const wrap = listRef.current;
      if (!el || !wrap) return;
      const e = el.getBoundingClientRect();
      const w = wrap.getBoundingClientRect();
      const left = e.left - w.left;
      const width = e.width;
      setInd((prev) => (prev.left === left && prev.width === width ? prev : { left, width }));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [dept]);

  useEffect(() => {
    if (ind.width === 0 || armed) return;
    const raf = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(raf);
  }, [ind.width, armed]);

  return (
    <div className="flex flex-col gap-1 pb-1">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3 py-3">
        <div
          ref={listRef}
          role="tablist"
          aria-label={t("Department")}
          className="relative flex items-center gap-1"
        >
          {DEPTS.map((d) => {
            const active = d.id === dept;
            return (
              <button
                key={d.id}
                ref={(el) => {
                  btnRefs.current[d.id] = el;
                }}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onDept(d.id)}
                className={`flex h-11 items-center px-3 text-[13px] font-semibold tracking-tight transition-colors ease-out motion-reduce:transition-none ${
                  active ? "text-accent" : "text-ink-muted hover:text-ink"
                }`}
              >
                {t(d.label)}
              </button>
            );
          })}
          <span
            aria-hidden
            className={`pointer-events-none absolute bottom-0 h-[2px] rounded-full bg-accent ${
              armed ? "transition-[left,width] duration-250 ease-out motion-reduce:transition-none" : ""
            }`}
            style={{ left: ind.left, width: ind.width }}
          />
        </div>

        <div className="flex flex-wrap items-start gap-x-4 gap-y-3 ms-auto">
          <Dropdown
            value={genre ?? ""}
            onChange={(v) => onGenre(v || null)}
            options={[{ value: "", label: t("All genres") }, ...GENRES.map((g) => ({ value: g, label: t(g) }))]}
            className="w-[150px]"
          />

          <div className="flex flex-col gap-1">
            <Dropdown
              value={country ?? ""}
              onChange={(v) => onCountry(v || null)}
              options={[{ value: "", label: t("All countries") }, ...countries.map((c) => ({ value: c.iso, label: c.name }))]}
              className="w-[178px]"
            />
            <span className="ps-1 text-[11px] leading-tight text-ink-subtle whitespace-nowrap">
              {t("Birthplace, not nationality")}
            </span>
          </div>

          <div className="flex h-11 items-center gap-2 rounded-full bg-canvas/60 px-3.5 ring-1 ring-edge-soft transition-shadow focus-within:ring-ink-subtle motion-reduce:transition-none">
            <Search size={14} className="text-ink-subtle" strokeWidth={2} />
            <input
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={t("Filter by name or title")}
              spellCheck={false}
              className="h-full w-52 bg-transparent text-[13px] text-ink outline-none placeholder:text-ink-subtle/60"
            />
          </div>

        </div>
      </div>
      {resultCount && (
        <p className="text-[11px] tabular-nums text-ink-subtle">
          {t("{n} of {total}", { n: String(resultCount.shown), total: String(resultCount.total) })}
        </p>
      )}
    </div>
  );
}
