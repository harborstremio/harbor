import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useUiLanguage } from "@/lib/i18n/store";
import { SFX } from "@/lib/sfx";
import { matchCardContext, relativeCardStart } from "@/lib/sports/card-context";
import type { SportsGame, SportsSide } from "@/lib/sports/espn-types";
import { getLeagueLabel } from "@/lib/sports/espn-leagues";
import { formatSportsEventDate } from "@/lib/sports/event-date";
import { gameKey } from "@/lib/sports/hub-cache";
import { hubLeague } from "@/lib/sports/hub-data";
import { BpArt } from "../bp-art-img";
import { useBpT } from "../bp-i18n";
import { subscribeBpTick } from "../bp-live-tick";
import { bpSportsCardArt, bpSportsGroup, bpSportsSingleSubject } from "./bp-sports-art";
import { BpSportsLeagueMark, BpSportsMark } from "./bp-sports-mark";
import type { BpSportsSelect } from "./bp-sports-types";

export const BP_SPORTS_CARD_WIDTH = "clamp(318px, 26vw, 470px)";
const CARD_MIN_HEIGHT = "clamp(170px, 22vh, 252px)";
const TEAM_MARK = "clamp(40px, 4.5vh, 60px)";
const EVENT_MARK = "clamp(46px, 5.4vh, 72px)";
const LEAGUE_MARK = "clamp(26px, 3vh, 38px)";
const WATERMARK = "clamp(150px, 15vw, 250px)";

const SHELL =
  "group relative flex shrink-0 flex-col overflow-hidden rounded-[var(--bp-r-lg)] border border-[var(--bp-edge)] bg-[var(--bp-panel)] text-start";

const ART_SCRIM =
  "linear-gradient(178deg, color-mix(in oklab, var(--bp-void) 52%, transparent) 0%, color-mix(in oklab, var(--bp-void) 74%, transparent) 46%, color-mix(in oklab, var(--bp-void) 96%, transparent) 100%)";

const EYEBROW =
  "min-w-0 truncate text-[calc(clamp(10px,1.32vh,14.5px)*var(--bp-up,1))] font-bold uppercase tracking-[0.18em] text-ink-muted";

const STATE =
  "min-w-0 truncate text-[calc(clamp(10px,1.32vh,14.5px)*var(--bp-up,1))] font-bold uppercase tracking-[0.16em] text-ink-subtle";

const NAME =
  "min-w-0 truncate text-[calc(clamp(15px,2.05vh,24px)*var(--bp-up,1))] font-bold leading-[1.15] tracking-[-0.01em]";

const SCORE =
  "shrink-0 text-[calc(clamp(24px,3.3vh,42px)*var(--bp-up,1))] font-bold leading-none tabular-nums";

const QUIET =
  "min-w-0 truncate text-[calc(clamp(11px,1.5vh,16.5px)*var(--bp-up,1))] font-semibold text-ink-subtle";

const TITLE =
  "line-clamp-2 text-[calc(clamp(18px,2.5vh,31px)*var(--bp-up,1))] font-bold leading-[1.14] tracking-[-0.015em] text-ink";

const SOON_MS = 90 * 60_000;

type BpSportsWatch = ((game: SportsGame) => boolean) | null;

const WatchContext = createContext<BpSportsWatch>(null);

export function BpSportsWatchProvider({
  watch,
  children,
}: {
  watch: BpSportsWatch;
  children: ReactNode;
}) {
  return <WatchContext.Provider value={watch}>{children}</WatchContext.Provider>;
}

export function useBpSportsWatchNow(): BpSportsWatch {
  return useContext(WatchContext);
}

function BpSportsCountdown({ startMs, locale }: { startMs: number; locale: string }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const at = useRef(locale);
  at.current = locale;

  useEffect(() => {
    const apply = () => {
      const el = ref.current;
      if (!el) return;
      const next = relativeCardStart(startMs, at.current);
      if (el.textContent !== next) el.textContent = next;
    };
    apply();
    return subscribeBpTick(apply);
  }, [startMs]);

  useEffect(() => {
    const el = ref.current;
    if (el) el.textContent = relativeCardStart(startMs, locale);
  }, [startMs, locale]);

  return <span ref={ref} className="tabular-nums" />;
}

function BpSportsState({
  game,
  stale,
  locale,
}: {
  game: SportsGame;
  stale: boolean;
  locale: string;
}) {
  const t = useBpT();
  if (stale) return <span className={STATE}>{t("Saved")}</span>;
  if (game.state === "in")
    return (
      <span
        className={`${STATE} flex items-center gap-[clamp(5px,0.45vw,9px)]`}
        style={{ color: "var(--bp-live)" }}
      >
        <span
          aria-hidden
          className="h-[8px] w-[8px] shrink-0 rounded-full"
          style={{ background: "var(--bp-live)" }}
        />
        <span className="truncate normal-case tracking-[0.04em]">{game.detail || t("Live")}</span>
      </span>
    );
  if (game.state === "post") return <span className={STATE}>{t("Final")}</span>;
  const soon =
    game.dateOnly === undefined &&
    Number.isFinite(game.startMs) &&
    game.startMs > Date.now() &&
    game.startMs - Date.now() < SOON_MS;
  if (soon)
    return (
      <span className={`${STATE} normal-case tracking-[0.04em]`}>
        <BpSportsCountdown startMs={game.startMs} locale={locale} />
      </span>
    );
  return (
    <span className={`${STATE} normal-case tracking-[0.04em]`}>
      {formatSportsEventDate(game.startMs, locale, true, game.dateOnly) || t("Time TBA")}
    </span>
  );
}

function BpSportsSideRow({
  side,
  fallback,
  sport,
  scored,
}: {
  side: SportsSide;
  fallback?: string;
  sport: string;
  scored: boolean;
}) {
  const dim = scored && !side.winner;
  return (
    <span className="flex min-w-0 items-center gap-[clamp(10px,0.9vw,18px)]">
      <BpSportsMark side={side} fallback={fallback} sport={sport} size={TEAM_MARK} />
      <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
        <span className={`${NAME} ${dim ? "text-ink-muted" : "text-ink"}`}>
          {side.rank ? (
            <span className="me-[0.4em] text-[0.68em] font-bold tabular-nums text-ink-subtle">
              {`#${side.rank}`}
            </span>
          ) : null}
          {side.name || side.abbr}
        </span>
        {!scored && side.record ? (
          <span className="truncate text-[calc(clamp(10.5px,1.35vh,15px)*var(--bp-up,1))] font-semibold tabular-nums text-ink-subtle">
            {side.record}
          </span>
        ) : null}
      </span>
      {scored ? (
        <span className={`${SCORE} ${dim ? "text-ink-muted" : "text-ink"}`}>
          {side.score || "0"}
        </span>
      ) : null}
    </span>
  );
}

export function BpSportsCard({
  game,
  onSelect,
  autofocus,
  onFocusGame,
}: {
  game: SportsGame;
  onSelect: BpSportsSelect;
  autofocus?: boolean;
  onFocusGame?: (game: SportsGame) => void;
}) {
  const t = useBpT();
  const locale = useUiLanguage();
  const watch = useContext(WatchContext);
  const league = hubLeague(game.league);
  const group = bpSportsGroup(game);
  const stale = game.savedAt !== undefined;
  const single = bpSportsSingleSubject(game);
  const art = single ? bpSportsCardArt(game) : undefined;
  const scored = !stale && game.state !== "pre";
  const context = useMemo(() => (single ? [] : matchCardContext(game)), [game, single]);
  const line = context.find((row) => row.kind !== "start");
  const quiet = line
    ? line.value
    : single
      ? [game.home.name, game.away.name].filter(Boolean).join(" · ")
      : formatSportsEventDate(game.startMs, locale, false, game.dateOnly);
  const leagueName = league ? getLeagueLabel(league) : game.league;
  const watermark = single ? "" : game.home.logo || league?.logo || "";

  return (
    <button
      type="button"
      data-bp-focusable
      data-bp-tile="wide"
      data-bp-autofocus={autofocus ? "true" : undefined}
      data-bp-restore-key={`sports:${gameKey(game)}`}
      onFocus={() => onFocusGame?.(game)}
      onClick={() => {
        SFX.click();
        if (game.state === "in" && watch?.(game)) return;
        onSelect(game);
      }}
      aria-label={
        single
          ? `${t("Match center")} · ${leagueName} · ${game.context?.name ?? game.home.name}`
          : `${t("Match center")} · ${leagueName} · ${game.away.name || game.away.abbr} · ${game.home.name || game.home.abbr}`
      }
      className={SHELL}
      style={{ width: BP_SPORTS_CARD_WIDTH, minHeight: CARD_MIN_HEIGHT }}
    >
      {art ? (
        <BpArt
          src={art}
          className="object-cover opacity-0 transition-opacity duration-[var(--bp-dur-slow)] ease-[var(--bp-ease)] data-[on=true]:opacity-70 motion-reduce:transition-none"
          onLoad={(e) => e.currentTarget.setAttribute("data-on", "true")}
        />
      ) : null}
      {art ? (
        <span aria-hidden className="absolute inset-0" style={{ background: ART_SCRIM }} />
      ) : null}
      {watermark ? (
        <span
          aria-hidden
          className="pointer-events-none absolute -end-[14%] top-1/2 -translate-y-1/2 opacity-[0.07] transition-opacity duration-[var(--bp-dur)] ease-[var(--bp-ease)] group-data-[bp-focus=true]:opacity-[0.14] motion-reduce:transition-none"
          style={{ width: WATERMARK, height: WATERMARK }}
        >
          <img
            src={watermark}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-contain"
          />
        </span>
      ) : null}

      <span className="relative flex h-full min-h-0 flex-1 flex-col gap-[clamp(9px,1vh,16px)] p-[clamp(14px,1.25vw,24px)]">
        <span className="flex items-center gap-[clamp(8px,0.7vw,14px)]">
          <BpSportsLeagueMark league={league} size={LEAGUE_MARK} />
          <span className={EYEBROW}>{leagueName}</span>
          <span className="ms-auto flex min-w-0 max-w-[56%] shrink-0 items-center justify-end">
            <BpSportsState game={game} stale={stale} locale={locale} />
          </span>
        </span>

        {single ? (
          <span className="flex min-h-0 flex-1 items-center gap-[clamp(9px,0.8vw,16px)]">
            <BpSportsMark
              side={game.home}
              fallback={league?.logo}
              sport={group}
              size={EVENT_MARK}
              tone="bare"
            />
            {game.away.name ? (
              <BpSportsMark
                side={game.away}
                fallback={league?.logo}
                sport={group}
                size={EVENT_MARK}
                tone="bare"
              />
            ) : null}
            <span dir="auto" className={`${TITLE} flex-1`}>
              {game.context?.name || game.home.name}
            </span>
          </span>
        ) : (
          <span className="flex min-h-0 flex-1 flex-col justify-center gap-[clamp(8px,0.9vh,15px)]">
            <BpSportsSideRow
              side={game.away}
              fallback={league?.logo}
              sport={group}
              scored={scored}
            />
            <BpSportsSideRow
              side={game.home}
              fallback={league?.logo}
              sport={group}
              scored={scored}
            />
          </span>
        )}

        {quiet ? (
          <span dir="auto" className={`${QUIET} mt-auto`}>
            {quiet}
          </span>
        ) : (
          <span aria-hidden className="mt-auto" />
        )}
      </span>
    </button>
  );
}
