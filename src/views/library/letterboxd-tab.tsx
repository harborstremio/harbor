import { useEffect, useMemo, useState } from "react";
import { useLetterboxd } from "@/lib/stremboxd/provider";
import { fetchFullModeCatalog, fetchStremboxdCatalog } from "@/lib/stremboxd/client";
import { stremboxdMetaToMeta } from "@/lib/stremboxd/to-meta";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import {
  applyFilter,
  countByType,
  FilterBar,
  GroupedGrid,
  SortControl,
  sortedGroups,
  type TypeKey,
  type WatchlistMerged,
} from "./shared";
import { useReportFeatured } from "./featured-context";

export function LetterboxdTab() {
  const tr = useT();
  const lb = useLetterboxd();
  const { settings } = useSettings();
  const [items, setItems] = useState<WatchlistMerged[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    if (!lb.isActive) {
      setItems([]);
      setStatus("ready");
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setItems([]);

    async function fetchWatchlist() {
      const catalogId = "letterboxd-watchlist";
      const useFull = !!lb.session;

      const page = useFull
        ? await fetchFullModeCatalog(lb.session!.userId, catalogId, 0)
        : await fetchStremboxdCatalog(lb.configSegment, catalogId, 0);

      if (cancelled) return;

      const entries: WatchlistMerged[] = page.metas.map((m) => {
        const meta = stremboxdMetaToMeta(m);
        return { key: `lb-wl-${meta.id}`, meta, date: null };
      });

      setItems(entries);
      setStatus("ready");
    }

    fetchWatchlist().catch(() => {
      if (!cancelled) setStatus("error");
    });

    return () => {
      cancelled = true;
    };
  }, [lb.isActive, lb.session, lb.configSegment]);

  const [type, setType] = useState<TypeKey>("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => countByType(items), [items]);
  const visible = useMemo(() => applyFilter(items, type, query), [items, type, query]);
  useReportFeatured(useMemo(() => visible.map((v) => v.meta), [visible]));

  return (
    <section className="flex flex-col gap-6">
      {items.length > 0 && (
        <FilterBar
          type={type}
          setType={setType}
          query={query}
          setQuery={setQuery}
          counts={counts}
          trailing={<SortControl />}
        />
      )}

      {status === "loading" && <p className="text-[13px] text-ink-muted">{tr("Loading…")}</p>}
      {status === "error" && (
        <p className="rounded-lg bg-danger/15 px-3 py-2 text-[12px] text-danger ring-1 ring-danger/30">
          {tr("Couldn't reach Letterboxd. Try refreshing.")}
        </p>
      )}
      {status === "ready" && items.length === 0 && (
        <p className="text-[13px] text-ink-muted">{tr("Your Letterboxd watchlist is empty.")}</p>
      )}
      {status === "ready" && visible.length === 0 && items.length > 0 && (
        <p className="text-[13px] text-ink-muted">{tr("No matches for these filters.")}</p>
      )}

      {visible.length > 0 && <GroupedGrid groups={sortedGroups(visible, settings.librarySort)} />}
    </section>
  );
}
