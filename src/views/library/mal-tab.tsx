import { useT } from "@/lib/i18n";
import { fetchMalList, readCachedMalList } from "@/lib/mal/lists";
import { deleteListEntry, saveListEntry } from "@/lib/mal/mutations";
import { useMal } from "@/lib/mal/provider";
import type { MalListEntry, MalListStatus } from "@/lib/mal/types";
import { useCallback, useEffect, useMemo, useState } from "react";

import { MalEntryCard } from "./mal-entry-card";
import { FilterBar, Grid, type TypeKey } from "./shared";

const MAL_RAIL_ORDER: Array<{ key: string; title: string; statuses: MalListStatus[] }> = [
  { key: "watching", title: "Watching", statuses: ["watching"] },
  { key: "planning", title: "Plan to Watch", statuses: ["plan_to_watch"] },
  { key: "completed", title: "Completed", statuses: ["completed"] },
  { key: "paused", title: "On Hold", statuses: ["on_hold"] },
  { key: "dropped", title: "Dropped", statuses: ["dropped"] },
];

function entryName(e: MalListEntry): string {
  return e.anime.title || "";
}

function entryType(e: MalListEntry): "movie" | "series" {
  return e.anime.mediaType === "movie" ? "movie" : "series";
}

export function MalTab() {
  const t = useT();
  const { isConnected } = useMal();
  const [entries, setEntries] = useState<MalListEntry[]>(() =>
    isConnected ? (readCachedMalList()?.flatMap((g) => g.entries) ?? []) : [],
  );
  const [status, setStatus] = useState<"loading" | "ready" | "error">(() =>
    isConnected && readCachedMalList() != null ? "ready" : "loading",
  );
  const [type, setType] = useState<TypeKey>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (!isConnected) return;
    let cancelled = false;
    const cached = readCachedMalList();
    if (cached) {
      setEntries(cached.flatMap((g) => g.entries));
      setStatus("ready");
    } else {
      setStatus("loading");
    }
    fetchMalList()
      .then((groups) => {
        if (cancelled) return;
        setEntries(groups.flatMap((g) => g.entries));
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled && readCachedMalList() == null) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [isConnected]);

  const setBusyFor = useCallback((id: number, on: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const applyLocal = useCallback((id: number, patch: Partial<MalListEntry>) => {
    setEntries((prev) => prev.map((e) => (e.anime.id === id ? { ...e, ...patch } : e)));
  }, []);

  const commitStatus = useCallback(
    async (entry: MalListEntry, next: MalListStatus) => {
      setBusyFor(entry.anime.id, true);
      const total = entry.anime.numEpisodes;
      const completing = next === "completed" && total != null;
      applyLocal(entry.anime.id, {
        status: next,
        ...(completing ? { numEpisodesWatched: total } : {}),
      } as Partial<MalListEntry>);
      try {
        const saved = await saveListEntry({
          malId: entry.anime.id,
          status: next,
          ...(completing ? { numEpisodesWatched: total } : {}),
        });
        applyLocal(entry.anime.id, {
          status: saved.status,
          numEpisodesWatched: saved.numEpisodesWatched,
        } as Partial<MalListEntry>);
      } catch {
        applyLocal(entry.anime.id, {
          status: entry.status,
          numEpisodesWatched: entry.numEpisodesWatched,
        } as Partial<MalListEntry>);
      } finally {
        setBusyFor(entry.anime.id, false);
      }
    },
    [applyLocal, setBusyFor],
  );

  const commitProgress = useCallback(
    async (entry: MalListEntry, next: number) => {
      setBusyFor(entry.anime.id, true);
      applyLocal(entry.anime.id, { numEpisodesWatched: next } as Partial<MalListEntry>);
      try {
        const saved = await saveListEntry({ malId: entry.anime.id, numEpisodesWatched: next });
        applyLocal(entry.anime.id, {
          status: saved.status,
          numEpisodesWatched: saved.numEpisodesWatched,
        } as Partial<MalListEntry>);
      } catch {
        applyLocal(entry.anime.id, { numEpisodesWatched: entry.numEpisodesWatched } as Partial<MalListEntry>);
      } finally {
        setBusyFor(entry.anime.id, false);
      }
    },
    [applyLocal, setBusyFor],
  );

  const commitRemove = useCallback(
    async (entry: MalListEntry) => {
      setBusyFor(entry.anime.id, true);
      setEntries((prev) => prev.filter((e) => e.anime.id !== entry.anime.id));
      try {
        await deleteListEntry(entry.anime.id);
      } catch {
        setEntries((prev) => (prev.some((e) => e.anime.id === entry.anime.id) ? prev : [...prev, entry]));
      } finally {
        setBusyFor(entry.anime.id, false);
      }
    },
    [setBusyFor],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (type !== "all" && entryType(e) !== type) return false;
      if (q && !entryName(e).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [entries, type, query]);

  const counts = useMemo(
    () => ({
      all: visible.length,
      movie: visible.filter((e) => entryType(e) === "movie").length,
      series: visible.filter((e) => entryType(e) === "series").length,
    }),
    [visible],
  );

  if (status === "loading") {
    return <p className="text-[13px] text-ink-muted">{t("Loading your MyAnimeList…")}</p>;
  }
  if (status === "error") {
    return (
      <p className="rounded-lg bg-danger/15 px-3 py-2 text-[12px] text-danger ring-1 ring-danger/30">
        {t("Couldn't reach MyAnimeList. Try refreshing.")}
      </p>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-8 py-16 text-center">
        <h2 className="text-[16px] font-semibold text-ink">{t("Your MyAnimeList is empty")}</h2>
        <p className="max-w-md text-[13px] leading-relaxed text-ink-muted">
          {t("Add anime to your MyAnimeList and they show up here, grouped by status and ready to edit.")}
        </p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-10">
      <FilterBar type={type} setType={setType} query={query} setQuery={setQuery} counts={counts} />
      {MAL_RAIL_ORDER.map((section) => {
        const items = visible.filter((e) => section.statuses.includes(e.status));
        if (items.length === 0) return null;
        return (
          <div key={section.key} className="flex flex-col gap-4">
            <div className="flex items-baseline gap-3">
              <h2 className="text-[18px] font-semibold text-ink">{t(section.title)}</h2>
              <span className="text-[12px] text-ink-muted">{items.length}</span>
            </div>
            <Grid>
              {items.map((entry) => (
                <MalEntryCard
                  key={entry.anime.id}
                  entry={entry}
                  busy={busy.has(entry.anime.id)}
                  onStatus={(s) => void commitStatus(entry, s)}
                  onProgress={(p) => void commitProgress(entry, p)}
                  onRemove={() => void commitRemove(entry)}
                />
              ))}
            </Grid>
          </div>
        );
      })}
    </section>
  );
}
