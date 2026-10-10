import { hubLeague } from "@/lib/sports/hub-data";
import { legacyEsportsMatch } from "@/lib/sports/legacy-esports-match";
import { Check, Link2, X, Play, ChevronDown, Settings2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Search } from "@/components/icons/search-icon";
import { useT } from "@/lib/i18n";
import { usePlaylists } from "@/lib/iptv/playlists-store";
import { getCachedEpg, subscribeEpg } from "@/lib/iptv/epg-store";
import { computeTvgIdCounts, epgProgramsForChannel } from "@/lib/iptv/epg-resolver";
import { epgOffsetHoursPref } from "@/lib/iptv/settings-bridge";
import { prepareSportsChannels } from "@/lib/sports/channel-index";
import type { IptvChannel, IptvPlaylist, EpgProgram } from "@/lib/iptv/types";
import { getLeagueLabel, type SportsGame } from "@/lib/sports/espn";
import {
  leagueForTag,
  matchChannelsForGameAsync,
  searchSportsChannels,
  type PreparedChannel,
  type SportsChannelIndex,
  type ChannelMatch,
} from "@/lib/sports/iptv-match";
import { hostOf } from "@/lib/sports/stream-resolver";
import { useView } from "@/lib/view";
import { useAllPlaylists } from "@/views/live/hooks/use-all-playlists";
import { loadPlaylist } from "@/lib/iptv/store";
import { AddStreamDialog, useStreamPlayer } from "./add-stream-dialog";
import { setAttachedStream, toggleAttachedChannel, useAttachments } from "./source-store";
import { fixtureLabelOf, useChannelPlayer } from "./watch-flow";
import { SportsAddonSources } from "./addon-source-panel";

let flatKey = "";
let flatChannels: IptvChannel[] = [];

function flatten(playlists: Map<string, IptvPlaylist>): IptvChannel[] {
  const lists = [...playlists.values()];
  const key = lists.map((p) => `${p.id}:${p.fetchedAt}:${p.channels.length}`).join("|");
  if (key === flatKey) return flatChannels;
  flatKey = key;
  flatChannels = lists.flatMap((p) => p.channels);
  return flatChannels;
}

const EMPTY_INDEX: SportsChannelIndex = { channels: [], scanned: 0 };

export function useSportsChannelIndex(): SportsChannelIndex & {
  loading: boolean;
} {
  const sources = usePlaylists();
  const playlists = useAllPlaylists(sources, true);
  const [fetching, setFetching] = useState(true);
  useEffect(() => {
    let active = true;
    setFetching(true);
    void Promise.allSettled(
      sources.filter((source) => source.kind !== "epg").map((source) => loadPlaylist(source)),
    ).then(() => {
      if (active) setFetching(false);
    });
    return () => {
      active = false;
    };
  }, [sources]);
  const channels = useMemo(() => flatten(playlists), [playlists]);
  const [base, setBase] = useState(EMPTY_INDEX);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setBase(EMPTY_INDEX);
    void prepareSportsChannels(channels, controller.signal, setBase)
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [channels]);
  const [epgVersion, setEpgVersion] = useState(0);
  // Reuse Live TV's guide. Opening a match must not download entire XMLTV feeds.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeEpg(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setEpgVersion((version) => version + 1), 1500);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer);
    };
  }, []);
  const [programs, setPrograms] = useState(new Map<string, EpgProgram[]>());
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    const ids = new Set(base.channels.map((item) => item.channel.id));
    const next = new Map<string, EpgProgram[]>();
    const offsetHours = epgOffsetHoursPref();
    void (async () => {
      for (const playlist of playlists.values()) {
        const guide = getCachedEpg(playlist.id);
        if (!guide) continue;
        const counts = computeTvgIdCounts(playlist.channels);
        for (let i = 0; i < playlist.channels.length; i++) {
          if (cancelled) return;
          const channel = playlist.channels[i];
          if (ids.has(channel.id)) {
            const rows = epgProgramsForChannel(channel, guide, counts, offsetHours);
            if (rows?.length) next.set(channel.id, rows);
          }
          if (i % 128 === 127) await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }
      if (!cancelled) setPrograms(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [base, loading, playlists, epgVersion]);
  return useMemo(
    () => ({
      ...base,
      programs,
      loading: loading || fetching || [...playlists.values()].some((playlist) => playlist.loading),
    }),
    [base, programs, loading, fetching, playlists],
  );
}

type WatchSourcesProps = {
  game: SportsGame;
  index?: SportsChannelIndex;
  broadcastNames?: readonly string[];
};

export function WatchSources(props: WatchSourcesProps) {
  if (props.game.state === "post") return null;
  if (legacyEsportsMatch(props.game) || hubLeague(props.game.league)?.group === "esports")
    return <SportsAddonSources game={props.game} />;
  return <ActiveWatchSources {...props} />;
}

function ActiveWatchSources({ game, index, broadcastNames }: WatchSourcesProps) {
  const t = useT();
  const { setView } = useView();
  const playStream = useStreamPlayer();
  const playChannel = useChannelPlayer();
  const sources = usePlaylists();
  const own = useSportsChannelIndex();
  const active = index ?? own;
  const attachments = useAttachments();
  const attachedIds = useMemo(
    () => attachments.channels[game.league] ?? [],
    [attachments, game.league],
  );
  const stream = attachments.streams[game.id] ?? null;
  const [expanded, setExpanded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [webStream, setWebStream] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const addonAnchor = useRef<HTMLDivElement>(null);
  const [hasAddonSources, setHasAddonSources] = useState(false);
  const fixtureLabel = fixtureLabelOf(game);

  const [matches, setMatches] = useState<ChannelMatch[]>([]);
  const [matching, setMatching] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setMatching(true);
    void matchChannelsForGameAsync(
      game,
      active,
      {
        attachedIds,
        broadcastNames: broadcastNames ?? game.broadcasts,
        limit: 8,
      },
      controller.signal,
    )
      .then((matches) => {
        if (!controller.signal.aborted) setMatches(matches);
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setMatching(false);
      });
    return () => controller.abort();
  }, [game, active, attachedIds, broadcastNames]);

  const selected =
    matches.find((m) => m.channel.id === selectedId) ??
    matches.find((m) => m.tier === "exact" || m.attached);
  const play = () => {
    if (stream) playStream(stream, fixtureLabel);
    else if (selected) playChannel(selected.channel, fixtureLabel);
    else if (matches.length) setExpanded(true);
    else if (hasAddonSources) {
      addonAnchor.current?.scrollIntoView({ block: "nearest" });
      (
        addonAnchor.current?.querySelector<HTMLButtonElement>(".sh-addon-choices button") ??
        addonAnchor.current?.querySelector<HTMLButtonElement>(".sh-addon-tools button")
      )?.focus({ preventScroll: true });
    } else if (sources.length) setPicking(true);
    else setView("live");
  };
  return (
    <section ref={anchor} className="sh-watch-panel">
      <div className="sh-watch-heading">
        <span>
          <strong>{t("Watch with your sources")}</strong>
          <small>{t("Your configured IPTV, M3U and Xtream channels, in one place.")}</small>
        </span>
        <button className="sh-watch-play" onClick={play}>
          <Play size={20} fill="currentColor" />
          {t(
            stream || selected
              ? game.state === "pre"
                ? "Preview channel"
                : "Play stream"
              : matches.length
                ? "Choose a channel"
                : hasAddonSources
                  ? "Addon sources"
                  : "Set up sources",
          )}
        </button>
      </div>
      {game.state === "pre" && (
        <p className="sh-watch-preview-note">
          {t("Event has not started. This opens the channel’s current broadcast.")}
        </p>
      )}
      {(matching || own.loading) && <small role="status">{t("Checking your channels…")}</small>}
      <div className="sh-watch-selected">
        <span>
          {stream
            ? stream.title || hostOf(stream.page)
            : selected?.channel.name ||
              t(
                matches.length
                  ? "Possible channels found. Choose the correct broadcast."
                  : hasAddonSources
                    ? "Choose an addon source to see its streams."
                    : "No matching channel is connected yet.",
              )}
        </span>
        {(stream || selected) && (
          <small>
            {t(stream || selected?.attached ? "Your saved source" : "Matched from your channels")}
          </small>
        )}
        {stream && (
          <button
            aria-label={t("Remove this stream")}
            onClick={() => setAttachedStream(game.id, null)}
          >
            <X size={16} />
          </button>
        )}
      </div>
      <div className="sh-watch-actions">
        {matches.length > 0 && (
          <button
            className="sh-button"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            <ChevronDown size={16} />
            {t("Choose channel")} · {matches.length}
          </button>
        )}
        <button
          className="sh-button"
          onClick={() => (sources.length ? setPicking(!picking) : setView("live"))}
        >
          <Settings2 size={16} />
          {t("Configure sources")}
        </button>
        <button className="sh-button" onClick={() => setWebStream(true)}>
          <Link2 size={16} />
          {t("Paste a stream")}
        </button>
      </div>
      {expanded && (
        <div className="sh-watch-channels">
          {matches.map((match) => (
            <button
              key={match.channel.id}
              aria-pressed={selected?.channel.id === match.channel.id && !stream}
              onClick={() => {
                setSelectedId(match.channel.id);
                setAttachedStream(game.id, null);
              }}
            >
              <NetworkMark logo={match.channel.logo} label={match.label} />
              <span>
                <strong>{match.channel.name}</strong>
                <small>
                  {t(
                    match.attached
                      ? "Your pick for this competition"
                      : match.reasons.some((r) => r.kind === "event")
                        ? "Event matchup found"
                        : match.tier === "exact"
                          ? "Strong match"
                          : match.tier === "likely"
                            ? "Likely match · check the broadcast"
                            : "Possible match · check the broadcast",
                  )}
                </small>
              </span>
              {selected?.channel.id === match.channel.id && !stream && <Check size={18} />}
            </button>
          ))}
        </div>
      )}
      <div ref={addonAnchor}>
        <SportsAddonSources
          game={broadcastNames ? { ...game, broadcasts: [...broadcastNames] } : game}
          onAvailable={setHasAddonSources}
        />
      </div>
      {picking && (
        <AttachPopover
          game={game}
          index={active}
          attachedIds={attachedIds}
          anchor={anchor}
          onClose={() => setPicking(false)}
          onWebStream={() => {
            setPicking(false);
            setWebStream(true);
          }}
        />
      )}
      {webStream && (
        <AddStreamDialog
          fixtureLabel={fixtureLabel}
          onAttach={(next) => setAttachedStream(game.id, next)}
          onClose={() => setWebStream(false)}
        />
      )}
    </section>
  );
}

function NetworkMark({ logo, label }: { logo: string | null; label: string }) {
  const [failed, setFailed] = useState(false);
  if (logo && !failed) {
    return (
      <img
        src={logo}
        alt=""
        draggable={false}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-8 w-8 shrink-0 rounded-md object-contain"
      />
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[3px] bg-raised text-[10px] font-bold leading-none text-ink-muted">
      {label
        .replace(/[^\p{L}\p{N}]/gu, "")
        .slice(0, 2)
        .toUpperCase()}
    </span>
  );
}

function AttachPopover({
  game,
  index,
  attachedIds,
  anchor,
  onClose,
  onWebStream,
}: {
  game: SportsGame;
  index: SportsChannelIndex;
  attachedIds: string[];
  anchor: RefObject<HTMLDivElement | null>;
  onClose: () => void;
  onWebStream: () => void;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const def = leagueForTag(game.league);
  const leagueName = def ? getLeagueLabel(def) : game.league;

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!anchor.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [anchor, onClose]);

  const rows = useMemo(() => searchSportsChannels(index, query, 60), [index, query]);
  const attached = new Set(attachedIds);

  return (
    <div className="animate-menu-pop absolute start-0 top-full z-40 mt-1 w-[min(440px,100%)] overflow-hidden rounded-lg border border-edge bg-elevated shadow-[0_18px_44px_-12px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {t("Always use for {league}", { league: leagueName })}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Close")}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
        >
          <X size={11} />
        </button>
      </div>
      <div className="px-3 py-2">
        <div className="relative">
          <Search
            size={13}
            className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-ink-subtle"
          />
          <input
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search your channels")}
            className="h-9 w-full rounded-lg bg-canvas ps-8 pe-3 text-[12.5px] text-ink ring-1 ring-inset ring-edge-soft transition-colors placeholder:text-ink-subtle focus:outline-none focus:ring-accent/50"
          />
        </div>
      </div>
      <div className="max-h-[248px] overflow-y-auto pb-1">
        {rows.length === 0 ? (
          <p className="px-3 pb-3 pt-1 text-[12px] leading-relaxed text-ink-subtle">
            {t("No sports channels found in your playlists.")}
          </p>
        ) : (
          rows.map((row) => (
            <ChannelRow
              key={row.channel.id}
              row={row}
              on={attached.has(row.channel.id)}
              onToggle={() => toggleAttachedChannel(game.league, row.channel.id)}
            />
          ))
        )}
      </div>
      <button
        type="button"
        onClick={onWebStream}
        className="flex w-full items-center gap-2 border-t border-edge-soft px-3 py-2.5 text-start text-[12.5px] text-ink-muted transition-colors hover:bg-raised hover:text-ink"
      >
        <Link2 size={13} className="shrink-0 text-ink-subtle" />
        {t("Find a stream on a web page")}
      </button>
    </div>
  );
}

function ChannelRow({
  row,
  on,
  onToggle,
}: {
  row: PreparedChannel;
  on: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 px-3 py-2 text-start transition-colors hover:bg-raised"
    >
      <NetworkMark logo={row.channel.logo} label={row.label} />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[12.5px] ${on ? "text-ink" : "text-ink-muted"}`}>
          {row.channel.name}
        </span>
        {row.channel.group && (
          <span className="block truncate text-[10.5px] text-ink-subtle">{row.channel.group}</span>
        )}
      </span>
      {on ? (
        <span
          key="on"
          className="harbor-pop flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent text-canvas"
        >
          <Check size={9} strokeWidth={3} />
        </span>
      ) : (
        <span key="off" className="h-4 w-4 shrink-0 rounded-full bg-raised" />
      )}
    </button>
  );
}
