import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Languages } from "lucide-react";
import { useT } from "@/lib/i18n";
import { activeMangaSource } from "@/lib/manga/sources";
import { languageName } from "@/lib/manga/types";
import {
  ALL_LANGS,
  cachedSuwayomiSources,
  isAgnosticLang,
  loadMangaLangFilter,
  saveMangaLangFilter,
  subscribeMangaLangFilter,
} from "./langs";
import { TRIGGER, useOutsideClose } from "./filters";

function toggleLang(current: string[], code: string): string[] {
  const base = current.includes(ALL_LANGS) ? [] : [...current];
  const next = base.includes(code) ? base.filter((c) => c !== code) : [...base, code];
  return next.length > 0 ? next : [ALL_LANGS];
}

export function LanguageDropdown() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const serverBase = activeMangaSource()?.baseUrl;
  const [filter, setFilter] = useState<string[]>(() => loadMangaLangFilter(serverBase));
  const [langs, setLangs] = useState<string[] | null>(null);
  const ref = useOutsideClose(open, () => setOpen(false));

  useEffect(() => setFilter(loadMangaLangFilter(serverBase)), [serverBase]);

  useEffect(
    () =>
      subscribeMangaLangFilter(() => {
        setFilter(loadMangaLangFilter(serverBase));
      }),
    [serverBase],
  );

  useEffect(() => {
    if (!open) return;
    const source = activeMangaSource();
    if (!source || source.kind !== "suwayomi") return;
    let alive = true;
    cachedSuwayomiSources({ baseUrl: source.baseUrl })
      .then((list) => {
        if (!alive) return;
        const unique = new Set<string>();
        for (const s of list) {
          if (s.lang && !isAgnosticLang(s.lang)) unique.add(s.lang);
        }
        setLangs([...unique].sort((a, b) => languageName(a).localeCompare(languageName(b))));
      })
      .catch(() => {
        if (alive) setLangs([]);
      });
    return () => {
      alive = false;
    };
  }, [open]);

  const isAll = filter.includes(ALL_LANGS);
  const summary = isAll ? t("All") : t("{n} selected", { n: filter.length });

  const rows = useMemo(
    () =>
      (langs ?? [])
        .map((code) => ({
          code,
          badge: code.split(/[-_]/)[0].toUpperCase(),
          name: languageName(code),
          checked: !isAll && filter.includes(code),
        }))
        .sort((a, b) => Number(b.checked) - Number(a.checked) || a.name.localeCompare(b.name)),
    [langs, filter, isAll],
  );

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className={TRIGGER}>
        <Languages size={15} className="text-ink-subtle" />
        <span className="max-w-[140px] truncate font-medium">{summary}</span>
        <ChevronDown size={14} className="text-ink-subtle" />
      </button>
      {open && (
        <div className="absolute start-0 z-30 mt-1.5 max-h-[320px] min-w-[220px] overflow-y-auto rounded-lg border border-edge-soft bg-raised py-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)]">
          <button
            type="button"
            onClick={() => saveMangaLangFilter([ALL_LANGS], serverBase)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-[13px] text-ink hover:bg-elevated/60"
          >
            <span>{t("All languages")}</span>
            {isAll && <Check size={14} className="text-accent" />}
          </button>
          <div className="my-1 border-t border-edge-soft/60" />
          {langs == null && (
            <p className="px-3 py-2 text-[12.5px] text-ink-subtle">{t("Loading…")}</p>
          )}
          {rows.map((row) => (
            <button
              key={row.code}
              type="button"
              onClick={() => saveMangaLangFilter(toggleLang(filter, row.code), serverBase)}
              className="flex w-full items-center justify-between gap-3 px-3 py-2 text-start text-[13px] text-ink hover:bg-elevated/60"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="w-7 shrink-0 text-center text-[10px] font-bold tracking-wide text-white"
                >
                  {row.badge}
                </span>
                <span className="truncate">{row.name}</span>
              </span>
              {row.checked && <Check size={14} className="text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
