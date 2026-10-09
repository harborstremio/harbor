import { useCallback, useMemo, useState } from "react";
import { ChevronRight, LayoutGrid, ListTree, Play, Search, Star, Tv, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { toPlaylistSource } from "@/lib/iptv/active-source";
import { computeTvgIdCounts, epgProgramsForChannel } from "@/lib/iptv/epg-resolver";
import { useEpgMapVersion } from "@/lib/iptv/epg-map";
import { useFavorites } from "@/lib/iptv/favorites";
import { useAllGroupPrefs } from "@/lib/iptv/group-order";
import { usePlaylists } from "@/lib/iptv/playlists-store";
import type { EpgIndex, EpgProgram, IptvChannel } from "@/lib/iptv/types";
import { isLiveChannel } from "@/lib/iptv/vod-classify";
import { findCurrent } from "@/lib/iptv/xmltv";
import { setWatchingGame } from "@/lib/jl/sports/now-watching";
import {
  SPORT_CATEGORIES,
  SPORT_LABELS,
  applyLiveState,
  chipCounts,
  collectSportsChannels,
  filterSportsEntries,
  listedSportsEntries,
  sourceIdOf,
  sportsChannelRows,
  type LiveSportsEntry,
  type SportsChip,
} from "@/lib/jl/sports/sports-channels";
import type { SportsGame } from "@/lib/sports/espn";
import { GuideView } from "../../guide/guide-view";
import { useAllPlaylists } from "../../hooks/use-all-playlists";
import { fmtClock, fmtLeft } from "../now-format";
import { JlDialog } from "./jl-dialog";
import type { JlHubGame } from "./use-jl-sports";

const CHIP_KEY = "jl.sports.channels.chip";
const LAYOUT_KEY = "jl.sports.channels.layout";
const ROW_LIMIT = 24;
const GRID_PAGE = 60;
const DAY_MS = 24 * 3600000;
const LIVE_BUCKET_MS = 60_000;

type Layout = "rows" | "guide";
type NowNext = { current: EpgProgram | null; next: EpgProgram | null };
const NO_PROGRAM: NowNext = { current: null, next: null };

function readPref<T extends string>(key: string, fallback: T, ok: (v: string) => boolean): T {
  try {
    const v = localStorage.getItem(key);
    return v && ok(v) ? (v as T) : fallback;
  } catch {
    return fallback;
  }
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

const isChip = (v: string) =>
  v === "all" || v === "live" || (SPORT_CATEGORIES as string[]).includes(v);

/**
 * Live Sports Channels: the viewer's own sports channels, across every provider they added,
 * grouped by sport with the guide's now/next. Separate from Live TV; playback goes through the
 * same player path (onPlay), and a channel matched to a game remembers it for the live field.
 */
export function LiveSportsChannels({
  active,
  channels,
  activeSourceId,
  epg,
  nowMs,
  games,
  onPlay,
}: {
  active: boolean;
  /** The active provider's channels, as Live TV shows them (hidden groups removed). */
  channels: IptvChannel[];
  activeSourceId: string | null;
  epg: EpgIndex | null;
  nowMs: number;
  /** Hub games with their matched channels, so playing one of them can offer the live field. */
  games: JlHubGame[];
  onPlay: (channel: IptvChannel) => void;
}) {
  const t = useT();
  const favorites = useFavorites();
  const epgMapVersion = useEpgMapVersion();

  // Providers live in their own store now; the settings field is only a migration source.
  const playlists = usePlaylists();
  const sourceNames = useMemo(
    () => new Map(playlists.map((s) => [s.id, s.name] as const)),
    [playlists],
  );
  const otherSources = useMemo(
    () =>
      playlists
        .filter((s) => (s.kind ?? "m3u") !== "epg" && s.id !== activeSourceId)
        .map(toPlaylistSource),
    [playlists, activeSourceId],
  );
  const otherPlaylists = useAllPlaylists(otherSources, active && otherSources.length > 0);
  const groupPrefs = useAllGroupPrefs();

  // Other providers' channels, minus the groups the viewer hid for them in Live TV (the active
  // provider's channels arrive with its hidden groups already removed).
  const allChannels = useMemo(() => {
    const out = [...channels];
    for (const s of otherSources) {
      const pl = otherPlaylists.get(s.id);
      if (!pl) continue;
      const hidden = new Set(groupPrefs[s.id]?.hidden ?? []);
      for (const c of pl.channels) {
        if (isLiveChannel(c) && !hidden.has(c.group ?? "Uncategorized")) out.push(c);
      }
    }
    return out;
  }, [channels, otherSources, otherPlaylists, groupPrefs]);

  // Classification is the expensive pass: only when the channels change (and once a day for the
  // year of event kick-offs).
  const day = Math.floor(nowMs / DAY_MS);
  const collected = useMemo(
    () =>
      collectSportsChannels(allChannels, {
        now: new Date(day * DAY_MS),
        preferredSourceId: activeSourceId,
      }),
    [allChannels, activeSourceId, day],
  );

  const tvgIdCounts = useMemo(() => computeTvgIdCounts(channels), [channels]);
  const minute = Math.floor(nowMs / LIVE_BUCKET_MS);
  // Now/next for every sports channel, refreshed each minute; the guide layout resolves its own.
  // Tagged with the EPG-match version: a manual match changes what a channel resolves to.
  const nowNextById = useMemo(() => {
    const m = new Map<string, NowNext>();
    const at = minute * LIVE_BUCKET_MS;
    for (const e of collected) {
      for (const c of e.channels)
        m.set(c.id, findCurrent(epgProgramsForChannel(c, epg, tvgIdCounts), at));
    }
    return { version: epgMapVersion, m };
  }, [collected, epg, tvgIdCounts, minute, epgMapVersion]);
  const nowNext = useCallback(
    (ch: IptvChannel): NowNext => nowNextById.m.get(ch.id) ?? NO_PROGRAM,
    [nowNextById],
  );

  // Empty event slots are placeholders, not channels: they are neither listed nor counted.
  const entries = useMemo(
    () =>
      listedSportsEntries(
        applyLiveState(collected, {
          now: minute * LIVE_BUCKET_MS,
          currentTitle: (c) => nowNext(c).current?.title ?? null,
          favoriteIds: favorites.ids,
        }),
      ),
    [collected, minute, nowNext, favorites.ids],
  );

  const gameByChannel = useMemo(() => {
    const m = new Map<string, SportsGame>();
    for (const g of games)
      for (const c of g.channels) if (!m.has(c.channel.id)) m.set(c.channel.id, g.game);
    return m;
  }, [games]);

  const [chip, setChipState] = useState<SportsChip>(() =>
    readPref<SportsChip>(CHIP_KEY, "all", isChip),
  );
  const [layout, setLayoutState] = useState<Layout>(() =>
    readPref<Layout>(LAYOUT_KEY, "rows", (v) => v === "rows" || v === "guide"),
  );
  const [query, setQuery] = useState("");
  const [gridLimit, setGridLimit] = useState(GRID_PAGE);
  const [choosing, setChoosing] = useState<LiveSportsEntry | null>(null);

  const setChip = (c: SportsChip) => {
    setChipState(c);
    setGridLimit(GRID_PAGE);
    writePref(CHIP_KEY, c);
  };
  const setLayout = (l: Layout) => {
    setLayoutState(l);
    writePref(LAYOUT_KEY, l);
  };

  const counts = useMemo(() => chipCounts(entries), [entries]);
  const filtered = useMemo(
    () =>
      filterSportsEntries(entries, {
        chip,
        query,
        extraText: (e) => nowNext(e.channels[0]).current?.title ?? "",
      }),
    [entries, chip, query, nowNext],
  );
  const rows = useMemo(() => sportsChannelRows(entries), [entries]);

  const play = (ch: IptvChannel) => {
    const game = gameByChannel.get(ch.id);
    if (game) setWatchingGame(ch.id, game);
    onPlay(ch);
  };
  const activate = (e: LiveSportsEntry) => {
    if (e.channels.length > 1) setChoosing(e);
    else play(e.channels[0]);
  };

  if (entries.length === 0) return null;

  const browsing = chip === "all" && !query.trim();
  const chips: SportsChip[] = [
    "all",
    "live",
    ...SPORT_CATEGORIES.filter((s) => (counts.get(s) ?? 0) > 0),
  ];
  const chipLabel = (c: SportsChip) =>
    c === "all" ? t("All") : c === "live" ? t("Live now") : t(SPORT_LABELS[c]);

  return (
    <section className="flex flex-col gap-3 ps-[9px]" aria-label={t("Live Sports Channels")}>
      <div className="flex flex-wrap items-center gap-2.5 pe-[9px]">
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-ink-subtle">
          {t("Live Sports Channels")}
        </h2>
        <span className="text-[12px] text-ink-subtle/80">
          {t("{n} channels from your playlists", { n: entries.length })}
        </span>
        <div className="ms-auto flex h-9 items-center gap-0.5 rounded-xl border border-edge-soft/55 bg-elevated p-1">
          <LayoutButton
            active={layout === "rows"}
            onClick={() => setLayout("rows")}
            icon={<LayoutGrid size={13} />}
            label={t("Channels")}
          />
          <LayoutButton
            active={layout === "guide"}
            onClick={() => setLayout("guide")}
            icon={<ListTree size={13} />}
            label={t("Sports guide")}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pe-[9px]">
        <label className="flex h-9 w-[240px] items-center gap-2 rounded-full border border-edge-soft/55 bg-elevated px-3">
          <Search size={13} strokeWidth={2} className="shrink-0 text-ink-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setGridLimit(GRID_PAGE);
            }}
            placeholder={t("Search sports channels")}
            aria-label={t("Search sports channels")}
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-ink placeholder:text-ink-subtle focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              aria-label={t("Clear search")}
              className="text-ink-subtle hover:text-ink"
            >
              <X size={13} strokeWidth={2} />
            </button>
          )}
        </label>
        <div
          className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5"
          role="tablist"
          aria-label={t("Filter by sport")}
        >
          {chips.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={chip === c}
              onClick={() => setChip(c)}
              className={`flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold transition-colors ${
                chip === c
                  ? "border-ink bg-ink text-canvas"
                  : "border-edge-soft text-ink-muted hover:border-edge hover:text-ink"
              }`}
            >
              {c === "live" && <span className="h-1.5 w-1.5 rounded-full bg-danger" />}
              {chipLabel(c)}
              <span className={chip === c ? "text-canvas/70" : "text-ink-subtle"}>
                {counts.get(c) ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {layout === "guide" ? (
        filtered.length > 0 ? (
          <div className="pe-[9px]">
            <GuideView
              channels={filtered.map((e) => e.channels[0])}
              epg={epg}
              nowMs={nowMs}
              onPlay={play}
              resetKey={`sports|${chip}|${query}`}
            />
          </div>
        ) : (
          <Empty />
        )
      ) : browsing ? (
        <div className="flex flex-col gap-5">
          {rows.live.length > 0 && (
            <Row
              title={t("Live events now")}
              live
              entries={rows.live}
              total={rows.live.length}
              onSeeAll={() => setChip("live")}
              nowNext={nowNext}
              nowMs={nowMs}
              sourceNames={sourceNames}
              onActivate={activate}
            />
          )}
          {rows.rows.map((r) => (
            <Row
              key={r.sport}
              title={t(SPORT_LABELS[r.sport])}
              entries={r.entries}
              total={r.entries.length}
              onSeeAll={() => setChip(r.sport)}
              nowNext={nowNext}
              nowMs={nowMs}
              sourceNames={sourceNames}
              onActivate={activate}
            />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="flex flex-col gap-3 pe-[9px]">
          <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
            {filtered.slice(0, gridLimit).map((e) => (
              <ChannelCard
                key={e.key}
                entry={e}
                nowNext={nowNext}
                nowMs={nowMs}
                sourceNames={sourceNames}
                onActivate={activate}
              />
            ))}
          </div>
          {filtered.length > gridLimit && (
            <button
              onClick={() => setGridLimit((n) => n + GRID_PAGE)}
              className="mx-auto flex h-9 items-center rounded-full border border-edge-soft px-4 text-[12.5px] font-semibold text-ink-muted hover:border-edge hover:text-ink"
            >
              {t("Show more ({n} left)", { n: filtered.length - gridLimit })}
            </button>
          )}
        </div>
      ) : (
        <Empty />
      )}

      {choosing && (
        <SourceChooser
          entry={choosing}
          nowNext={nowNext}
          sourceNames={sourceNames}
          onPlay={(c) => {
            setChoosing(null);
            play(c);
          }}
          onClose={() => setChoosing(null)}
        />
      )}
    </section>
  );
}

function Empty() {
  const t = useT();
  return <p className="pe-[9px] text-[13px] text-ink-subtle">{t("No sports channels match.")}</p>;
}

function LayoutButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`flex h-full items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold transition-colors ${
        active ? "bg-ink text-canvas" : "text-ink-muted hover:bg-raised hover:text-ink"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

type CardContext = {
  nowNext: (ch: IptvChannel) => NowNext;
  nowMs: number;
  sourceNames: ReadonlyMap<string, string>;
  onActivate: (e: LiveSportsEntry) => void;
};

function Row({
  title,
  live = false,
  entries,
  total,
  onSeeAll,
  ...ctx
}: CardContext & {
  title: string;
  live?: boolean;
  entries: LiveSportsEntry[];
  total: number;
  onSeeAll: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 pe-[9px]">
        {live && <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />}
        <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
        <span className="text-[12px] text-ink-subtle">{total}</span>
        {total > ROW_LIMIT && (
          <button
            onClick={onSeeAll}
            className="ms-auto flex h-7 items-center gap-0.5 rounded-full px-2.5 text-[12px] font-semibold text-ink-muted hover:text-ink"
          >
            {t("See all")}
            <ChevronRight size={13} className="dir-icon" />
          </button>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 pe-[9px]">
        {entries.slice(0, ROW_LIMIT).map((e) => (
          <div key={e.key} className="w-[270px] shrink-0">
            <ChannelCard entry={e} {...ctx} />
          </div>
        ))}
      </div>
    </div>
  );
}

function programOf(entry: LiveSportsEntry, nowNext: (ch: IptvChannel) => NowNext): NowNext {
  for (const c of entry.channels) {
    const v = nowNext(c);
    if (v.current || v.next) return v;
  }
  return { current: null, next: null };
}

function ChannelCard({
  entry,
  nowNext,
  nowMs,
  sourceNames,
  onActivate,
}: CardContext & { entry: LiveSportsEntry }) {
  const t = useT();
  const [logoErr, setLogoErr] = useState(false);
  const primary = entry.channels[0];
  const logo = entry.channels.find((c) => c.logo)?.logo ?? null;
  const { current, next } = programOf(entry, nowNext);
  const progress =
    current && current.endMs > current.startMs
      ? Math.min(1, Math.max(0, (nowMs - current.startMs) / (current.endMs - current.startMs)))
      : null;
  const left = current ? fmtLeft(current.endMs, nowMs, t) : null;
  const providers = new Set(entry.channels.map((c) => sourceIdOf(c.id)));
  const source = sourceNames.get(sourceIdOf(primary.id));
  const subtitle = [entry.slot, providers.size === 1 && sourceNames.size > 1 ? source : null]
    .filter(Boolean)
    .join(" · ");
  const startText =
    entry.start != null && !entry.liveNow
      ? new Date(entry.start).toDateString() === new Date(nowMs).toDateString()
        ? fmtClock(entry.start)
        : `${new Date(entry.start).toLocaleDateString(undefined, { month: "short", day: "numeric" })} ${fmtClock(entry.start)}`
      : null;

  return (
    <button
      type="button"
      data-art={logo ?? ""}
      onClick={() => onActivate(entry)}
      aria-label={t("Play {name}", { name: entry.title })}
      className={`group/sc flex h-full w-full flex-col gap-2 rounded-xl border bg-elevated p-3 text-start transition-colors hover:border-edge focus:border-ink-subtle focus:outline-none ${
        entry.idle ? "border-edge-soft/40 opacity-70" : "border-edge-soft/55"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-canvas/60">
          {logo && !logoErr ? (
            <img
              src={logo}
              alt=""
              draggable={false}
              loading="lazy"
              onError={() => setLogoErr(true)}
              className="max-h-8 max-w-12 object-contain"
            />
          ) : (
            <Tv size={18} strokeWidth={1.6} className="text-ink-subtle" />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            dir="auto"
            className="line-clamp-2 text-[13.5px] font-semibold leading-tight text-ink"
          >
            {entry.title}
          </span>
          {subtitle && <span className="truncate text-[11px] text-ink-subtle">{subtitle}</span>}
        </span>
        <span className="flex shrink-0 flex-col items-end gap-1">
          {entry.liveNow ? (
            <span className="flex h-[18px] items-center gap-1 rounded bg-danger px-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-white">
              {t("Live")}
            </span>
          ) : startText ? (
            <span className="text-[11px] font-semibold text-ink-subtle">{startText}</span>
          ) : null}
          {entry.favorite && (
            <Star size={12} fill="currentColor" strokeWidth={0} className="text-accent" />
          )}
        </span>
      </div>
      <div className="flex min-h-[34px] flex-col gap-1">
        {current ? (
          <>
            <div className="flex items-baseline gap-2 text-[12px]">
              <span className="shrink-0 font-semibold uppercase tracking-[0.08em] text-[10px] text-ink-subtle">
                {t("Now")}
              </span>
              <span dir="auto" className="truncate text-ink-muted">
                {current.title}
              </span>
            </div>
            {progress != null && (
              <div className="flex items-center gap-2">
                <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-canvas/60">
                  <div
                    className="h-full rounded-full bg-danger"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                {left && <span className="shrink-0 text-[10.5px] text-ink-subtle">{left}</span>}
              </div>
            )}
          </>
        ) : null}
        {next && (
          <div className="flex items-baseline gap-2 text-[11.5px]">
            <span className="shrink-0 font-semibold uppercase tracking-[0.08em] text-[10px] text-ink-subtle">
              {fmtClock(next.startMs)}
            </span>
            <span dir="auto" className="truncate text-ink-subtle">
              {next.title}
            </span>
          </div>
        )}
      </div>
      <div className="mt-auto flex items-center gap-1.5 text-[11px] text-ink-subtle">
        <Play size={11} fill="currentColor" strokeWidth={0} className="text-accent" />
        {entry.channels.length > 1
          ? providers.size > 1
            ? t("{n} providers", { n: providers.size })
            : t("{n} feeds", { n: entry.channels.length })
          : t("Watch")}
      </div>
    </button>
  );
}

/** The same channel on several providers or feeds: pick one. Nothing plays until you do. */
function SourceChooser({
  entry,
  nowNext,
  sourceNames,
  onPlay,
  onClose,
}: {
  entry: LiveSportsEntry;
  nowNext: (ch: IptvChannel) => NowNext;
  sourceNames: ReadonlyMap<string, string>;
  onPlay: (channel: IptvChannel) => void;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <JlDialog title={entry.title} onClose={onClose}>
      <div className="flex flex-col gap-1.5">
        {entry.channels.map((c) => {
          const now = nowNext(c).current?.title;
          return (
            <button
              key={c.id}
              onClick={() => onPlay(c)}
              className="flex items-center gap-3 rounded-xl border border-edge-soft bg-canvas/40 px-3.5 py-2.5 text-start transition-colors hover:border-edge focus:border-ink-subtle focus:outline-none"
            >
              {c.logo ? (
                <img
                  src={c.logo}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded object-contain"
                  loading="lazy"
                />
              ) : (
                <Tv size={18} className="shrink-0 text-ink-subtle" />
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13.5px] font-medium text-ink">{c.name}</span>
                <span className="truncate text-[11.5px] text-ink-subtle">
                  {[sourceNames.get(sourceIdOf(c.id)) ?? t("Playlist"), now]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <Play
                size={14}
                fill="currentColor"
                strokeWidth={0}
                className="shrink-0 text-accent"
              />
            </button>
          );
        })}
      </div>
    </JlDialog>
  );
}
