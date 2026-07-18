import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePlaylistMutations } from "./live/hooks/use-playlist-mutations";
import { useLiveActions } from "./live/hooks/use-live-actions";
import { useT } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useScrollMemory, useView } from "@/lib/view";
import { FAVORITES_GROUP_KEY, useFavorites } from "@/lib/iptv/favorites";
import { clearPlaylistCache, getCachedPlaylist } from "@/lib/iptv/store";
import { pushActivityHint } from "@/lib/discord/activity-hint";
import type { IptvChannel, IptvPlaylistSource } from "@/lib/iptv/types";
import { CategorySidebar } from "./live/category-sidebar";
import { ChannelGrid, EmptyResult, ErrorBlock } from "./live/channel-grid";
import { GridSkeleton, GuideSkeleton } from "./live/skeletons";
import { PlaylistEmpty } from "./live/playlist-empty";
import { SourcePicker } from "./live/source-picker";
import { LiveHome } from "./live/live-home";
import { TopNetworksRows } from "./live/top-networks-rows";
import { GuideView } from "./live/guide/guide-view";
import { useAllPlaylists } from "./live/hooks/use-all-playlists";
import { useChannelPipeline } from "./live/hooks/use-channel-pipeline";
import { useEpg, useNowTick } from "./live/hooks/use-epg";
import { useXtreamEpgFallback } from "./live/hooks/use-xtream-epg-fallback";
import { useIptvPlaylist } from "./live/hooks/use-iptv-playlist";
import { MultiviewView } from "./multiview";
import { ViewModeToggle, type ViewMode } from "./live/view-mode-toggle";
import { isWindowsDesktop } from "@/lib/platform";

const ACTIVE_KEY = "harbor.iptv.active";
const MODE_KEY = "harbor.iptv.viewMode";
const EMPTY_CHANNELS: IptvChannel[] = [];

function readActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

function writeActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id);
    else localStorage.removeItem(ACTIVE_KEY);
  } catch {}
}

function readMode(): ViewMode {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "grid") return "grid";
    if (v === "guide") return "guide";
    if (v === "multiview" && isWindowsDesktop()) return "multiview";
    return "home";
  } catch {
    return "home";
  }
}

function writeMode(m: ViewMode) {
  try {
    localStorage.setItem(MODE_KEY, m);
  } catch {}
}

export function LiveView({ active }: { active: boolean }) {
  const t = useT();
  const { settings } = useSettings();
  const { openMeta, setView } = useView();
  const sources = settings.iptvPlaylists;

  const [activeId, setActiveId] = useState<string | null>(() => readActiveId());
  useEffect(() => {
    if (sources.length === 0) {
      if (activeId !== null) {
        setActiveId(null);
        writeActiveId(null);
      }
      return;
    }
    if (!activeId || !sources.find((s) => s.id === activeId)) {
      const fallback = sources[0]?.id ?? null;
      setActiveId(fallback);
      writeActiveId(fallback);
    }
  }, [sources, activeId]);

  const activeSource: IptvPlaylistSource | null = useMemo(() => {
    if (!activeId) return null;
    const found = sources.find((s) => s.id === activeId);
    return found
      ? {
          id: found.id,
          name: found.name,
          url: found.url,
          epgUrl: found.epgUrl,
          kind: found.kind,
          xtream: found.xtream,
        }
      : null;
  }, [activeId, sources]);

  const { state, refresh } = useIptvPlaylist(active ? activeSource : null);
  const cachedForActive = getCachedPlaylist(activeSource?.id ?? "");
  const playlist =
    state.kind === "ready"
      ? state.playlist
      : cachedForActive && cachedForActive.id === activeId
        ? cachedForActive
        : null;
  const epgOnlyUrls = useMemo(
    () => sources.filter((s) => s.kind === "epg").map((s) => s.epgUrl || s.url),
    [sources],
  );
  const { index: baseEpg, error: epgError } = useEpg(active ? activeSource : null, epgOnlyUrls);
  const epg = useXtreamEpgFallback(activeSource, playlist?.channels ?? EMPTY_CHANNELS, baseEpg);
  const nowMs = useNowTick(30_000);

  const favorites = useFavorites();
  const favoritesCountRef = useRef(favorites.count);
  favoritesCountRef.current = favorites.count;
  const [group, setGroup] = useState<string | null>(() =>
    favoritesCountRef.current > 0 ? FAVORITES_GROUP_KEY : null,
  );
  const [query, setQuery] = useState("");
  const [mode, setModeState] = useState<ViewMode>(() => readMode());
  const setMode = useCallback((m: ViewMode) => {
    setModeState(m);
    writeMode(m);
  }, []);
  const goLiveHome = useCallback(() => {
    setMode("home");
    setQuery("");
    setGroup(favoritesCountRef.current > 0 ? FAVORITES_GROUP_KEY : null);
  }, [setMode]);
  useEffect(() => {
    if (!active) return;
    const onLocalBack = (e: Event) => {
      if (sources.length === 0) {
        e.preventDefault();
        setView("home");
        return;
      }
      if (
        mode === "home" &&
        !query &&
        group === (favoritesCountRef.current > 0 ? FAVORITES_GROUP_KEY : null)
      )
        return;
      e.preventDefault();
      goLiveHome();
    };
    window.addEventListener("harbor:local-back", onLocalBack);
    return () => window.removeEventListener("harbor:local-back", onLocalBack);
  }, [active, goLiveHome, group, mode, query, setView, sources.length]);
  const [immersive, setImmersive] = useState(false);
  useEffect(() => {
    const onImm = (e: Event) => setImmersive((e as CustomEvent<boolean>).detail === true);
    window.addEventListener("harbor:immersive", onImm);
    return () => window.removeEventListener("harbor:immersive", onImm);
  }, []);
  useEffect(() => {
    if (mode !== "multiview" && immersive) setImmersive(false);
  }, [mode, immersive]);
  useEffect(() => {
    setGroup(favoritesCountRef.current > 0 ? FAVORITES_GROUP_KEY : null);
    setQuery("");
  }, [activeId]);

  const region = settings.region || "US";
  const preferredLanguages =
    settings.preferredLanguages.length > 0 ? settings.preferredLanguages : ["English"];

  const inFavorites = group === FAVORITES_GROUP_KEY;
  const allSources = useMemo<IptvPlaylistSource[]>(
    () =>
      settings.iptvPlaylists
        .filter((p) => (p.kind ?? "m3u") !== "epg")
        .map((p) => ({
          id: p.id,
          name: p.name,
          url: p.url,
          epgUrl: p.epgUrl,
          kind: p.kind,
          xtream: p.xtream,
        })),
    [settings.iptvPlaylists],
  );
  const managedSources = useMemo<IptvPlaylistSource[]>(
    () =>
      settings.iptvPlaylists.map((p) => ({
        id: p.id,
        name: p.name,
        url: p.url,
        epgUrl: p.epgUrl,
        kind: p.kind,
        xtream: p.xtream,
      })),
    [settings.iptvPlaylists],
  );
  const stubSources = useMemo(() => {
    const ids = new Set<string>();
    for (const f of favorites.items.values()) if (!f.url) ids.add(f.sourceId);
    return allSources.filter((s) => ids.has(s.id));
  }, [favorites.items, allSources]);

  const multiview = mode === "multiview";
  const allPlaylists = useAllPlaylists(
    multiview ? allSources : stubSources,
    multiview || (inFavorites && stubSources.length > 0),
  );

  const {
    sortedGroups,
    topRows,
    showTopRows,
    regionChannels,
    shownChannels,
    mvChannels,
    visible,
    counts,
    groupLogos,
  } = useChannelPipeline({
    playlist,
    region,
    preferredLanguages,
    mode,
    group,
    query,
    favorites,
    allPlaylists,
    allSources,
  });

  const selectActive = useCallback((id: string | null) => {
    setActiveId(id);
    writeActiveId(id);
  }, []);

  const { addPlaylist, removePlaylist, editPlaylist, reorderPlaylist, movePlaylistTop } =
    usePlaylistMutations({ activeId, setActiveId: selectActive, refresh });

  const { handlePlay, handlePlayCatchup, exportPlaylist } = useLiveActions({
    epg,
    activeId,
    playlist,
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollMemory("live", scrollRef, active);

  useEffect(() => {
    if (!active || mode !== "guide") return;
    return pushActivityHint({ details: "Browsing the TV guide", state: "Live TV" });
  }, [active, mode]);

  if (sources.length === 0) {
    return (
      <main data-rail-flush className="relative flex min-h-0 flex-1 flex-col overflow-y-auto pt-20">
        <PlaylistEmpty onSave={(entry) => addPlaylist(entry)} />
      </main>
    );
  }

  return (
    <main
      data-rail-flush
      className={`relative flex min-h-0 flex-1 ${immersive ? "pt-0" : "pt-20"}`}
    >
      {playlist &&
        sortedGroups.length > 0 &&
        mode !== "multiview" &&
        mode !== "home" &&
        state.kind !== "error" && (
          <CategorySidebar
            groups={sortedGroups}
            active={group}
            onSelect={setGroup}
            counts={counts}
            groupLogos={groupLogos}
            favoritesCount={favorites.count}
            sourceId={activeId ?? ""}
          />
        )}
      <div className="flex min-w-0 flex-1 flex-col">
        {!immersive && (
          <header className="relative z-[40] flex shrink-0 flex-wrap items-center gap-2.5 border-b border-edge-soft/40 bg-surface px-6 py-2.5">
            <SourcePicker
              sources={managedSources}
              activeId={activeId}
              exportEnabled={!!playlist?.channels.length}
              onSelect={(id) => {
                setActiveId(id);
                writeActiveId(id);
              }}
              onAdd={addPlaylist}
              onEdit={editPlaylist}
              onRemove={removePlaylist}
              onMove={reorderPlaylist}
              onMoveTop={movePlaylistTop}
              onRefresh={() => {
                if (activeId) clearPlaylistCache(activeId);
                refresh();
              }}
              onExport={exportPlaylist}
              fetchedAt={playlist?.fetchedAt ?? null}
              channelCount={playlist?.channels.length ?? null}
              loading={state.kind === "loading"}
            />
            {mode === "multiview" ? (
              <div className="flex h-11 flex-1 min-w-[220px] items-center px-1 text-[13px] text-ink-subtle">
                {t("Pick channels into the grid below. Audio follows the highlighted tile.")}
              </div>
            ) : (
              <div className="flex h-11 flex-1 min-w-[220px] items-center gap-2.5 rounded-xl border border-edge-soft/55 bg-elevated px-3.5">
                <Search size={15} strokeWidth={2} className="text-ink-subtle" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    if (e.target.value && mode === "home") setMode("grid");
                  }}
                  placeholder={t("Search {n} channels", { n: playlist?.channels.length ?? 0 })}
                  className="flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-subtle focus:outline-none"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
                  >
                    {t("Clear")}
                  </button>
                )}
              </div>
            )}
            <ViewModeToggle mode={mode} onChange={setMode} />
          </header>
        )}
        {epgError && !epg && (
          <div className="mx-6 mt-2 flex items-center gap-2 rounded-xl border border-danger/40 bg-danger/10 px-4 py-2 text-[12.5px] text-ink-muted">
            <span className="font-semibold text-danger">{t("EPG failed:")}</span>
            <span className="min-w-0 flex-1 truncate">{epgError}</span>
          </div>
        )}
        {mode === "multiview" ? (
          <div className="flex min-h-0 flex-1 flex-col pt-2">
            <MultiviewView
              channels={mvChannels}
              epg={epg}
              active={active}
              sources={allSources}
              playlists={allPlaylists}
              loading={allSources.length > 0 && allPlaylists.size < allSources.length}
            />
          </div>
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pt-5">
            {state.kind === "error" ? (
              <ErrorBlock
                message={state.message}
                onRetry={() => {
                  if (activeId) clearPlaylistCache(activeId);
                  refresh();
                }}
              />
            ) : state.kind === "loading" ? (
              mode === "guide" ? (
                <GuideSkeleton />
              ) : (
                <GridSkeleton />
              )
            ) : (
              <>
                {mode === "home" && playlist && (
                  <LiveHome
                    channels={shownChannels}
                    epg={epg}
                    nowMs={nowMs}
                    sourceId={activeId ?? ""}
                    region={region}
                    favorites={favorites}
                    onPlay={handlePlay}
                    onOpenCategory={(g) => {
                      setGroup(g);
                      setMode("grid");
                    }}
                  />
                )}
                {mode !== "home" && playlist && visible.length === 0 && (
                  <EmptyResult
                    onClear={() => {
                      setQuery("");
                      setGroup(null);
                    }}
                  />
                )}
                {visible.length > 0 && mode === "grid" && (
                  <div className="flex flex-col gap-6">
                    {showTopRows && (
                      <TopNetworksRows
                        rows={topRows}
                        channels={regionChannels}
                        onPlay={handlePlay}
                      />
                    )}
                    <ChannelGrid
                      channels={visible}
                      onPlay={handlePlay}
                      onInfo={(meta) => openMeta(meta, { liveContext: true })}
                      epg={epg}
                      nowMs={nowMs}
                      resetKey={`${activeId}|${group ?? ""}|${query}`}
                    />
                  </div>
                )}
                {visible.length > 0 && mode === "guide" && (
                  <GuideView
                    channels={visible}
                    epg={epg}
                    nowMs={nowMs}
                    onPlay={handlePlay}
                    onPlayCatchup={handlePlayCatchup}
                    resetKey={`${activeId}|${group ?? ""}|${query}`}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
