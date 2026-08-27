import { Check, Plus, Search as SearchIcon, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Meta } from "@/lib/cinemeta";
import { addToList, MAX_ITEMS, type CustomList } from "@/lib/custom-lists";
import { useT } from "@/lib/i18n";
import { searchAll, type AnimeHit, type SearchResults } from "@/lib/search";
import { useSettings } from "@/lib/settings";
import { emitListToast } from "@/components/lists/list-toast";
import { Poster } from "@/components/poster";

import { releaseText } from "@/lib/release-info";
function animeToMeta(a: AnimeHit): Meta {
  return {
    id: a.kitsuId ? `kitsu:${a.kitsuId}` : `mal:${a.malId}`,
    type: "series",
    name: a.name,
    poster: a.poster ?? undefined,
    releaseInfo: a.year ?? undefined,
  };
}

export function AddTitleSearch({ list }: { list: CustomList }) {
  const t = useT();
  const { settings } = useSettings();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const memberIds = new Set(list.items.map((it) => it.id));
  const atMax = list.items.length >= MAX_ITEMS;

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchAll(settings.tmdbKey ?? "", q)
        .then((r) => {
          if (!cancelled) {
            setResults(r);
            setLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setLoading(false);
        });
    }, 260);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, settings.tmdbKey]);

  const hits: Meta[] = [
    ...(results?.movies ?? []),
    ...(results?.series ?? []),
    ...(results?.anime ?? []).map(animeToMeta),
  ].slice(0, 24);

  const add = (m: Meta) => {
    if (atMax) {
      emitListToast(t("This list is full ({max} items)", { max: MAX_ITEMS }));
      return;
    }
    addToList(list.id, {
      id: m.id,
      type: m.type,
      name: m.name,
      poster: m.poster,
      addonOrigin: m.addonOrigin,
      videos: m.videos,
    });
    emitListToast(t('Added to "{name}"', { name: list.name }));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon
          size={17}
          strokeWidth={2.2}
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-subtle"
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Add a movie or show to this list...")}
          className="h-12 w-full rounded-full bg-elevated/40 pl-11 pr-11 text-[14px] text-ink outline-none ring-1 ring-edge-soft/60 transition-shadow placeholder:text-ink-subtle focus:ring-edge"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label={t("Clear")}
            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={16} strokeWidth={2.3} />
          </button>
        )}
      </div>

      {query.trim() && (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-edge-soft bg-surface">
          {loading && hits.length === 0 ? (
            <p className="px-4 py-4 text-[13px] text-ink-muted">{t("Searching...")}</p>
          ) : hits.length === 0 ? (
            <p className="px-4 py-4 text-[13px] text-ink-muted">
              {t("No matches. Try another title.")}
            </p>
          ) : (
            <div className="max-h-[360px] overflow-y-auto py-1.5">
              {hits.map((m) => {
                const inList = memberIds.has(m.id);
                return (
                  <button
                    key={m.id}
                    onClick={() => !inList && add(m)}
                    disabled={inList}
                    className="flex w-full items-center gap-3 px-3 py-2 text-start transition-colors hover:bg-elevated disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className="w-9 shrink-0 overflow-hidden rounded-md">
                      <Poster src={m.poster} seed={m.id} ratio="portrait" className="!rounded-md" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-[13.5px] font-medium text-ink">{m.name}</span>
                      <span className="text-[11.5px] text-ink-subtle">
                        {m.type === "movie" ? t("Movie") : t("Series")}
                        {releaseText(m.releaseInfo)
                          ? ` · ${releaseText(m.releaseInfo).slice(0, 4)}`
                          : ""}
                      </span>
                    </span>
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        inList ? "text-accent" : "border border-edge text-ink-muted"
                      }`}
                    >
                      {inList ? (
                        <Check size={16} strokeWidth={2.6} />
                      ) : (
                        <Plus size={16} strokeWidth={2.2} />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
