import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Tv } from "lucide-react";
import { useT } from "@/lib/i18n";
import { readActiveId, resolveActiveSource } from "@/lib/iptv/active-source";
import { useFavorites } from "@/lib/iptv/favorites";
import { getCachedPlaylist } from "@/lib/iptv/store";
import type { IptvChannel, IptvPlaylist, IptvPlaylistSource } from "@/lib/iptv/types";
import { useParental } from "@/lib/parental";
import { useSettings } from "@/lib/settings";
import { DEFAULT_SPORTS_LEAGUES, LEAGUES } from "@/lib/sports/espn";
import { useScrollMemory, useView } from "@/lib/view";
import { useChannelPipeline } from "./live/hooks/use-channel-pipeline";
import { useEpg, useNowTick } from "./live/hooks/use-epg";
import { useIptvPlaylist } from "./live/hooks/use-iptv-playlist";
import { useLiveActions } from "./live/hooks/use-live-actions";
import { useXtreamEpgFallback } from "./live/hooks/use-xtream-epg-fallback";
import { GameStoriesRow, useGameStories } from "./live/live-home/jl-sports/game-stories";
import { AlsoToday, JlSportsHub } from "./live/live-home/jl-sports/jl-sports-hub";
import { LiveSportsChannels } from "./live/live-home/jl-sports/live-sports-channels";
import { JlSportsHero } from "./live/live-home/jl-sports/sports-hero";
import { useJlSports } from "./live/live-home/jl-sports/use-jl-sports";
import { useJlSportsDialogs } from "./live/live-home/jl-sports/use-jl-sports-dialogs";
import { usePrefetchTeamArt } from "./live/live-home/jl-sports/use-sports-extras";
import { SportsMarquee } from "./live/live-home/sports/sports-marquee";
import { useSports } from "./live/live-home/use-sports";

const LEAGUE_KEY = "harbor.sports.league";
const EMPTY_CHANNELS: IptvChannel[] = [];
const EMPTY_PLAYLISTS = new Map<string, IptvPlaylist>();
const EMPTY_SOURCES: IptvPlaylistSource[] = [];

export function SportsView({ active }: { active: boolean }) {
  const t = useT();
  const { settings, update } = useSettings();
  const { setView, openMatchDetail } = useView();
  const { locked, hiddenTabs } = useParental();
  const sources = settings.iptvPlaylists;
  const hasChannelSource = sources.some((s) => (s.kind ?? "m3u") !== "epg");

  // Live TV owns the active-source choice; re-read it whenever this tab is shown.
  const [activeId, setActiveId] = useState<string | null>(() => readActiveId());
  useEffect(() => {
    if (active) setActiveId(readActiveId());
  }, [active]);
  const activeSource = useMemo(() => resolveActiveSource(sources, activeId), [sources, activeId]);

  const { state } = useIptvPlaylist(active ? activeSource : null);
  const cachedForActive = getCachedPlaylist(activeSource?.id ?? "");
  const playlist =
    state.kind === "ready"
      ? state.playlist
      : cachedForActive && cachedForActive.id === activeSource?.id
        ? cachedForActive
        : null;
  const epgOnlyUrls = useMemo(
    () => sources.filter((s) => s.kind === "epg").map((s) => s.epgUrl || s.url),
    [sources],
  );
  const { index: baseEpg } = useEpg(active ? activeSource : null, epgOnlyUrls);
  const epg = useXtreamEpgFallback(activeSource, playlist?.channels ?? EMPTY_CHANNELS, baseEpg);
  const nowMs = useNowTick(30_000);

  const favorites = useFavorites();
  const region = settings.region || "US";
  const preferredLanguages =
    settings.preferredLanguages.length > 0 ? settings.preferredLanguages : ["English"];
  const { shownChannels } = useChannelPipeline({
    playlist,
    region,
    preferredLanguages,
    mode: "home",
    group: null,
    query: "",
    favorites,
    allPlaylists: EMPTY_PLAYLISTS,
    allSources: EMPTY_SOURCES,
  });

  const { handlePlay } = useLiveActions({ epg, activeId: activeSource?.id ?? null, playlist });

  const userSportsLeagues = settings.sportsLeagues?.length
    ? settings.sportsLeagues
    : DEFAULT_SPORTS_LEAGUES;
  const [sportsLeague, setSportsLeague] = useState<string>(() => {
    try {
      return localStorage.getItem(LEAGUE_KEY) || "all";
    } catch {
      return "all";
    }
  });
  const pickLeague = (k: string) => {
    setSportsLeague(k);
    try {
      localStorage.setItem(LEAGUE_KEY, k);
    } catch {}
  };
  const sportsLeagues = useMemo(
    () => (sportsLeague === "all" ? userSportsLeagues : [sportsLeague]),
    [sportsLeague, userSportsLeagues],
  );
  const sports = useSports({ enabled: active, leagues: sportsLeagues });
  const jlSports = useJlSports({ channels: shownChannels, epg, nowMs });
  const jlDialogs = useJlSportsDialogs({
    players: jlSports.players,
    onPlay: handlePlay,
    onOpenGame: openMatchDetail,
  });
  const stories = useGameStories({ ...jlSports, nowMs });
  // Every team on the page asks TheSportsDB at once (one list per league), hero first.
  const artGames = useMemo(
    () => [...jlSports.top.map((r) => r.game), ...jlSports.alsoToday.flatMap((g) => g.items.map((r) => r.game))],
    [jlSports.top, jlSports.alsoToday],
  );
  const artTeams = useMemo(
    () => jlSports.teamSlides.flatMap((s) => (s.side ? [{ league: s.team.league, side: s.side }] : [])),
    [jlSports.teamSlides],
  );
  usePrefetchTeamArt(artGames, artTeams);

  const scrollRef = useRef<HTMLElement>(null);
  useScrollMemory("sports", scrollRef, active);

  const liveTvLocked = locked && hiddenTabs.liveTv;

  return (
    <main ref={scrollRef} className="flex-1 overflow-y-auto px-12 pb-20 pt-28">
      <div className="flex flex-col gap-8">
        {(jlSports.top.length > 0 || jlSports.teamSlides.length > 0 || jlSports.playerSlides.length > 0) && (
          <div className="-mb-4">
            <JlSportsHero
              top={jlSports.top}
              teamSlides={jlSports.teamSlides}
              playerSlides={jlSports.playerSlides}
              actions={jlDialogs.actions}
              onOpenGame={openMatchDetail}
              bleed
            />
          </div>
        )}
        <GameStoriesRow stories={stories} onWatch={jlDialogs.actions.watch} onOpenGame={openMatchDetail} />
        {!hasChannelSource && (
          <div className="ms-[9px] flex flex-wrap items-center gap-4 rounded-2xl border border-edge-soft/55 bg-elevated px-5 py-4">
            <Tv size={18} strokeWidth={2} className="shrink-0 text-ink-subtle" />
            <p className="min-w-[200px] flex-1 text-[14px] text-ink-muted">
              {t("Add your IPTV provider to watch games on your channels")}
            </p>
            {!liveTvLocked && (
              <button
                type="button"
                onClick={() => setView("live")}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-ink ps-5 pe-4 text-[13.5px] font-semibold text-canvas transition-all duration-150 ease-out hover:opacity-90 active:scale-[0.97]"
              >
                {t("Open Live TV")}
                <ArrowRight size={15} strokeWidth={2.2} className="dir-icon" />
              </button>
            )}
          </div>
        )}
        <JlSportsHub
          top={jlSports.top}
          ticker={jlSports.ticker}
          favorites={jlSports.teams}
          actions={jlDialogs.actions}
          onOpenGame={openMatchDetail}
        />
        <AlsoToday
          groups={jlSports.alsoToday}
          favorites={jlSports.teams}
          actions={jlDialogs.actions}
          onOpenGame={openMatchDetail}
        />
        <LiveSportsChannels
          active={active}
          channels={shownChannels}
          activeSourceId={activeSource?.id ?? null}
          epg={epg}
          nowMs={nowMs}
          games={jlSports.top}
          onPlay={handlePlay}
        />
        {(sports.length > 0 || sportsLeague !== "all" || userSportsLeagues.length > 0) && (
          <SportsMarquee
            games={sports}
            leagues={LEAGUES}
            selected={sportsLeague}
            selectedLeagues={userSportsLeagues}
            onLeague={pickLeague}
            onLeaguesChange={(keys) => update({ sportsLeagues: keys })}
            onSelect={openMatchDetail}
          />
        )}
      </div>
      {jlDialogs.dialogs}
    </main>
  );
}
