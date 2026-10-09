import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  CheckSquare,
  Download,
  Square,
  Wifi,
  X,
} from "lucide-react";
import { Play } from "@/components/icons/play-filled";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useLocalLibrary, type LocalEntry } from "@/lib/local-library";
import { sortVersions } from "@/lib/local-library/versions";
import { LocalVersionBadges } from "@/components/local-version-badges";
import { MediaServerBrand } from "@/components/media-server-brand";
import { meta as fetchCinemetaMeta, type Meta } from "@/lib/cinemeta";
import { lastPlayedEpisode, readResumeEntry } from "@/lib/resume";
import { formatRelativeWatched } from "@/lib/episode-progress";
import { episodeSpanLabel, parseEpisodeSpan } from "@/lib/episode-span";
import {
  closeLocalEpisodes,
  getLocalEpisodes,
  subscribeLocalEpisodes,
  type LocalEpisodesPayload,
} from "@/lib/player/local-episodes-modal";

export function LocalEpisodesModal() {
  const state = useSyncExternalStore(subscribeLocalEpisodes, getLocalEpisodes);
  if (!state.open || !state.payload) return null;
  return (
    <GridModal
      key={state.payload.tmdbId ?? state.payload.imdbId ?? state.payload.title}
      payload={state.payload}
    />
  );
}

/** Episode -> every file on disk for it, best version first. */
type SeasonMap = Map<number, Map<number, LocalEntry[]>>;

function GridModal({ payload }: { payload: LocalEpisodesPayload }) {
  const t = useT();
  const { settings, update } = useSettings();
  const { tmdbId, imdbId } = payload;
  const localLibrary = useLocalLibrary();
  const all = payload.entries ?? localLibrary;
  const sortDesc = settings.localEpisodeSortDesc;

  const localEps = useMemo(
    () =>
      all
        .filter(
          (e) =>
            e.type === "show" &&
            ((tmdbId != null && e.tmdbId === tmdbId) || (imdbId != null && e.imdbId === imdbId)),
        )
        .sort((a, b) => (a.season ?? 0) - (b.season ?? 0) || (a.episode ?? 0) - (b.episode ?? 0)),
    [all, tmdbId, imdbId],
  );

  const [videos, setVideos] = useState<Meta["videos"] | undefined>(payload.videos);
  useEffect(() => {
    if (videos && videos.length > 0) return;
    if (!imdbId || !imdbId.startsWith("tt")) return;
    let alive = true;
    void fetchCinemetaMeta("series", imdbId)
      .then((full) => {
        if (alive && full?.videos?.length) setVideos(full.videos);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [imdbId, videos]);

  const localBySeason = useMemo<SeasonMap>(() => {
    const m: SeasonMap = new Map();
    for (const e of localEps) {
      if (e.season == null || e.episode == null) continue;
      if (!m.has(e.season)) m.set(e.season, new Map());
      const byEp = m.get(e.season)!;
      const inferredEnd = parseEpisodeSpan(e.filename)?.episodeEnd;
      const episodeEnd = Math.max(e.episode, e.episodeEnd ?? inferredEnd ?? e.episode);
      for (let episode = e.episode; episode <= episodeEnd; episode += 1) {
        const arr = byEp.get(episode);
        if (arr) arr.push(e);
        else byEp.set(episode, [e]);
      }
    }
    for (const byEp of m.values()) {
      for (const [ep, arr] of byEp) {
        if (arr.length > 1) byEp.set(ep, sortVersions(arr));
      }
    }
    return m;
  }, [localEps]);

  const seasonEpisodeCount = useMemo<Map<number, number>>(() => {
    const m = new Map<number, number>();
    if (videos) {
      for (const v of videos) {
        if (v.season == null || v.episode == null) continue;
        m.set(v.season, Math.max(m.get(v.season) ?? 0, v.episode));
      }
    }
    for (const [season, eps] of localBySeason) {
      const localMax = Math.max(...eps.keys());
      m.set(season, Math.max(m.get(season) ?? 0, localMax));
    }
    return m;
  }, [videos, localBySeason]);

  const episodeNames = useMemo<Map<string, string>>(() => {
    const m = new Map<string, string>();
    if (videos) {
      for (const v of videos) {
        if (v.season == null || v.episode == null) continue;
        const name = v.name || v.title;
        if (name) m.set(`${v.season}x${v.episode}`, name);
      }
    }
    return m;
  }, [videos]);

  const gridSeasons = useMemo(
    () =>
      Array.from(seasonEpisodeCount.keys())
        .filter((s) => s > 0)
        .sort((a, b) => a - b),
    [seasonEpisodeCount],
  );
  const globalMax = useMemo(
    () => Math.max(1, ...gridSeasons.map((s) => seasonEpisodeCount.get(s) ?? 0)),
    [gridSeasons, seasonEpisodeCount],
  );

  const localSeasons = useMemo(
    () =>
      Array.from(localBySeason.keys())
        .filter((s) => s > 0)
        .sort((a, b) => a - b),
    [localBySeason],
  );
  const hasSpecials = localBySeason.has(0);

  const resumeIds = useMemo(
    () => [imdbId, tmdbId != null ? `tmdb:tv:${tmdbId}` : null].filter((x): x is string => !!x),
    [imdbId, tmdbId],
  );
  const epProgress = useMemo(() => {
    return (season: number, episode: number): { ms: number; t: number } | null => {
      let best: { ms: number; t: number } | null = null;
      for (const id of resumeIds) {
        const e = readResumeEntry(id, season, episode);
        if (e && (!best || e.t > best.t)) best = e;
      }
      return best;
    };
  }, [resumeIds]);

  const lastWatched = useMemo(() => {
    let best: { season: number; episode: number; t: number } | null = null;
    for (const id of resumeIds) {
      const lp = lastPlayedEpisode(id);
      if (lp && (!best || lp.t > best.t)) best = lp;
    }
    return best;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeIds.join("|"), all]);

  const hlSeason =
    payload.highlightEpisode != null
      ? (payload.initialSeason ?? null)
      : (lastWatched?.season ?? null);
  const hlEpisode = payload.highlightEpisode ?? lastWatched?.episode ?? null;

  const initialSeason =
    payload.initialSeason != null && localBySeason.has(payload.initialSeason)
      ? payload.initialSeason
      : hlSeason != null && localBySeason.has(hlSeason)
        ? hlSeason
        : (localSeasons[0] ?? (hasSpecials ? 0 : 1));
  const [selected, setSelected] = useState<number>(initialSeason);
  const [downloadSelection, setDownloadSelection] = useState<Set<string>>(new Set());
  useEffect(() => {
    const valid = selected === 0 ? hasSpecials : localSeasons.includes(selected);
    if (!valid) setSelected(localSeasons[0] ?? (hasSpecials ? 0 : 1));
  }, [localSeasons, hasSpecials, selected]);

  const listEps = useMemo(() => {
    // A spanning file owns multiple logical cells but remains one physical row.
    const byEp = Array.from(localBySeason.get(selected)?.entries() ?? []).sort(
      (a, b) => a[0] - b[0],
    );
    if (sortDesc) byEp.reverse();
    const seen = new Set<string>();
    return byEp
      .flatMap(([, versions]) => versions)
      .filter((entry) => {
        if (seen.has(entry.id)) return false;
        seen.add(entry.id);
        return true;
      });
  }, [localBySeason, selected, sortDesc]);

  const multiVersionEpisodes = useMemo(() => {
    const out = new Set<number>();
    for (const [ep, versions] of localBySeason.get(selected) ?? []) {
      if (versions.length > 1) out.add(ep);
    }
    return out;
  }, [localBySeason, selected]);

  const epLabel = (n: number | null | undefined) => `E${String(n ?? 0).padStart(2, "0")}`;
  const entryEpisodeLabel = (entry: LocalEntry) => {
    if (entry.season == null || entry.episode == null) return epLabel(entry.episode);
    const inferredEnd = parseEpisodeSpan(entry.filename)?.episodeEnd;
    return episodeSpanLabel({
      season: entry.season,
      episode: entry.episode,
      episodeEnd: entry.episodeEnd ?? inferredEnd ?? entry.episode,
    }).replace(/^S\d+/, "");
  };
  const sortLabel =
    listEps.length > 1
      ? `${epLabel(listEps[0].episode)} → ${epLabel(listEps[listEps.length - 1].episode)}`
      : sortDesc
        ? t("Descending")
        : t("Ascending");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeLocalEpisodes();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const play = (ep: LocalEntry) => {
    const fn = payload.onPlayLocal;
    closeLocalEpisodes();
    fn(ep);
  };
  const stream = () => {
    const fn = payload.onStream;
    closeLocalEpisodes();
    fn?.();
  };

  const cols = Array.from({ length: globalMax }, (_, i) => i + 1);
  const seasonLabel = (s: number) => (s === 0 ? t("Specials") : `S${String(s).padStart(2, "0")}`);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={payload.title}
      className="animate-fade-in fixed inset-0 z-[210] flex items-center justify-center bg-canvas/80 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeLocalEpisodes();
      }}
    >
      <div className="animate-modal-in flex max-h-[86vh] w-[min(94vw,600px)] flex-col rounded-2xl border border-edge-soft bg-elevated shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]">
        <div className="flex items-center gap-3 border-b border-edge-soft px-5 pb-3.5 pt-4">
          {payload.poster && (
            <img
              src={payload.poster}
              alt=""
              className="h-11 w-8 shrink-0 rounded-md object-cover ring-1 ring-edge-soft"
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col">
            <h2
              className="truncate font-display text-[18px] font-medium text-ink"
              title={payload.title}
            >
              {payload.title}
            </h2>
            <span className="text-[12px] text-ink-subtle">
              {payload.sourceLabel ??
                (Array.from(localBySeason.values()).reduce(
                  (sum, episodes) => sum + episodes.size,
                  0,
                ) === 1
                  ? t("1 episode on disk")
                  : t("{n} episodes on disk", {
                      n: Array.from(localBySeason.values()).reduce(
                        (sum, episodes) => sum + episodes.size,
                        0,
                      ),
                    }))}
            </span>
          </div>
          <button
            type="button"
            data-tv-modal-close
            onClick={() => closeLocalEpisodes()}
            aria-label={t("Close")}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-4">
          <div className="mx-auto w-fit max-w-full shrink-0 rounded-xl border border-edge-soft bg-canvas p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
              {t("Availability")}
            </p>
            <div className="max-h-[220px] overflow-auto">
              <table className="border-separate border-spacing-1">
                <thead>
                  <tr>
                    <th className="sticky start-0 top-0 z-20 bg-canvas" />
                    {cols.map((c) => (
                      <th
                        key={c}
                        className="sticky top-0 z-10 w-7 bg-canvas pb-0.5 text-center text-[10px] font-semibold tabular-nums text-ink-subtle"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gridSeasons.map((s) => {
                    const count = seasonEpisodeCount.get(s) ?? 0;
                    const owned = localBySeason.get(s);
                    return (
                      <tr key={s}>
                        <td className="sticky start-0 z-10 bg-canvas pe-2">
                          <span className="flex h-6 min-w-[40px] items-center justify-center rounded-md bg-elevated px-2 font-mono text-[11px] font-bold tabular-nums text-ink-muted ring-1 ring-edge-soft">
                            {seasonLabel(s)}
                          </span>
                        </td>
                        {cols.map((c) => {
                          if (c > count) return <td key={c} className="h-7 w-7" />;
                          const isLocal = owned?.has(c) ?? false;
                          const isHighlight = hlSeason === s && hlEpisode === c;
                          return (
                            <td key={c} className="h-7 w-7">
                              <span className="flex h-full w-full items-center justify-center">
                                <span
                                  className={`${
                                    isLocal
                                      ? "h-3 w-3 rounded-full bg-accent"
                                      : "h-3 w-3 rounded-full ring-1 ring-inset ring-edge"
                                  }${isHighlight ? " ring-2 ring-accent ring-offset-2 ring-offset-canvas" : ""}`}
                                  title={
                                    isLocal
                                      ? `${seasonLabel(s)}E${String(c).padStart(2, "0")} · ${payload.sourceLabel ?? t("on disk")}`
                                      : `${seasonLabel(s)}E${String(c).padStart(2, "0")} · ${t("not downloaded")}`
                                  }
                                />
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 pb-1">
            {(localSeasons.length > 1 || hasSpecials) && (
              <div className="flex min-w-0 items-center gap-1.5 overflow-x-auto">
                {localSeasons.map((s) => (
                  <SeasonPill key={s} active={selected === s} onClick={() => setSelected(s)}>
                    {seasonLabel(s)}
                  </SeasonPill>
                ))}
                {hasSpecials && (
                  <SeasonPill active={selected === 0} onClick={() => setSelected(0)}>
                    {t("Specials")}
                  </SeasonPill>
                )}
              </div>
            )}
            <button
              type="button"
              onClick={() => update({ localEpisodeSortDesc: !sortDesc })}
              aria-label={t("Sort episodes")}
              aria-pressed={sortDesc}
              className="ms-auto flex shrink-0 items-center gap-1.5 rounded-full bg-elevated/40 px-3.5 py-1.5 text-[12.5px] font-semibold tabular-nums text-ink-muted ring-1 ring-edge-soft/60 transition-colors hover:bg-raised hover:text-ink"
            >
              {sortDesc ? (
                <ArrowDownWideNarrow size={14} strokeWidth={2.2} />
              ) : (
                <ArrowUpNarrowWide size={14} strokeWidth={2.2} />
              )}
              {sortLabel}
            </button>
          </div>

          {payload.onDownload && (
            <div className="flex items-center gap-2 rounded-xl bg-canvas/50 p-2 ring-1 ring-edge-soft">
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-[11.5px] font-semibold text-ink-muted hover:bg-raised hover:text-ink"
                onClick={() => setDownloadSelection(new Set(listEps.map((entry) => entry.id)))}
              >
                {t("Select season")}
              </button>
              <button
                type="button"
                className="rounded-md px-3 py-1.5 text-[11.5px] font-semibold text-ink-muted hover:bg-raised hover:text-ink"
                onClick={() => setDownloadSelection(new Set(localEps.map((entry) => entry.id)))}
              >
                {t("Select all seasons")}
              </button>
              <button
                type="button"
                disabled={downloadSelection.size === 0}
                className="ms-auto inline-flex items-center gap-2 rounded-md bg-ink px-3 py-1.5 text-[11.5px] font-semibold text-canvas disabled:opacity-40"
                onClick={() => {
                  for (const entry of localEps)
                    if (downloadSelection.has(entry.id)) void payload.onDownload?.(entry);
                  setDownloadSelection(new Set());
                }}
              >
                <Download size={13} />
                {t("Download selected ({n})", { n: downloadSelection.size })}
              </button>
            </div>
          )}

          <div className="flex shrink-0 flex-col gap-1">
            {listEps.map((ep) => {
              const episodeSource = payload.entrySources?.[ep.id];
              const isHighlight = hlSeason === ep.season && hlEpisode === ep.episode;
              const pr = ep.episode != null ? epProgress(ep.season ?? 0, ep.episode) : null;
              const ratio =
                pr && ep.runtime && ep.runtime > 0 ? Math.min(1, pr.ms / (ep.runtime * 60_000)) : 0;
              const watchedAgo = pr ? formatRelativeWatched(pr.t) : "";
              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => {
                    if (payload.onDownload && downloadSelection.size > 0) {
                      setDownloadSelection((current) => {
                        const next = new Set(current);
                        if (next.has(ep.id)) next.delete(ep.id);
                        else next.add(ep.id);
                        return next;
                      });
                    } else play(ep);
                  }}
                  autoFocus={isHighlight || (hlEpisode == null && ep.id === listEps[0]?.id)}
                  data-tv-initial-focus={
                    isHighlight || (hlEpisode == null && ep.id === listEps[0]?.id) || undefined
                  }
                  className={`group/ep relative flex items-center gap-3 overflow-hidden rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-raised ${
                    isHighlight ? "bg-accent/10 ring-1 ring-accent" : ""
                  }`}
                >
                  <span className="flex h-8 min-w-11 shrink-0 items-center justify-center whitespace-nowrap rounded-md bg-canvas/60 px-2 font-mono text-[11px] font-bold tabular-nums text-ink-muted ring-1 ring-edge-soft">
                    {payload.onDownload && downloadSelection.size > 0 ? (
                      downloadSelection.has(ep.id) ? (
                        <CheckSquare size={15} />
                      ) : (
                        <Square size={15} />
                      )
                    ) : (
                      entryEpisodeLabel(ep)
                    )}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-[13px] text-ink" title={ep.filename}>
                      {episodeNames.get(`${ep.season}x${ep.episode}`) ?? ep.filename}
                    </span>
                    {episodeNames.has(`${ep.season}x${ep.episode}`) && (
                      <span className="truncate text-[11px] text-ink-subtle" title={ep.filename}>
                        {ep.filename}
                      </span>
                    )}
                    {episodeSource && (
                      <span className="mt-0.5 flex min-w-0 items-center text-[10.5px] font-semibold text-ink-muted">
                        {episodeSource.kind === "home-server" ? (
                          <MediaServerBrand
                            provider={episodeSource.provider}
                            name={episodeSource.label}
                          />
                        ) : (
                          <span className="truncate">{episodeSource.label}</span>
                        )}
                      </span>
                    )}
                    {pr &&
                      (ratio > 0.01 ? (
                        <span className="text-[11px] text-accent/85">
                          {t("{pct}% watched", { pct: Math.round(ratio * 100) })}
                          {watchedAgo ? ` · ${watchedAgo}` : ""}
                        </span>
                      ) : (
                        watchedAgo && (
                          <span className="text-[11px] text-emerald-300/85">
                            {t("Watched {ago}", { ago: watchedAgo })}
                          </span>
                        )
                      ))}
                  </span>
                  {ep.episode != null && multiVersionEpisodes.has(ep.episode) ? (
                    <LocalVersionBadges entry={ep} className="shrink-0 justify-end" />
                  ) : (
                    ep.resolution && (
                      <span className="shrink-0 rounded-md bg-raised px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                        {ep.resolution}
                      </span>
                    )
                  )}
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors group-hover/ep:bg-ink group-hover/ep:text-canvas">
                    <Play size={13} strokeWidth={2.4} fill="currentColor" className="ml-0.5" />
                  </span>
                  {ratio > 0.01 && (
                    <span className="absolute inset-x-0 bottom-0 h-[2px] bg-edge">
                      <span
                        className="block h-full bg-accent"
                        style={{ width: `${Math.max(2, ratio * 100)}%` }}
                      />
                    </span>
                  )}
                </button>
              );
            })}
            {listEps.length === 0 && (
              <p className="px-3 py-6 text-center text-[13px] text-ink-subtle">
                {t("No available episodes in this season.")}
              </p>
            )}
          </div>
        </div>

        {payload.onStream && (
          <div className="border-t border-edge-soft p-4">
            <button
              type="button"
              onClick={stream}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full bg-canvas/50 text-[13.5px] font-semibold text-ink ring-1 ring-edge-soft transition-colors hover:bg-canvas/70"
            >
              <Wifi size={16} strokeWidth={2.2} />
              {t("Stream / addons instead")}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function SeasonPill({
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
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
        active
          ? "bg-ink text-canvas"
          : "bg-elevated/40 text-ink-muted ring-1 ring-edge-soft/60 hover:bg-raised hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
