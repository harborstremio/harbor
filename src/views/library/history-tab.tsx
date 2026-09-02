import { Clock } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { library, removeStremioLibraryItem, type LibraryItem } from "@/lib/stremio";
import { fetchWatchedHistory, type HistoryItem } from "@/lib/trakt/history";
import { useTrakt } from "@/lib/trakt/provider";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import {
  applyFilter,
  countByType,
  FilterBar,
  Grid,
  groupByDate,
  GroupedGrid,
  RefreshButton,
  SortControl,
  sortedGroups,
  type TypeKey,
} from "./shared";
import { filterHistory, mergeHistory, type HistoryEntry } from "./history-merge";
import { HistoryEpisodeCard } from "./history-episode-card";
import { useReportFeatured } from "./featured-context";

type HistoryView = "posters" | "episodes";

export function HistoryTab() {
  const t = useT();
  const { authKey } = useAuth();
  const { settings } = useSettings();
  const { isConnected: traktConnected } = useTrakt();
  const [stremio, setStremio] = useState<LibraryItem[]>([]);
  const [trakt, setTrakt] = useState<HistoryItem[]>([]);
  const [traktStatus, setTraktStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [stremioLoading, setStremioLoading] = useState<boolean>(!!authKey);
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = useCallback(() => setReloadKey((k) => k + 1), []);

  useEffect(() => {
    if (!authKey) {
      setStremio([]);
      return;
    }
    let cancelled = false;
    setStremioLoading(true);
    library(authKey)
      .then((items) => {
        if (cancelled) return;
        setStremio(filterHistory(items));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setStremioLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authKey, reloadKey]);

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
  }, [traktConnected, reloadKey]);

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
  useReportFeatured(useMemo(() => visible.map((v) => v.meta), [visible]));
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
          {(stremioLoading || traktStatus === "loading") && merged.length === 0
            ? t("Loading your history…")
            : merged.length === 1
              ? t("{n} item", { n: merged.length })
              : t("{n} items", { n: merged.length })}
          {traktConnected && traktStatus === "loading" && merged.length > 0
            ? t(" · Syncing Trakt…")
            : ""}
        </span>
        <RefreshButton onClick={refresh} spinning={stremioLoading || traktStatus === "loading"} />
      </div>
      {(stremioLoading || traktStatus === "loading") && merged.length === 0 ? (
        <HistorySkeleton />
      ) : merged.length === 0 ? (
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
      ) : (
        <div key={view} className="harbor-hist-in">
          {view === "episodes" ? (
            <EpisodesGrid groups={groups} onRemove={handleRemove} />
          ) : (
            <GroupedGrid groups={groups} onRemove={handleRemove} />
          )}
        </div>
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

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-7" aria-hidden>
      {[14, 8].map((count, gi) => (
        <div key={gi} className="flex flex-col gap-3">
          <div className="harbor-skel h-3 w-24 rounded bg-elevated/25" />
          <Grid>
            {Array.from({ length: count }).map((_, i) => (
              <div
                key={i}
                className="harbor-hist-in flex flex-col gap-2"
                style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}
              >
                <div className="harbor-skel aspect-[2/3] rounded-xl bg-elevated/30" />
                <div className="harbor-skel h-2.5 w-3/4 rounded bg-elevated/25" />
              </div>
            ))}
          </Grid>
        </div>
      ))}
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

