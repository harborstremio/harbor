import { Check, Globe, Link2, Plus, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Search } from "@/components/icons/search-icon";
import { useT } from "@/lib/i18n";
import { usePlaylists } from "@/lib/iptv/playlists-store";
import type { IptvChannel, IptvPlaylist } from "@/lib/iptv/types";
import { getLeagueLabel, type SportsGame } from "@/lib/sports/espn";
import {
  buildSportsChannelIndex,
  leagueForTag,
  matchChannelsForGame,
  searchSportsChannels,
  type ChannelMatch,
  type PreparedChannel,
  type SportsChannelIndex,
} from "@/lib/sports/iptv-match";
import { hostOf } from "@/lib/sports/stream-resolver";
import { useView } from "@/lib/view";
import { useAllPlaylists } from "@/views/live/hooks/use-all-playlists";
import { AddStreamDialog, useStreamPlayer } from "./add-stream-dialog";
import {
  setAttachedStream,
  toggleAttachedChannel,
  useAttachments,
  type AttachedStream,
} from "./source-store";
import { fixtureLabelOf, useChannelPlayer } from "./watch-flow";

const VISIBLE_CHIPS = 4;
const CHIP =
  "inline-flex h-[22px] items-center gap-1.5 rounded-sm px-1.5 text-[10.5px] uppercase tracking-[0.04em] ring-1 ring-inset transition-colors";
const CHIP_QUIET = `${CHIP} bg-canvas font-medium text-ink-subtle ring-edge-soft hover:text-ink`;

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

export function useSportsChannelIndex(): SportsChannelIndex {
  const sources = usePlaylists();
  const playlists = useAllPlaylists(sources, true);
  return useMemo(() => buildSportsChannelIndex(flatten(playlists)), [playlists]);
}

export function WatchSources({
  game,
  index,
  broadcastNames,
}: {
  game: SportsGame;
  index?: SportsChannelIndex;
  broadcastNames?: readonly string[];
}) {
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
  const [picking, setPicking] = useState(false);
  const [webStream, setWebStream] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const fixtureLabel = fixtureLabelOf(game);

  const matches = useMemo(
    () => matchChannelsForGame(game, active, { attachedIds, broadcastNames, limit: 8 }),
    [game, active, attachedIds, broadcastNames],
  );

  if (game.state === "post") return null;

  const noSources = sources.length === 0;
  const shown = noSources ? [] : expanded ? matches : matches.slice(0, VISIBLE_CHIPS);
  const hidden = noSources ? 0 : matches.length - shown.length;

  return (
    <div ref={anchor} className="relative flex flex-wrap items-center gap-1.5">
      {stream && (
        <StreamChip
          stream={stream}
          onPlay={() => playStream(stream, fixtureLabel)}
          onDetach={() => setAttachedStream(game.id, null)}
        />
      )}
      {shown.map((match, i) => (
        <SourceChip
          key={match.channel.id}
          match={match}
          lead={i === 0}
          onPlay={() => playChannel(match.channel, fixtureLabel)}
        />
      ))}
      {hidden > 0 && (
        <button type="button" onClick={() => setExpanded(true)} className={CHIP_QUIET}>
          {`+${hidden}`}
        </button>
      )}
      {noSources ? (
        <>
          <button type="button" onClick={() => setView("live")} className={CHIP_QUIET}>
            <Plus size={9} />
            {t("Add an IPTV source")}
          </button>
          <button type="button" onClick={() => setWebStream(true)} className={CHIP_QUIET}>
            <Link2 size={9} />
            {t("Paste a stream")}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setPicking((v) => !v)}
          className={`${CHIP} font-medium ${
            picking ? "bg-raised text-ink ring-edge" : "bg-canvas text-ink-subtle ring-edge-soft hover:text-ink"
          }`}
        >
          <Plus size={9} />
          {matches.length === 0 ? t("Attach a channel") : t("Source")}
        </button>
      )}
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
    </div>
  );
}

function SourceChip({ match, lead, onPlay }: { match: ChannelMatch; lead: boolean; onPlay: () => void }) {
  const t = useT();
  const why = match.attached
    ? t("Your pick for this competition")
    : match.reasons.map((r) => r.label).filter(Boolean).join(" · ");
  const look = match.attached
    ? "bg-elevated font-semibold text-ink ring-accent/40"
    : lead && match.tier !== "possible"
      ? "bg-elevated font-semibold text-ink ring-edge"
      : "bg-canvas font-medium text-ink-muted ring-edge-soft hover:text-ink";
  return (
    <button
      type="button"
      onClick={onPlay}
      title={why ? `${match.channel.name} · ${why}` : match.channel.name}
      className={`animate-item-in ${CHIP} max-w-[190px] ${look}`}
    >
      <NetworkMark logo={match.channel.logo} label={match.label} />
      <span className="truncate">{match.label}</span>
    </button>
  );
}

function StreamChip({
  stream,
  onPlay,
  onDetach,
}: {
  stream: AttachedStream;
  onPlay: () => void;
  onDetach: () => void;
}) {
  const t = useT();
  const host = hostOf(stream.page);
  return (
    <span className={`animate-item-in ${CHIP} max-w-[190px] bg-elevated font-semibold text-ink ring-accent/40`}>
      <button
        type="button"
        onClick={onPlay}
        title={stream.title ? `${stream.title} · ${host}` : host}
        className="flex min-w-0 items-center gap-1.5"
      >
        <Globe size={10} className="shrink-0 text-ink-subtle" />
        <span className="truncate">{host}</span>
      </button>
      <button
        type="button"
        onClick={onDetach}
        aria-label={t("Remove this stream")}
        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-ink-subtle transition-colors hover:bg-raised hover:text-ink"
      >
        <X size={9} />
      </button>
    </span>
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
        className="h-3 w-4 shrink-0 rounded-[3px] object-cover"
      />
    );
  }
  return (
    <span className="flex h-3 w-4 shrink-0 items-center justify-center rounded-[3px] bg-raised text-[7px] font-bold leading-none text-ink-muted">
      {label.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 2).toUpperCase()}
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
    <div className="animate-menu-pop absolute start-0 top-full z-40 mt-1 w-[280px] overflow-hidden rounded-lg border border-edge bg-elevated shadow-[0_18px_44px_-12px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between gap-2 px-3 pt-2.5">
        <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
          {t("Always use for {league}", { league: leagueName })}
        </span>
        <button
          type="button"
          onClick={onClose}
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

function ChannelRow({ row, on, onToggle }: { row: PreparedChannel; on: boolean; onToggle: () => void }) {
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
