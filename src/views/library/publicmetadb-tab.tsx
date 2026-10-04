import { useEffect, useMemo, useState } from "react";
import { fetchPmdbWatchlist, pmdbWatchlistItemToMeta } from "@/lib/publicmetadb/watchlist";
import type { PmdbListItem } from "@/lib/publicmetadb/types";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import {
  applyFilter,
  countByType,
  FilterBar,
  GroupedGrid,
  parseTs,
  SortControl,
  sortedGroups,
  type TypeKey,
  type WatchlistMerged,
} from "./shared";
import { useReportFeatured } from "./featured-context";

export function PublicMetaDbTab() {
  const tr = useT();
  const { settings } = useSettings();
  const [items, setItems] = useState<PmdbListItem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    fetchPmdbWatchlist()
      .then((list) => {
        if (cancelled) return;
        setItems(list);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = useMemo<WatchlistMerged[]>(
    () =>
      items
        .map((item) => {
          const meta = pmdbWatchlistItemToMeta(item);
          if (!meta) return null;
          return { key: `pmdb-${item.id}`, meta, date: parseTs(item.created) };
        })
        .filter((x): x is WatchlistMerged => !!x),
    [items],
  );

  const [type, setType] = useState<TypeKey>("all");
  const [query, setQuery] = useState("");
  const counts = useMemo(() => countByType(entries), [entries]);
  const visible = useMemo(() => applyFilter(entries, type, query), [entries, type, query]);
  useReportFeatured(useMemo(() => visible.map((v) => v.meta), [visible]));

  return (
    <section className="flex flex-col gap-10">
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[18px] font-semibold text-ink">{tr("PublicMetaDB watchlist")}</h2>
          <span className="text-[12px] text-ink-muted">
            {tr("{shown} of {total}", { shown: visible.length, total: entries.length })}
          </span>
        </div>
        {entries.length > 0 && (
          <FilterBar
            type={type}
            setType={setType}
            query={query}
            setQuery={setQuery}
            counts={counts}
            trailing={<SortControl />}
          />
        )}
        {status === "loading" ? (
          <p className="text-[13px] text-ink-muted">{tr("Loading…")}</p>
        ) : visible.length === 0 ? (
          <p className="text-[13px] text-ink-muted">
            {entries.length === 0
              ? tr("Nothing saved on PublicMetaDB yet.")
              : tr("No matches for these filters.")}
          </p>
        ) : (
          <GroupedGrid groups={sortedGroups(visible, settings.librarySort)} />
        )}
      </div>
      {status === "error" && (
        <p className="rounded-lg bg-danger/15 px-3 py-2 text-[12px] text-danger ring-1 ring-danger/30">
          {tr("Couldn't reach PublicMetaDB. Try refreshing.")}
        </p>
      )}
    </section>
  );
}
