import { fetchMediaListCollection, readCachedCollection } from "@/lib/anilist/lists";
import { deleteListEntry, saveListEntry } from "@/lib/anilist/mutations";
import { useAnilist } from "@/lib/anilist/provider";
import type { AnilistMediaEntry, MediaListStatus } from "@/lib/anilist/types";
import { useT } from "@/lib/i18n";
import { RAIL_ORDER } from "@/lib/use-anilist-anime-rails";
import { useCallback, useEffect, useMemo, useState } from "react";

import { AnilistEntryCard } from "./anilist-entry-card";
import { FilterBar, Grid, type TypeKey } from "./shared";

function entryName(e: AnilistMediaEntry): string {
  return e.media.title.userPreferred || e.media.title.english || e.media.title.romaji || "";
}

function entryType(e: AnilistMediaEntry): "movie" | "series" {
  return e.media.format === "MOVIE" ? "movie" : "series";
}

export function AnilistTab() {
  const t = useT();
  const { session } = useAnilist();
  const userId = session?.userId;
  const [entries, setEntries] = useState<AnilistMediaEntry[]>(() =>
    userId != null ? (readCachedCollection(userId)?.flatMap((g) => g.entries) ?? []) : [],
  );
  const [status, setStatus] = useState<"loading" | "ready" | "error">(() =>
    userId != null && readCachedCollection(userId) != null ? "ready" : "loading",
  );
  const [type, setType] = useState<TypeKey>("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    if (userId == null) return;
    let cancelled = false;
    const cached = readCachedCollection(userId);
    if (cached) {
      setEntries(cached.flatMap((g) => g.entries));
      setStatus("ready");
    } else {
      setStatus("loading");
    }
    fetchMediaListCollection(userId)
      .then((groups) => {
        if (cancelled) return;
        setEntries(groups.flatMap((g) => g.entries));
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled && readCachedCollection(userId) == null) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setBusyFor = useCallback((id: number, on: boolean) => {
    setBusy((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const applyLocal = useCallback((id: number, patch: Partial<AnilistMediaEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }, []);

  const commitStatus = useCallback(
    async (entry: AnilistMediaEntry, next: MediaListStatus) => {
      setBusyFor(entry.id, true);
      const total = entry.media.episodes;
      const completing = next === "COMPLETED" && total != null;
      applyLocal(entry.id, { status: next, ...(completing ? { progress: total } : {}) });
      try {
        const saved = await saveListEntry({
          mediaId: entry.media.id,
          status: next,
          ...(completing ? { progress: total } : {}),
        });
        applyLocal(entry.id, { status: saved.status, progress: saved.progress });
      } catch {
        applyLocal(entry.id, { status: entry.status, progress: entry.progress });
      } finally {
        setBusyFor(entry.id, false);
      }
    },
    [applyLocal, setBusyFor],
  );

  const commitProgress = useCallback(
    async (entry: AnilistMediaEntry, next: number) => {
      setBusyFor(entry.id, true);
      applyLocal(entry.id, { progress: next });
      try {
        const saved = await saveListEntry({ mediaId: entry.media.id, progress: next });
        applyLocal(entry.id, { status: saved.status, progress: saved.progress });
      } catch {
        applyLocal(entry.id, { progress: entry.progress });
      } finally {
        setBusyFor(entry.id, false);
      }
    },
    [applyLocal, setBusyFor],
  );

  const commitRemove = useCallback(
    async (entry: AnilistMediaEntry) => {
      setBusyFor(entry.id, true);
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      try {
        await deleteListEntry(entry.id);
      } catch {
        setEntries((prev) => (prev.some((e) => e.id === entry.id) ? prev : [...prev, entry]));
      } finally {
        setBusyFor(entry.id, false);
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
    return <p className="text-[13px] text-ink-muted">{t("Loading your AniList…")}</p>;
  }
  if (status === "error") {
    return (
      <p className="rounded-lg bg-danger/15 px-3 py-2 text-[12px] text-danger ring-1 ring-danger/30">
        {t("Couldn't reach AniList. Try refreshing.")}
      </p>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-8 py-16 text-center">
        <h2 className="text-[16px] font-semibold text-ink">{t("Your AniList is empty")}</h2>
        <p className="max-w-md text-[13px] leading-relaxed text-ink-muted">
          {t("Add anime to your AniList and they show up here, grouped by status and ready to edit.")}
        </p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-10">
      <FilterBar type={type} setType={setType} query={query} setQuery={setQuery} counts={counts} />
      {RAIL_ORDER.map((section) => {
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
                <AnilistEntryCard
                  key={entry.id}
                  entry={entry}
                  busy={busy.has(entry.id)}
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
