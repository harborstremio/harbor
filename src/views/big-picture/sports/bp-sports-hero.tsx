import { useEffect, useMemo, useRef, useState } from "react";
import { useUiLanguage } from "@/lib/i18n";
import { SFX } from "@/lib/sfx";
import { matchCardContext } from "@/lib/sports/card-context";
import { getLeagueLabel } from "@/lib/sports/espn-leagues";
import type { SportsGame } from "@/lib/sports/espn-types";
import { formatSportsEventDate } from "@/lib/sports/event-date";
import { hubLeague } from "@/lib/sports/hub-data";
import { LEAGUE_LOGO_BACKGROUNDS } from "@/lib/sports/league-branding";
import { LEAGUE_KEY_LOGO_BACKGROUNDS, leagueLogoSource } from "@/lib/sports/league-logo-source";
import { SportIcon } from "@/views/sports/sport-icon";
import { useSportsArtwork } from "@/views/sports/use-artwork";
import { BP_ACTION_RING, BP_ACTION_SOLID } from "../bp-action-style";
import { BP_COPY_IN, BP_COPY_OUT, useBpCopyGate } from "../bp-backdrop-commit";
import { BpHeroPips } from "../bp-hero-pips";
import { useBpT } from "../bp-i18n";
import { useBpSportsWatchNow } from "./bp-sports-card";
import type { BpSportsSelect } from "./bp-sports-types";
import { useBpSportsCycle } from "./use-bp-sports-cycle";

const BOX = "h-[clamp(268px,40vh,432px)]";

const MARK_H = "h-[calc(clamp(76px,10vh,130px)*var(--bp-up,1))]";

const MARK = `${MARK_H} w-auto max-w-[calc(clamp(120px,17vw,260px)*var(--bp-up,1))] object-contain`;

const NAME =
  "max-w-[calc(clamp(150px,20vw,300px)*var(--bp-up,1))] truncate text-center font-display text-[calc(clamp(21px,2.7vh,32px)*var(--bp-up,1))] font-semibold leading-[1.15] tracking-[-0.01em] text-ink";

const SCORE =
  "font-display text-[calc(clamp(38px,5.4vh,68px)*var(--bp-up,1))] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ink";

const VERSUS =
  "font-display text-[calc(clamp(19px,2.4vh,30px)*var(--bp-up,1))] font-semibold uppercase tracking-[0.16em] text-ink-muted";

const META =
  "mt-[clamp(10px,1.4vh,20px)] line-clamp-1 text-[calc(clamp(13.5px,1.75vh,19px)*var(--bp-up,1))] font-medium tracking-[0.01em] text-ink-muted";

const EYEBROW =
  "text-[calc(clamp(12.5px,1.55vh,18px)*var(--bp-up,1))] font-bold uppercase tracking-[0.14em] text-ink-subtle";

const FIGHT_NAME =
  "max-w-[min(34vw,560px)] truncate font-display text-[calc(clamp(28px,4.1vh,52px)*var(--bp-up,1))] font-semibold leading-[1.05] tracking-[-0.02em] text-ink";

const FACE_OFF_MASK = "linear-gradient(to right, transparent 0%, black 26%, black 100%)";

const FOOT_FADE = "linear-gradient(to top, transparent 0%, black 16%)";

function BpSportsFaceOffSide({
  sources,
  alt,
  mirrored,
}: {
  sources: readonly string[];
  alt: string;
  mirrored: boolean;
}) {
  const list = useMemo(() => sources.filter((src) => src.length > 0), [sources]);
  const [at, setAt] = useState(0);
  const chain = list.join("|");
  useEffect(() => {
    setAt(0);
  }, [chain]);
  const src = list[at];
  if (!src) return <span className="h-full w-1/2" />;
  return (
    <img
      src={src}
      alt={alt}
      decoding="async"
      onError={() => setAt((n) => n + 1)}
      className={`h-full w-1/2 object-contain object-bottom drop-shadow-[0_14px_40px_rgba(0,0,0,0.7)] ${mirrored ? "-scale-x-100" : ""}`}
      style={{ maskImage: FOOT_FADE, WebkitMaskImage: FOOT_FADE }}
    />
  );
}

// Fighters are the picture: full hero height, squared up to face each other the
// way the hub's event cards do, bled into the page floor and faded on the copy
// side. Team badges keep the small inline marks below; a badge at this size is
// just a big logo.
function BpSportsFaceOff({
  home,
  away,
  homeName,
  awayName,
}: {
  home: readonly string[];
  away: readonly string[];
  homeName: string;
  awayName: string;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 end-0 flex w-[min(58vw,1120px)] items-end justify-end overflow-hidden pe-[var(--bp-gutter)]"
      style={{ maskImage: FACE_OFF_MASK, WebkitMaskImage: FACE_OFF_MASK }}
    >
      <BpSportsFaceOffSide sources={home} alt={homeName} mirrored={false} />
      <BpSportsFaceOffSide sources={away} alt={awayName} mirrored />
    </div>
  );
}

function plateStyle(canvas: "light" | "dark" | undefined) {
  if (canvas === "light")
    return { background: "color-mix(in oklab, var(--color-ink) 92%, transparent)" };
  if (canvas === "dark") return { background: "var(--bp-void)" };
  return undefined;
}

function BpSportsHeroMark({
  sources,
  sport,
  alt,
}: {
  sources: readonly string[];
  sport: string;
  alt: string;
}) {
  const list = useMemo(() => sources.filter((src) => src.length > 0), [sources]);
  const [at, setAt] = useState(0);
  const chain = list.join("|");

  useEffect(() => {
    setAt(0);
  }, [chain]);

  const src = list[at];
  if (!src)
    return <SportIcon name={sport} size={112} className={`${MARK_H} w-auto text-ink-subtle`} />;

  return (
    <img
      src={src}
      alt={alt}
      decoding="async"
      onError={() => setAt((n) => n + 1)}
      className={`${MARK} drop-shadow-[0_6px_22px_rgba(0,0,0,0.65)]`}
    />
  );
}

export function BpSportsHero({
  games,
  active,
  onSelect,
  onFocusGame,
  autofocus,
}: {
  games: SportsGame[];
  active: boolean;
  onSelect: BpSportsSelect;
  onFocusGame?: (game: SportsGame) => void;
  autofocus?: boolean;
}) {
  const t = useBpT();
  const lang = useUiLanguage();
  const watchNow = useBpSportsWatchNow();
  const { index, bump } = useBpSportsCycle(games.length, active);
  const at = games.length > 0 ? index % games.length : 0;
  const game: SportsGame | null = games[at] ?? null;
  const art = useSportsArtwork(game ?? undefined);
  const def = game ? hubLeague(game.league) : undefined;
  const group = def?.group ?? "trophy";
  const combat = group === "combat" || group === "boxing";

  const publish = useRef(onFocusGame);
  publish.current = onFocusGame;
  const gameId = game?.id ?? "";

  useEffect(() => {
    if (!active || !game) return;
    publish.current?.(game);
  }, [active, gameId]);

  const subject = useMemo(() => {
    if (!game) return null;
    const leagueSrc = def ? leagueLogoSource({ key: def.key, logo: def.logo }) : "";
    const context = matchCardContext(game);
    const parts = [
      def ? getLeagueLabel(def) : game.league,
      ...context
        .filter((row) => row.kind === "stage" || row.kind === "venue")
        .map((row) => String(row.value)),
      game.state === "pre"
        ? formatSportsEventDate(game.startMs, lang, false, game.dateOnly)
        : game.detail,
    ].filter((value) => value.length > 0);
    const scored = game.state !== "pre" && game.home.score.length > 0 && game.away.score.length > 0;
    return {
      id: game.id,
      solo: game.home.name.length === 0 || game.away.name.length === 0,
      title: game.context?.name || game.home.name || game.away.name || game.league,
      leagueSrc,
      leagueLabel: def ? getLeagueLabel(def) : game.league,
      leagueCanvas: leagueSrc
        ? (LEAGUE_LOGO_BACKGROUNDS[leagueSrc] ?? LEAGUE_KEY_LOGO_BACKGROUNDS[def?.key ?? ""])
        : undefined,
      home: [art.home ?? "", game.home.logo],
      away: [art.away ?? "", game.away.logo],
      homeName: game.home.name,
      awayName: game.away.name,
      score: scored ? `${game.home.score} - ${game.away.score}` : "",
      live: game.state === "in",
      clock: game.detail,
      meta: parts.join(" · "),
    };
  }, [game, def, art.home, art.away, lang]);

  const { shown, on } = useBpCopyGate(subject, gameId ? `sports-hero:${gameId}` : "");

  if (games.length === 0 || !game) return null;

  const target = games.find((entry) => entry.id === shown?.id) ?? game;

  const label =
    target.state === "in"
      ? t("Watch live")
      : target.state === "post"
        ? t("View result")
        : t("View event");

  return (
    <section
      data-bp-row
      data-bp-row-key="sports-hero"
      aria-label={t("Featured events")}
      className={`relative flex flex-col justify-end ${BOX}`}
    >
      {combat && shown && !shown.solo && (
        <BpSportsFaceOff
          home={shown.home}
          away={shown.away}
          homeName={shown.homeName}
          awayName={shown.awayName}
        />
      )}
      {/* [data-bp-row] carries the gutter as padding and cancels it with a matching
          negative margin, so the copy takes its own inset here, like the rows do. */}
      <div className="relative z-10 flex h-full flex-col justify-end px-[var(--bp-gutter)]">
        {shown && (
          <div
            data-bp-xfade
            key={shown.id}
            className={`flex flex-col items-start ${on ? BP_COPY_IN : BP_COPY_OUT}`}
          >
            <div className="flex items-center gap-[clamp(9px,0.9vw,16px)]">
              {shown.leagueSrc ? (
                <span
                  className="flex h-[clamp(34px,4.4vh,54px)] items-center rounded-[var(--bp-r-xs)] px-[clamp(7px,0.6vw,12px)]"
                  style={plateStyle(shown.leagueCanvas)}
                >
                  <img
                    src={shown.leagueSrc}
                    alt=""
                    decoding="async"
                    className="h-[calc(clamp(22px,2.6vh,32px)*var(--bp-up,1))] w-auto object-contain"
                  />
                </span>
              ) : null}
              <span className={EYEBROW}>{shown.leagueLabel}</span>
              {shown.live && (
                <span
                  className="flex h-[calc(clamp(24px,2.9vh,34px)*var(--bp-up,1))] items-center gap-[6px] rounded-full px-[clamp(9px,0.7vw,14px)] text-[calc(clamp(11.5px,1.45vh,16px)*var(--bp-up,1))] font-bold uppercase tracking-[0.12em]"
                  style={{ background: "var(--bp-live)", color: "var(--bp-void)" }}
                >
                  {t("Live")}
                  {shown.clock ? (
                    <span className="normal-case tracking-normal">{shown.clock}</span>
                  ) : null}
                </span>
              )}
            </div>

            {shown.solo ? (
              <div className="mt-[clamp(12px,1.8vh,26px)] flex items-center gap-[calc(clamp(16px,1.8vw,34px)*var(--bp-up,1))]">
                <BpSportsHeroMark
                  sources={shown.leagueSrc ? [shown.leagueSrc] : shown.home}
                  sport={group}
                  alt={shown.title}
                />
                <h2 className="line-clamp-2 max-w-[min(50vw,760px)] font-display text-[calc(clamp(28px,4.1vh,52px)*var(--bp-up,1))] font-semibold leading-[1.1] tracking-[-0.02em] text-ink">
                  {shown.title}
                </h2>
              </div>
            ) : combat ? (
              <div className="mt-[clamp(12px,1.8vh,26px)] flex flex-wrap items-baseline gap-x-[calc(clamp(14px,1.4vw,28px)*var(--bp-up,1))] gap-y-[6px]">
                <span className={FIGHT_NAME}>{shown.homeName}</span>
                <span className={VERSUS}>{t("vs")}</span>
                <span className={FIGHT_NAME}>{shown.awayName}</span>
              </div>
            ) : (
              <div className="mt-[clamp(12px,1.8vh,26px)] flex items-end gap-[calc(clamp(18px,2vw,44px)*var(--bp-up,1))]">
                <div className="flex flex-col items-center gap-[calc(clamp(7px,0.9vh,13px)*var(--bp-up,1))]">
                  <BpSportsHeroMark sources={shown.home} sport={group} alt={shown.homeName} />
                  <span className={NAME}>{shown.homeName}</span>
                </div>
                <div className="pb-[calc(clamp(24px,3.2vh,46px)*var(--bp-up,1))]">
                  {shown.score ? (
                    <span className={SCORE}>{shown.score}</span>
                  ) : (
                    <span className={VERSUS}>{t("vs")}</span>
                  )}
                </div>
                <div className="flex flex-col items-center gap-[calc(clamp(7px,0.9vh,13px)*var(--bp-up,1))]">
                  <BpSportsHeroMark sources={shown.away} sport={group} alt={shown.awayName} />
                  <span className={NAME}>{shown.awayName}</span>
                </div>
              </div>
            )}

            <p className={META}>{shown.meta}</p>
          </div>
        )}

        <div className="mt-[clamp(12px,1.8vh,24px)] flex items-center gap-[clamp(14px,1.4vw,28px)]">
          <button
            type="button"
            data-bp-focusable
            data-bp-autofocus={autofocus ? "true" : undefined}
            data-bp-restore-key={`sports-hero:${gameId}`}
            onFocus={() => {
              bump();
              if (game) publish.current?.(game);
            }}
            onClick={() => {
              SFX.click();
              if (target.state === "in" && watchNow?.(target)) return;
              onSelect(target);
            }}
            className={`flex h-[var(--bp-action-h)] min-w-[clamp(150px,13vw,240px)] items-center justify-center px-[clamp(20px,1.8vw,36px)] text-[calc(clamp(15px,1.8vh,20px)*var(--bp-up,1))] ${BP_ACTION_SOLID} ${BP_ACTION_RING}`}
          >
            {label}
          </button>
          <BpHeroPips total={games.length} active={at} />
        </div>
      </div>
    </section>
  );
}
