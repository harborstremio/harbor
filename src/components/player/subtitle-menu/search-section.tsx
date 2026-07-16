import { Check, ChevronDown, Loader2, Plus, Save, Search as SearchIcon } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Flag } from "@/components/flag";
import { useAuth } from "@/lib/auth";
import type { Addon } from "@/lib/addons";
import { useContextMenu } from "@/lib/context-menu";
import { gatherSubtitleAddons } from "@/lib/subtitles/addon-source";
import { languageName } from "@/lib/subtitles/language";
import { saveSubtitleToDisk } from "@/lib/subtitles/save-to-disk";
import { searchSubtitles } from "@/lib/subtitles/search";
import type { SubResult } from "@/lib/subtitles/types";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import type { SubtitleMenuProps } from "./types";
import { isVeryNewRelease } from "./utils";

export function SearchSection(props: SubtitleMenuProps) {
  const t = useT();
  const { metaImdbId, metaTitle, season, episode, onAddSubtitle } = props;
  const { settings } = useSettings();
  const { authKey } = useAuth();
  const [query, setQuery] = useState(
    metaTitle && season != null && episode != null
      ? `${metaTitle} S${String(season).padStart(2, "0")}E${String(episode).padStart(2, "0")}`
      : (metaTitle ?? ""),
  );
  const [results, setResults] = useState<SubResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [hideHI, setHideHI] = useState(false);
  const [forcedOnly, setForcedOnly] = useState(false);
  const [addons, setAddons] = useState<Addon[] | null>(null);
  const [addonsLoading, setAddonsLoading] = useState(true);
  const initialSearchDone = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setAddonsLoading(true);
    gatherSubtitleAddons(authKey)
      .then((a) => {
        if (!cancelled) {
          setAddons(a);
          setAddonsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAddons([]);
          setAddonsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [authKey]);

  useEffect(() => {
    // Only run initial auto-search once, after addons are loaded
    if (!metaImdbId || addons === null || addonsLoading || initialSearchDone.current) return;
    initialSearchDone.current = true;
    void run();
  }, [metaImdbId, addons, addonsLoading]);

  const run = async () => {
    setLoading(true);
    setResults(null);
    try {
      const enabled = settings.subProvidersEnabled ?? {};
      const searchQuery = {
        imdbId: metaImdbId ?? undefined,
        title: !metaImdbId ? query : undefined,
        season: season ?? undefined,
        episode: episode ?? undefined,
        langs: settings.preferredSubLangs ?? [],
      };
      const searchOpts = {
        providers: {
          wyzie: enabled.wyzie === true,
          addons: enabled.addons ?? true,
          opensubtitles: enabled.opensubtitles ?? true,
        },
        addons: addons ?? [],
        preferredLangs: settings.preferredSubLangs ?? [],
      };

      // Log search attempt for debugging (will appear in terminal)
      console.log("[SUBTITLES SEARCH] Starting with:", {
        hasImdbId: !!metaImdbId,
        addonsCount: addons?.length ?? 0,
        providers: searchOpts.providers,
        query: searchQuery,
      });

      const r = await searchSubtitles(searchQuery, searchOpts);

      // Log results by source (will appear in terminal)
      const bySource = r.reduce(
        (acc, sub) => {
          acc[sub.source] = (acc[sub.source] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      );
      console.log("[SUBTITLES SEARCH] Complete:", {
        total: r.length,
        bySource,
        addonResults: bySource.addon || 0,
        opensubtitlesResults: bySource.opensubtitles || 0,
      });

      setResults(r);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    if (!results) return null;
    return results.filter((r) => {
      if (hideHI && r.hearingImpaired) return false;
      if (forcedOnly && !r.forced) return false;
      return true;
    });
  }, [results, hideHI, forcedOnly]);

  const grouped = useMemo(() => {
    if (!filtered) return [] as Array<{ lang: string; items: SubResult[] }>;
    const m = new Map<string, SubResult[]>();
    for (const r of filtered) {
      const key = languageName(r.lang);
      const list = m.get(key) ?? [];
      list.push(r);
      m.set(key, list);
    }
    return [...m.entries()].map(([lang, items]) => ({ lang, items }));
  }, [filtered]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-2 px-4 py-3">
        <div className="relative flex-1">
          <SearchIcon
            size={14}
            strokeWidth={2.2}
            className="absolute start-3 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void run();
            }}
            placeholder={metaImdbId ? t("Refine search") : t("Title")}
            className="h-9 w-full rounded-lg border border-edge-soft bg-canvas/60 ps-9 pe-3 text-[13.5px] text-ink placeholder:text-ink-subtle focus:border-edge focus:outline-none"
          />
        </div>
        <button
          onClick={() => void run()}
          disabled={loading || (!metaImdbId && !query.trim())}
          className="flex h-9 items-center gap-1.5 rounded-lg bg-elevated px-4 text-[13px] font-semibold text-ink ring-1 ring-edge transition-colors hover:bg-raised disabled:opacity-40"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : t("Search")}
        </button>
      </div>

      {results && results.length > 0 && (
        <div className="flex items-center gap-1.5 px-4 pb-2.5">
          <FilterChip active={!hideHI} onClick={() => setHideHI((v) => !v)}>
            {t("Show HI/SDH")}
          </FilterChip>
          <FilterChip active={forcedOnly} onClick={() => setForcedOnly((v) => !v)}>
            {t("Forced only")}
          </FilterChip>
          <span className="ms-auto text-[11.5px] tabular-nums text-ink-subtle">
            {t("{shown} of {total}", { shown: filtered?.length ?? 0, total: results.length })}
          </span>
        </div>
      )}

      {loading && results == null && (
        <p className="flex items-center gap-2 px-4 py-3 text-[13px] text-ink-muted">
          <Loader2 size={14} className="animate-spin" />
          {addonsLoading
            ? t("Loading subtitle addons…")
            : t("Searching {count} sources…", { count: 1 + (addons?.length ?? 0) })}
        </p>
      )}
      {results !== null && results.length === 0 && (
        <p className="px-4 py-3 text-[13px] text-ink-muted">
          {isVeryNewRelease(props.metaReleaseDate)
            ? t("Movie's too new. Subtitles haven't been published yet.")
            : t("No subtitles found.")}
        </p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {grouped.map(({ lang, items }, i) => (
          <LangGroup
            key={lang}
            lang={lang}
            items={items}
            defaultOpen={i === 0}
            onAdd={(r) =>
              onAddSubtitle(r.url, r.lang, r.title, {
                format: r.format,
                encoding: r.encoding,
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

function LangGroup({
  lang,
  items,
  defaultOpen,
  onAdd,
}: {
  lang: string;
  items: SubResult[];
  defaultOpen: boolean;
  onAdd: (r: SubResult) => void | Promise<boolean | void>;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-edge-soft/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 bg-canvas/40 px-4 py-2 text-start transition-colors hover:bg-canvas/60"
      >
        <Flag language={lang} size="sm" showLabel={false} />
        <span className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-ink-muted">
          {lang}
        </span>
        <span className="text-[11px] tabular-nums text-ink-subtle">{items.length}</span>
        <ChevronDown
          size={14}
          strokeWidth={2.4}
          className={`ms-auto shrink-0 text-ink-subtle transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
        />
      </button>
      {open &&
        items
          .slice(0, 30)
          .map((r) => <ResultRow key={r.id} result={r} lang={lang} onAdd={() => onAdd(r)} />)}
    </div>
  );
}

function ResultRow({
  result,
  lang,
  onAdd,
}: {
  result: SubResult;
  lang: string;
  onAdd: () => void | Promise<boolean | void>;
}) {
  const t = useT();
  const { open } = useContextMenu();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const timer = useRef<number | null>(null);
  const addTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      if (addTimer.current !== null) window.clearTimeout(addTimer.current);
    },
    [],
  );

  const handleAdd = async () => {
    if (adding) return;
    setAdding(true);
    try {
      const ok = await Promise.resolve(onAdd());
      if (ok !== false) {
        setAdded(true);
        if (addTimer.current !== null) window.clearTimeout(addTimer.current);
        addTimer.current = window.setTimeout(() => setAdded(false), 2600);
      }
    } finally {
      setAdding(false);
    }
  };

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const ok = await saveSubtitleToDisk(result.url, {
        title: result.title,
        lang: result.lang,
        format: result.format,
        label: t("Subtitle"),
      });
      if (ok) {
        setSaved(true);
        if (timer.current !== null) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setSaved(false), 1400);
      }
    } catch {
      /* noop */
    } finally {
      setBusy(false);
    }
  };

  // Enhanced source display with color coding
  const sourceColor =
    {
      addon: "text-blue-400",
      opensubtitles: "text-emerald-400",
      wyzie: "text-purple-400",
      jimaku: "text-amber-400",
    }[result.source] || "text-ink-subtle";

  return (
    <div
      onContextMenu={(e) => open(e, { kind: "subtitle", label: result.title || lang, download })}
      className={`group flex w-full items-start gap-3 px-4 py-2.5 transition-colors duration-300 ${
        added ? "bg-emerald-400/12" : "hover:bg-canvas/60"
      }`}
    >
      <button onClick={handleAdd} className="flex min-w-0 flex-1 items-start gap-3 text-start">
        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
          {adding ? (
            <Loader2 size={14} className="animate-spin text-ink-subtle" />
          ) : added ? (
            <Check
              size={15}
              strokeWidth={2.6}
              className="text-emerald-400 animate-in zoom-in-50 duration-200"
            />
          ) : (
            <Plus
              size={14}
              strokeWidth={2.4}
              className="text-ink-subtle transition-colors group-hover:text-ink"
            />
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13.5px] text-ink">{result.title || lang}</span>
            {added && (
              <span className="shrink-0 rounded bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-300 animate-in fade-in slide-in-from-left-1 duration-200">
                {t("Added")}
              </span>
            )}
          </span>
          <span className="flex items-center gap-2 text-[11.5px] text-ink-subtle">
            <span className={`font-semibold capitalize ${sourceColor}`}>{result.source}</span>
            {result.format && (
              <>
                <span aria-hidden>·</span>
                <span className="uppercase">{result.format}</span>
              </>
            )}
            {typeof result.downloads === "number" && result.downloads > 0 && (
              <>
                <span aria-hidden>·</span>
                <span>{t("{count} dl", { count: compactNumber(result.downloads) })}</span>
              </>
            )}
            {result.hearingImpaired && (
              <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-amber-200">
                {t("HI/SDH")}
              </span>
            )}
            {result.forced && (
              <span className="rounded bg-sky-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sky-200">
                {t("Forced")}
              </span>
            )}
          </span>
        </div>
      </button>
      <span
        role="button"
        tabIndex={0}
        title={saved ? t("Saved to disk") : t("Download to disk")}
        aria-label={t("Download subtitle to disk")}
        onClick={(e) => {
          e.stopPropagation();
          void download();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            void download();
          }
        }}
        className={`mt-0.5 inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md transition-colors ${
          saved ? "text-accent" : "text-ink-subtle hover:bg-elevated hover:text-ink"
        }`}
      >
        {busy ? (
          <Loader2 size={13} className="animate-spin" />
        ) : saved ? (
          <Check size={13} strokeWidth={2.4} />
        ) : (
          <Save size={13} strokeWidth={2} />
        )}
      </span>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-7 items-center rounded-full px-2.5 text-[11.5px] font-semibold transition-colors ${
        active
          ? "bg-elevated text-ink ring-1 ring-edge"
          : "bg-raised text-ink-muted hover:bg-elevated/80"
      }`}
    >
      {children}
    </button>
  );
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}
