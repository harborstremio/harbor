import { Clock } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  episodeFromVideoId,
  library,
  libraryMetaType,
  removeStremioLibraryItem,
  type LibraryItem,
} from "@/lib/stremio";
import { fetchWatchedHistory, type HistoryItem } from "@/lib/trakt/history";
import { useTrakt } from "@/lib/trakt/provider";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import {
  applyFilter,
  countByType,
  FilterBar,
  groupByDate,
  GroupedGrid,
  parseTs,
  SortControl,
  sortedGroups,
  type TypeKey,
  type WatchlistMerged,
} from "./shared";
import { HistoryEpisodeCard } from "./history-episode-card";

export type HistoryEntry = WatchlistMerged & {
  season?: number;
  episode?: number;
  progress: number;
  watched: boolean;
  durationMs: number;
  timeOffsetMs: number;
  watchedAt: number | null;
  item?: LibraryItem;
};

type HistoryView = "posters" | "episodes";

export function HistoryTab() {
  const t = useT();
  const { authKey } = useAuth();
  const { settings } = useSettings();
  const { isConnected: traktConnected } = useTrakt();
  const [stremio, setStremio] = useState<LibraryItem[]>([]);
  const [trakt, setTrakt] = useState<HistoryItem[]>([]);
  const [traktStatus, setTraktStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    if (!authKey) {
      setStremio([]);
      return;
    }
    let cancelled = false;
    library(authKey)
      .then((items) => {
        if (cancelled) return;
        setStremio(filterHistory(items));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authKey]);

  const handleRemove = useCallback(
    async (stremioId: string) => {
      if (!authKey) return;
      setStremio((prev) => prev.filter((i) => i._id !== stremioId));
      try {
        await removeStremioLibraryItem(authKey, stremioId);
      } catch {
        library(authKey)
          .then((items) => setStremio(filterHistory(items)))
          .catch(() => {});
      }
    },
    [authKey],
  );

  useEffect(() => {
    if (!traktConnected) {
      setTrakt([]);
      setTraktStatus("idle");
      return;
    }
    let cancelled = false;
    setTraktStatus("loading");
    fetchWatchedHistory(200)
      .then((items) => {
        if (!cancelled) {
          setTrakt(items);
          setTraktStatus("ready");
        }
      })
      .catch(() => {
        if (!cancelled) setTraktStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [traktConnected]);

  const merged = useMemo(() => mergeHistory(stremio, trakt), [stremio, trakt]);
  const [type, setType] = useState<TypeKey>("all");
  const [query, setQuery] = useState("");
  const [flat, setFlat] = useState(() => localStorage.getItem("harbor.history.flat") === "1");
  useEffect(() => {
    try {
      localStorage.setItem("harbor.history.flat", flat ? "1" : "0");
    } catch {}
  }, [flat]);
  const toggleFlat = useCallback(() => {
    setFlat((v) => !v);
  }, []);
  const [view, setView] = useState<HistoryView>(() =>
    localStorage.getItem("harbor.history.view") === "episodes" ? "episodes" : "posters",
  );
  const setViewPersist = useCallback((next: HistoryView) => {
    setView(next);
    try {
      localStorage.setItem("harbor.history.view", next);
    } catch {}
  }, []);
  const counts = useMemo(() => countByType(merged), [merged]);
  const visible = useMemo(() => applyFilter(merged, type, query), [merged, type, query]);
  const groups = useMemo(() => {
    if (settings.librarySort !== "recent") return sortedGroups(visible, settings.librarySort);
    if (flat) {
      return [
        {
          label: "Everything",
          items: [...visible].sort((a, b) => (b.date ?? -Infinity) - (a.date ?? -Infinity)),
        },
      ];
    }
    return groupByDate(visible);
  }, [visible, settings.librarySort, flat]);

  if (!authKey && !traktConnected) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-8 py-16 text-center">
        <Clock size={28} strokeWidth={1.6} className="text-ink-subtle" />
        <h2 className="text-[16px] font-semibold text-ink">{t("No history yet")}</h2>
        <p className="max-w-md text-[13px] leading-relaxed text-ink-muted">
          {t("Sign in to Stremio or connect Trakt to see what you've been watching here.")}
        </p>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-4">
      {merged.length > 0 && (
        <FilterBar
          type={type}
          setType={setType}
          query={query}
          setQuery={setQuery}
          counts={counts}
          trailing={
            <>
              <HistoryViewToggle view={view} onChange={setViewPersist} />
              <SortControl />
              {settings.librarySort === "recent" && (
                <ViewModeToggle flat={flat} onToggle={toggleFlat} />
              )}
            </>
          }
        />
      )}
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-ink-muted">
          {merged.length === 1
            ? t("{n} item", { n: merged.length })
            : t("{n} items", { n: merged.length })}
          {traktConnected && traktStatus === "loading" ? t(" · Syncing Trakt…") : ""}
        </span>
      </div>
      {merged.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-8 py-16 text-center">
          <Clock size={28} strokeWidth={1.6} className="text-ink-subtle" />
          <h2 className="text-[16px] font-semibold text-ink">{t("Nothing watched yet")}</h2>
          <p className="max-w-md text-[13px] leading-relaxed text-ink-muted">
            {t("Press play on something. It'll show up here once you start watching.")}
          </p>
        </div>
      ) : visible.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-edge-soft bg-canvas/30 px-6 py-10 text-center text-[13px] text-ink-muted">
          {t("No matches for these filters.")}
        </p>
      ) : view === "episodes" ? (
        <EpisodesGrid groups={groups} onRemove={handleRemove} />
      ) : (
        <GroupedGrid groups={groups} onRemove={handleRemove} />
      )}
    </section>
  );
}

function ViewModeToggle({ flat, onToggle }: { flat: boolean; onToggle: () => void }) {
  const t = useT();
  return (
    <div className="flex items-center gap-1 rounded-full bg-elevated/40 p-0.5 ring-1 ring-edge-soft/60">
      <button
        onClick={() => flat && onToggle()}
        className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
          !flat ? "bg-ink text-canvas" : "text-ink-muted hover:bg-raised hover:text-ink"
        }`}
      >
        {t("Grouped")}
      </button>
      <button
        onClick={() => !flat && onToggle()}
        className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
          flat ? "bg-ink text-canvas" : "text-ink-muted hover:bg-raised hover:text-ink"
        }`}
      >
        {t("One list")}
      </button>
    </div>
  );
}

function HistoryViewToggle({
  view,
  onChange,
}: {
  view: HistoryView;
  onChange: (v: HistoryView) => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center gap-1 rounded-full bg-elevated/40 p-0.5 ring-1 ring-edge-soft/60">
      <button
        type="button"
        onClick={() => view !== "posters" && onChange("posters")}
        className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
          view === "posters"
            ? "bg-ink text-canvas"
            : "text-ink-muted hover:bg-raised hover:text-ink"
        }`}
      >
        {t("Posters")}
      </button>
      <button
        type="button"
        onClick={() => view !== "episodes" && onChange("episodes")}
        className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
          view === "episodes"
            ? "bg-ink text-canvas"
            : "text-ink-muted hover:bg-raised hover:text-ink"
        }`}
      >
        {t("Episodes")}
      </button>
    </div>
  );
}

function EpisodesGrid({
  groups,
  onRemove,
}: {
  groups: Array<{ label: string; items: HistoryEntry[] }>;
  onRemove: (stremioId: string) => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-7">
      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-3">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.24em] text-ink-subtle">
            {t(g.label)} <span className="ms-1 text-ink-subtle/70">{g.items.length}</span>
          </h3>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
            {g.items.map((it) => (
              <HistoryEpisodeCard key={it.key} entry={it} onRemove={onRemove} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function filterHistory(items: LibraryItem[]): LibraryItem[] {
  return items
    .filter((i) => !i.removed || i.temp)
    .filter((i) => i.state?.flaggedWatched === 1 || (i.state?.timeOffset ?? 0) > 0)
    .sort(
      (a, b) =>
        Date.parse(b.state?.lastWatched ?? b._mtime) - Date.parse(a.state?.lastWatched ?? a._mtime),
    );
}

function episodeOf(i: LibraryItem): { season: number; episode: number } | null {
  const s = i.state?.season;
  const e = i.state?.episode;
  if (s && e) return { season: s, episode: e };
  const vid = i.state?.video_id ?? "";
  if (/^(kitsu|mal|anilist|anidb):/.test(i._id) && vid.split(":").length === 3) {
    const ep = Number(vid.split(":")[2]);
    return ep > 0 ? { season: 1, episode: ep } : null;
  }
  const parsed = episodeFromVideoId(vid);
  return parsed && parsed.episode > 0 ? parsed : null;
}

function mergeHistory(stremio: LibraryItem[], trakt: HistoryItem[]): HistoryEntry[] {
  const out = new Map<string, HistoryEntry>();
  for (const item of stremio) {
    const dur = item.state?.duration ?? 0;
    const off = item.state?.timeOffset ?? 0;
    const progress = dur > 0 ? Math.min(1, off / dur) : 0;
    const ep = item.type === "movie" ? null : episodeOf(item);
    out.set(item._id, {
      key: item._id,
      meta: {
        id: item._id,
        type: libraryMetaType(item.type),
        name: item.name,
        poster: item.poster,
        background: item.background,
      },
      date: parseTs(item._mtime),
      stremioId: item._id,
      season: ep?.season,
      episode: ep?.episode,
      progress,
      watched: item.state?.flaggedWatched === 1 || progress >= 0.9,
      durationMs: dur,
      timeOffsetMs: off,
      watchedAt: parseTs(item.state?.lastWatched ?? item._mtime),
      item,
    });
  }
  for (const h of trakt) {
    const id = h.type === "movie" ? h.imdb : h.showImdb;
    if (!id || out.has(id)) continue;
    out.set(id, {
      key: id,
      meta: {
        id,
        type: h.type === "movie" ? "movie" : "series",
        name: h.type === "movie" ? h.title : h.showImdb ? "" : h.title,
      },
      date: parseTs(h.watchedAt),
      progress: 0,
      watched: false,
      durationMs: 0,
      timeOffsetMs: 0,
      watchedAt: parseTs(h.watchedAt),
    });
  }
  return Array.from(out.values());
}

export function historyItemsToDated(items: HistoryItem[]): WatchlistMerged[] {
  const seen = new Set<string>();
  const out: WatchlistMerged[] = [];
  for (const h of items) {
    const id = h.type === "movie" ? h.imdb : h.showImdb;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({
      key: id,
      meta: {
        id,
        type: h.type === "movie" ? "movie" : "series",
        name: h.title,
      },
      date: parseTs(h.watchedAt),
    });
  }
  return out;
}
