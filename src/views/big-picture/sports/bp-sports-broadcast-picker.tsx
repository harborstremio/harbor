import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Check, Pin, Plug, Search, Tv } from "lucide-react";
import { SFX } from "@/lib/sfx";
import type { IptvChannel } from "@/lib/iptv/types";
import { getLeagueLabel } from "@/lib/sports/espn-leagues";
import type { SportsGame } from "@/lib/sports/espn-types";
import { leagueForTag, type ChannelMatch } from "@/lib/sports/iptv-match";
import type { EsportsStream } from "@/lib/sports/esports-streams";
import { StreamPlatform } from "@/views/sports/esports-broadcast";
import { useAttachments } from "@/views/sports/source-store";
import { fixtureLabelOf } from "@/views/sports/watch-flow";
import { useSportsChannelIndex } from "@/views/sports/watch-sources";
import { BP_ACTION_RING } from "../bp-action-style";
import { pushBpBack } from "../bp-back";
import { useBpT } from "../bp-i18n";
import { bpFirstVisible } from "../bp-visible";
import { currentBpFocus, setBpFocus } from "../use-bp-focus";
import { BpSportsBroadcastSearch } from "./bp-sports-broadcast-search";
import { BpSportsBroadcastStage } from "./bp-sports-broadcast-stage";
import { useBpSportsPlayChannel, useBpWatchFixture } from "./bp-sports-broadcast-play";

const LIFT = { "--bp-focus-lift-wide": "1.012" } as CSSProperties;
const FLUSH = { paddingInline: 0, marginInline: 0, containIntrinsicSize: "auto 100px" } as const;

const CELL =
  "flex min-h-[clamp(62px,7vh,88px)] shrink-0 items-center gap-[clamp(12px,1.1vw,22px)] rounded-[var(--bp-r-sm)] bg-[var(--bp-panel-2)] px-[clamp(16px,1.4vw,28px)] py-[clamp(10px,1.1vh,16px)] text-start data-[bp-focus=true]:bg-[var(--color-ink)] data-[bp-focus=true]:text-[var(--color-canvas)]";

const CHIP = `h-[clamp(52px,6vh,74px)] flex-1 rounded-[var(--bp-r-xs)] bg-[var(--bp-panel-2)] px-[clamp(16px,1.3vw,26px)] text-[calc(clamp(15px,2vh,24px)*var(--bp-up,1))] font-bold text-ink ${BP_ACTION_RING}`;

const PLATFORMS: Record<EsportsStream["platform"], string> = {
  twitch: "Twitch",
  youtube: "YouTube",
  kick: "Kick",
  external: "",
};

export type BpSportsPickerProps = {
  matches: ChannelMatch[];
  onPick: (match: ChannelMatch) => void;
  onSetup: () => void;
  onClose: () => void;
  game?: SportsGame;
  broadcasts?: EsportsStream[];
  autoBroadcast?: EsportsStream | null;
  onChannel?: (channel: IptvChannel) => void;
  onAddons?: () => void;
};

function useTierCopy(): (match: ChannelMatch) => string {
  const t = useBpT();
  return (match) =>
    match.attached
      ? t("Your pick for this competition")
      : match.reasons.some((r) => r.kind === "event")
        ? t("Event matchup found")
        : match.tier === "exact"
          ? t("Strong match")
          : match.tier === "likely"
            ? t("Likely match · check the broadcast")
            : t("Possible match · check the broadcast");
}

export function BpSportsWatchPicker({
  matches,
  onPick,
  onSetup,
  onClose,
  game,
  broadcasts,
  autoBroadcast,
  onChannel,
  onAddons,
}: BpSportsPickerProps) {
  const t = useBpT();
  const tierCopy = useTierCopy();
  const index = useSportsChannelIndex();
  const attachments = useAttachments();
  const stored = useBpWatchFixture();
  const playChannel = useBpSportsPlayChannel();
  const fixture = game ?? stored;
  const seedRef = useRef<HTMLButtonElement | null>(null);
  const [searching, setSearching] = useState(false);
  const [playing, setPlaying] = useState<EsportsStream | null>(autoBroadcast ?? null);
  const straight = useRef(autoBroadcast != null);
  const onStage = useRef(playing != null);
  onStage.current = playing != null;

  const shows = broadcasts ?? [];
  const league = fixture?.league ?? "";
  const leagueLabel = useMemo(() => {
    if (!league) return "";
    const def = leagueForTag(league);
    return def ? getLeagueLabel(def) : league;
  }, [league]);
  const attachedIds = useMemo(
    () => (league ? (attachments.channels[league] ?? []) : []),
    [attachments, league],
  );
  const canSearch = index.channels.length > 0;
  const seedAt = shows.length > 0 ? "show" : matches.length > 0 ? "match" : "action";

  useEffect(() => {
    const previous = currentBpFocus(bpFirstVisible("[data-bp-root]"));
    if (seedRef.current && !onStage.current) setBpFocus(seedRef.current, { silent: true });
    return () => {
      if (previous?.isConnected) setBpFocus(previous, { silent: true });
    };
  }, []);

  useEffect(
    () =>
      pushBpBack(() => {
        if (onStage.current) return false;
        onClose();
        return true;
      }),
    [onClose],
  );

  const empty = shows.length === 0 && matches.length === 0;

  return (
    <>
      <div
        role="dialog"
        aria-label={t("Choose a channel")}
        data-bp-dialog
        className="absolute inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_oklab,var(--bp-void)_80%,transparent)] [animation:bp-fade_var(--bp-dur)_var(--bp-ease)_both] motion-reduce:[animation:none]"
      >
        <div className="flex max-h-[86vh] w-[min(84vw,820px)] flex-col gap-[clamp(14px,2vh,28px)] rounded-[var(--bp-r-lg)] bg-[var(--bp-panel)] p-[clamp(28px,3vw,52px)]">
          <h2 className="font-display text-[calc(clamp(24px,3.4vh,42px)*var(--bp-up,1))] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
            {shows.length > 0
              ? t("Where to watch")
              : matches.length > 0
                ? t("Choose a channel")
                : t("No channel found")}
          </h2>

          {index.loading ? (
            <p
              role="status"
              className="text-[calc(clamp(14px,1.9vh,23px)*var(--bp-up,1))] leading-[1.55] text-ink-muted"
            >
              {t("Checking your channels…")}
            </p>
          ) : (
            empty && (
              <p className="text-[calc(clamp(14px,1.9vh,23px)*var(--bp-up,1))] leading-[1.55] text-ink-muted">
                {index.scanned === 0
                  ? t(
                      "No playlists yet. Add one in Live TV and Harbor will match its channels to fixtures.",
                    )
                  : t(
                      "None of your channels match this fixture. Search your channels and pin the one that carries it.",
                    )}
              </p>
            )
          )}

          <div
            data-bp-scroll-y
            data-bp-center
            className="-mx-[16px] flex flex-col gap-[clamp(7px,0.8vh,13px)] overflow-y-auto px-[16px] py-[clamp(12px,1.4vh,20px)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {shows.map((show, i) => (
              <button
                key={show.url}
                ref={seedAt === "show" && i === 0 ? seedRef : undefined}
                type="button"
                data-bp-focusable
                data-bp-tile="wide"
                style={LIFT}
                onClick={() => {
                  SFX.click();
                  setPlaying(show);
                }}
                className={CELL}
              >
                <span className="flex h-[clamp(38px,4.4vh,60px)] w-[clamp(38px,4.4vh,60px)] shrink-0 items-center justify-center rounded-[8px] bg-[var(--bp-panel)]">
                  <StreamPlatform platform={show.platform} size={24} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="truncate text-[calc(clamp(15px,2.05vh,25px)*var(--bp-up,1))] font-bold">
                    {show.title}
                  </span>
                  <span className="truncate text-[calc(clamp(12px,1.6vh,19px)*var(--bp-up,1))] font-semibold text-ink-subtle">
                    {PLATFORMS[show.platform] || t("Official broadcast")}
                  </span>
                </span>
              </button>
            ))}

            {matches.map((match, i) => (
              <button
                key={match.channel.id}
                ref={seedAt === "match" && i === 0 ? seedRef : undefined}
                type="button"
                data-bp-focusable
                data-bp-tile="wide"
                style={LIFT}
                onClick={() => {
                  SFX.click();
                  onPick(match);
                }}
                className={CELL}
              >
                {match.channel.logo ? (
                  <img
                    src={match.channel.logo}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    className="h-[clamp(38px,4.4vh,60px)] w-[clamp(38px,4.4vh,60px)] shrink-0 rounded-[8px] object-contain"
                  />
                ) : (
                  <Tv size={26} strokeWidth={2.1} className="shrink-0" />
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="truncate text-[calc(clamp(15px,2.05vh,25px)*var(--bp-up,1))] font-bold">
                    {match.label}
                  </span>
                  <span className="truncate text-[calc(clamp(12px,1.6vh,19px)*var(--bp-up,1))] font-semibold text-ink-subtle">
                    {tierCopy(match)}
                  </span>
                </span>
                {match.attached && (
                  <Check size={24} strokeWidth={2.6} className="shrink-0 text-ink" />
                )}
              </button>
            ))}
          </div>

          <div
            data-bp-row
            data-bp-scroll-x
            style={FLUSH}
            className="flex shrink-0 gap-[clamp(9px,0.9vw,16px)] overflow-x-auto py-[26px] -my-[26px] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {canSearch && (
              <button
                type="button"
                data-bp-focusable
                data-bp-chip
                ref={seedAt === "action" ? seedRef : undefined}
                onClick={() => {
                  SFX.open();
                  setSearching(true);
                }}
                className={`${CHIP} flex items-center justify-center gap-[clamp(8px,0.7vw,14px)]`}
              >
                <Search size={20} strokeWidth={2.3} />
                <span>{t("Search your channels")}</span>
              </button>
            )}
            {onAddons && (
              <button
                type="button"
                data-bp-focusable
                data-bp-chip
                ref={seedAt === "action" && !canSearch ? seedRef : undefined}
                onClick={() => {
                  SFX.open();
                  onAddons();
                }}
                className={`${CHIP} flex items-center justify-center gap-[clamp(8px,0.7vw,14px)]`}
              >
                <Plug size={20} strokeWidth={2.3} />
                <span>{t("Addon sources")}</span>
              </button>
            )}
            <button
              type="button"
              data-bp-focusable
              data-bp-chip
              ref={seedAt === "action" && !canSearch && !onAddons ? seedRef : undefined}
              onClick={() => {
                SFX.click();
                onSetup();
              }}
              className={CHIP}
            >
              {t("Set up Live TV")}
            </button>
            <button
              type="button"
              data-bp-focusable
              data-bp-chip
              onClick={() => {
                SFX.close();
                onClose();
              }}
              className={CHIP}
            >
              {t("Close")}
            </button>
          </div>

          {attachedIds.length > 0 && (
            <p className="flex shrink-0 items-center gap-[clamp(7px,0.6vw,12px)] text-[calc(clamp(12px,1.6vh,19px)*var(--bp-up,1))] font-semibold text-ink-subtle">
              <Pin size={18} strokeWidth={2.3} className="shrink-0" />
              {t("Pinned channels are tried first for {league}.", { league: leagueLabel })}
            </p>
          )}
        </div>
      </div>

      {searching && (
        <BpSportsBroadcastSearch
          index={index}
          league={league}
          leagueLabel={leagueLabel}
          attachedIds={attachedIds}
          onPlay={(channel) => {
            setSearching(false);
            if (onChannel) onChannel(channel);
            else playChannel(channel, fixture ? fixtureLabelOf(fixture) : channel.name);
          }}
          onClose={() => setSearching(false)}
        />
      )}

      {playing && (
        <BpSportsBroadcastStage
          stream={playing}
          others={shows.filter((show) => show.url !== playing.url)}
          onSelect={setPlaying}
          onClose={() => {
            setPlaying(null);
            if (straight.current) onClose();
          }}
        />
      )}
    </>
  );
}
