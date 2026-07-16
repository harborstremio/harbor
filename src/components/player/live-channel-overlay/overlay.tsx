import { CalendarRange, List, Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { CategorySidebar } from "@/views/live/category-sidebar";
import { GuideView } from "@/views/live/guide/guide-view";
import {
  filterChannelsByRegion,
  promoteTopChannelsToFront,
  rowsForRegion,
} from "@/lib/iptv/top-networks";
import { sortChannelsByGroupRelevance, sortGroupsByRelevance } from "@/lib/iptv/group-relevance";
import { computeTvgIdCounts, epgProgramsForChannel } from "@/lib/iptv/epg-resolver";
import { FAVORITES_GROUP_KEY, useFavorites } from "@/lib/iptv/favorites";
import { getCachedPlaylist } from "@/lib/iptv/store";
import { findCurrent } from "@/lib/iptv/xmltv";
import type { IptvChannel, IptvPlaylistSource } from "@/lib/iptv/types";
import { useAllPlaylists } from "@/views/live/hooks/use-all-playlists";
import { useChannelFilter } from "@/views/live/hooks/use-channel-filter";
import { useEpg, useNowTick } from "@/views/live/hooks/use-epg";
import { useIptvPlaylist } from "@/views/live/hooks/use-iptv-playlist";
import { useScrollMemory } from "@/lib/view";
import { useSettings } from "@/lib/settings";
import { useT } from "@/lib/i18n";
import { CurrentChannelInfo } from "./current-channel-info";
import { InlineSourceSwitcher } from "./inline-source-switcher";

export function LiveChannelOverlay({
  source,
  sources,
  onSelectSource,
  currentChannelId,
  onSwitch,
  onClose,
  group,
  setGroup,
  query,
  setQuery,
}: {
  source: IptvPlaylistSource;
  sources: IptvPlaylistSource[];
  onSelectSource: (id: string) => void;
  currentChannelId: string | null;
  onSwitch: (channel: IptvChannel, program?: string) => void;
  onClose: () => void;
  group: string | null;
  setGroup: (g: string | null) => void;
  query: string;
  setQuery: (q: string) => void;
}) {
  const t = useT();
  const { settings } = useSettings();
  const { state } = useIptvPlaylist(source);
  const { index: epg } = useEpg(source);
  const nowMs = useNowTick(30_000);
  const playlist = state.kind === "ready" ? state.playlist : getCachedPlaylist(source.id);

  const region = settings.region || "US";
  const preferredLanguages =
    settings.preferredLanguages.length > 0 ? settings.preferredLanguages : ["English"];

  const sortedChannels = useMemo(
    () => sortChannelsByGroupRelevance(playlist?.channels ?? [], region, preferredLanguages),
    [playlist?.channels, region, preferredLanguages.join(",")],
  );
  const sortedGroups = useMemo(
    () => sortGroupsByRelevance(playlist?.groups ?? [], region, preferredLanguages),
    [playlist?.groups, region, preferredLanguages.join(",")],
  );
  const topRows = useMemo(() => rowsForRegion(region), [region]);
  const regionChannels = useMemo(
    () => filterChannelsByRegion(sortedChannels, region),
    [sortedChannels, region],
  );
  const orderedChannels = useMemo(() => {
    if (group !== null) return sortedChannels;
    if (query.trim()) return sortedChannels;
    if (topRows.length === 0) return sortedChannels;
    return promoteTopChannelsToFront(sortedChannels, topRows, regionChannels);
  }, [sortedChannels, group, query, topRows, regionChannels]);
  const favorites = useFavorites();
  const inFavorites = group === FAVORITES_GROUP_KEY;

  const stubSources = useMemo(() => {
    const ids = new Set<string>();
    for (const f of favorites.items.values()) if (!f.url) ids.add(f.sourceId);
    return sources.filter((s) => ids.has(s.id));
  }, [favorites.items, sources]);

  const stubPlaylists = useAllPlaylists(stubSources, inFavorites && stubSources.length > 0);

  useEffect(() => {
    if (!inFavorites) return;
    for (const pl of stubPlaylists.values()) favorites.hydrate(pl.channels);
  }, [inFavorites, stubPlaylists, favorites]);

  const favoriteChannels = useMemo(() => {
    if (!inFavorites) return [];
    const nameById = new Map(sources.map((s) => [s.id, s.name] as const));
    const ready = [...favorites.items.values()].filter((f) => f.url);
    ready.sort((a, b) => {
      const na = nameById.get(a.sourceId) ?? a.sourceId;
      const nb = nameById.get(b.sourceId) ?? b.sourceId;
      return na.localeCompare(nb) || a.name.localeCompare(b.name);
    });
    return ready.map<IptvChannel>((f) => ({
      id: f.id,
      tvgId: f.tvgId,
      name: f.name,
      logo: f.logo,
      group: nameById.get(f.sourceId) ?? "Favorites",
      url: f.url,
      catchupSource: null,
      durationSec: null,
      attrs: {},
    }));
  }, [inFavorites, favorites.items, sources]);

  const { visible: standardVisible, counts } = useChannelFilter(
    orderedChannels,
    inFavorites ? null : group,
    query,
    favorites.ids,
  );

  const visible = useMemo(() => {
    if (!inFavorites) return standardVisible;
    const q = query.trim().toLowerCase();
    if (!q) return favoriteChannels;
    return favoriteChannels.filter((ch) =>
      `${ch.name} ${ch.group ?? ""}`.toLowerCase().includes(q),
    );
  }, [inFavorites, standardVisible, favoriteChannels, query]);

  const loadingFavorites =
    inFavorites && stubSources.length > 0 && favoriteChannels.length < favorites.count;

  const groupLogos = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const ch of sortedChannels) {
      const g = ch.group ?? "Uncategorized";
      if (!m.has(g) && ch.logo) m.set(g, ch.logo);
    }
    return m;
  }, [sortedChannels]);

  const currentChannel = useMemo(() => {
    if (!currentChannelId) return null;
    return playlist?.channels.find((c) => c.id === currentChannelId) ?? null;
  }, [currentChannelId, playlist]);

  const tvgIdCounts = useMemo(
    () => computeTvgIdCounts(playlist?.channels ?? []),
    [playlist?.channels],
  );
  const currentProgram = useMemo(() => {
    if (!currentChannel) return null;
    const programs = epgProgramsForChannel(currentChannel, epg, tvgIdCounts);
    return findCurrent(programs, nowMs).current;
  }, [currentChannel, epg, tvgIdCounts, nowMs]);

  const defaultedGroupRef = useRef(false);
  useEffect(() => {
    if (defaultedGroupRef.current) return;
    if (!playlist) return;
    defaultedGroupRef.current = true;
    if (currentChannel?.group) setGroup(currentChannel.group);
    else if (favorites.count > 0) setGroup(FAVORITES_GROUP_KEY);
  }, [playlist, currentChannel, favorites.count, setGroup]);

  const [guideStyle, setGuideStyle] = useState<"timeline" | "list">(() => {
    try {
      return localStorage.getItem("harbor.guide.style") === "list" ? "list" : "timeline";
    } catch {
      return "timeline";
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem("harbor.guide.style", guideStyle);
    } catch {}
  }, [guideStyle]);
  const toggleGuideStyle = () => {
    setGuideStyle((s) => (s === "timeline" ? "list" : "timeline"));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const scrollRef = useRef<HTMLDivElement>(null);
  useScrollMemory(`live-overlay:${source.id}`, scrollRef, true);

  return (
    <div
      data-tv-focus-scope
      className="pointer-events-auto absolute inset-0 z-[60] flex flex-col bg-canvas/95 text-ink"
    >
      <div className="flex shrink-0 items-start gap-3 px-6 pt-6">
        <button
          onClick={onClose}
          data-tv-modal-close
          aria-label={t("Close guide")}
          className="flex h-11 shrink-0 items-center gap-2 rounded-full border border-edge-soft/60 bg-canvas/80 ps-3 pe-4 text-[13.5px] font-medium text-ink-muted backdrop-blur transition-colors hover:bg-canvas hover:text-ink"
        >
          <X size={15} strokeWidth={2.2} />
          {t("Close")}
        </button>
        <CurrentChannelInfo channel={currentChannel} current={currentProgram} now={nowMs} />
      </div>
      <div className="flex shrink-0 items-center gap-2.5 px-6 pt-4 pb-3">
        <InlineSourceSwitcher sources={sources} selectedId={source.id} onSelect={onSelectSource} />
        <div className="flex h-11 flex-1 items-center gap-2.5 rounded-xl border border-edge-soft/55 bg-elevated px-3.5">
          <Search size={15} strokeWidth={2} className="text-ink-subtle" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              inFavorites
                ? favorites.count === 1
                  ? t("Search {n} favorite", { n: favorites.count })
                  : t("Search {n} favorites", { n: favorites.count })
                : t("Search {n} channels", { n: playlist?.channels.length ?? 0 })
            }
            className="flex-1 bg-transparent text-[14px] text-ink placeholder:text-ink-subtle focus:outline-none"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-[12.5px] font-medium text-ink-subtle transition-colors hover:text-ink"
            >
              {t("Clear")}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={toggleGuideStyle}
          title={
            guideStyle === "timeline"
              ? t("Switch to channel list (hide program guide)")
              : t("Switch to program guide")
          }
          aria-label={t("Toggle guide layout")}
          className="flex h-11 shrink-0 items-center gap-2 rounded-xl border border-edge-soft/55 bg-elevated px-3.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
        >
          {guideStyle === "timeline" ? (
            <List size={15} strokeWidth={2} />
          ) : (
            <CalendarRange size={15} strokeWidth={2} />
          )}
          {guideStyle === "timeline" ? t("List") : t("Guide")}
        </button>
      </div>
      <div className="flex min-h-0 flex-1">
        {playlist && sortedGroups.length > 0 && (
          <CategorySidebar
            groups={sortedGroups}
            active={group}
            onSelect={setGroup}
            counts={counts}
            groupLogos={groupLogos}
            favoritesCount={favorites.count}
            sourceId={playlist?.id ?? ""}
          />
        )}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pt-2 pb-8">
          {inFavorites && loadingFavorites && (
            <div className="mb-3 flex items-center gap-2 rounded-xl border border-edge-soft/55 bg-elevated/70 px-4 py-2 text-[12.5px] text-ink-muted">
              <Loader2 size={13} className="animate-spin text-ink-subtle" />
              {t("Loading favorites from other providers…")}
            </div>
          )}
          {visible.length > 0 && (
            <GuideView
              channels={visible}
              epg={epg}
              nowMs={nowMs}
              currentChannelId={currentChannelId}
              showPrograms={guideStyle === "timeline"}
              onPlay={(channel) => {
                const programs = epgProgramsForChannel(channel, epg, tvgIdCounts);
                onSwitch(channel, findCurrent(programs, nowMs).current?.title);
              }}
              resetKey={`${source.id}|${group ?? ""}|${query}|${guideStyle}`}
            />
          )}
          {visible.length === 0 && playlist && (
            <div className="flex h-40 items-center justify-center text-[13px] text-ink-subtle">
              {inFavorites && favorites.count === 0
                ? t("No favorites yet. Star a channel to pin it here.")
                : inFavorites && loadingFavorites
                  ? t("Loading favorites…")
                  : t("No channels match. Try a different category or clear the search.")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
