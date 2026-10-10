import { GraduationCap, Play, Trophy, Users } from "lucide-react";
import { useState } from "react";
import { useT } from "@/lib/i18n";
import { artKey, curatedArtSlot, useCuratedArtVersion } from "@/lib/jl/sports/curated-art";
import type { JlFavoriteTeam } from "@/lib/jl/sports/rank";
import { isCurrentLiveGame, visibleScore } from "@/lib/jl/sports/presentation";
import { leagueFitsSport, SPORT_SCENERY, slotLeague } from "@/lib/jl/sports/sport-art";
import { SPORT_LABELS, type LiveSportsEntry } from "@/lib/jl/sports/sports-channels";
import { teamLook } from "@/lib/jl/sports/team-look";
import type { SportsGame, SportsSide } from "@/lib/sports/espn";
import { useView } from "@/lib/view";
import { sportsSceneryPhoto } from "@/views/sports/sports-hero-scenery";
import { TeamMark } from "./game-backdrop";
import { statusText } from "./jl-sports-hub";
import { SourceChooser, type LiveSportsChannelsData } from "./live-sports-channels";
import type { JlSportsActions } from "./use-jl-sports-dialogs";

/**
 * The pieces under the Sports page's fan-art hero, laid out as the owner's design: shortcut
 * pills, large photo cards for the viewer's sports channels and a compact scores strip. Each
 * reuses data the page already has; nothing here fetches.
 */

const PILL =
  "flex h-10 items-center gap-2 rounded-full border px-4 text-[14px] font-semibold backdrop-blur-md transition-colors";

/** Teams & players / Leagues / Colleges, as glass pills (the first one lit in the accent). */
export function SportsShortcuts({
  actions,
  onLeagues,
}: {
  actions: JlSportsActions;
  onLeagues?: () => void;
}) {
  const t = useT();
  const { openSportsPage } = useView();
  return (
    <>
      <button
        onClick={actions.follow}
        className={`${PILL} border-accent/70 bg-accent/10 text-accent hover:bg-accent/20`}
      >
        <Users size={16} />
        {t("Teams & players")}
      </button>
      <button
        onClick={onLeagues ?? (() => openSportsPage({ kind: "leagues" }))}
        className={`${PILL} border-white/20 bg-canvas/40 text-ink hover:border-white/45`}
      >
        <Trophy size={16} />
        {t("Leagues")}
      </button>
      <button
        onClick={() => openSportsPage({ kind: "colleges" })}
        className={`${PILL} border-white/20 bg-canvas/40 text-ink hover:border-white/45`}
      >
        <GraduationCap size={16} />
        {t("Colleges")}
      </button>
    </>
  );
}

const CARD_LIMIT = 6;

/**
 * Live Sports Channels as big photo cards, one per sport the viewer's channels carry: the
 * sport's best channel (live first), on the owner's card art for a team they follow in that
 * sport, else Harbor's photo of the sport. The full channel browser stays further down.
 */
export function SportChannelCards({
  data,
  favorites,
}: {
  data: LiveSportsChannelsData;
  favorites: JlFavoriteTeam[];
}) {
  const t = useT();
  useCuratedArtVersion();
  const [choosing, setChoosing] = useState<LiveSportsEntry | null>(null);
  const cards = data.rows.rows
    .map((row) => ({
      sport: row.sport,
      entry: row.entries.find((e) => e.liveNow && !e.idle) ?? row.entries.find((e) => !e.idle),
    }))
    .filter((c): c is { sport: typeof c.sport; entry: LiveSportsEntry } => !!c.entry)
    .slice(0, CARD_LIMIT);
  if (!cards.length) return null;
  return (
    <section aria-label={t("Live Sports Channels")} className="flex flex-col gap-3 ps-[9px]">
      <h2 className="text-[20px] font-bold text-ink 2xl:text-[24px]">
        {t("Live Sports Channels")}
      </h2>
      <div className="grid auto-cols-[minmax(340px,calc((100%-2rem-9px)/3))] grid-flow-col gap-4 overflow-x-auto pb-2 pe-[9px]">
        {cards.map(({ sport, entry }) => {
          const game = entry.channels
            .map((c) => data.gameByChannel.get(c.id))
            .find((g): g is SportsGame => !!g);
          const art = cardArt(sport, game, favorites);
          const league = game?.league ?? slotLeague(entry.slot);
          return (
            <div key={sport} className="relative">
              <button
                onClick={() =>
                  entry.channels.length > 1 ? setChoosing(entry) : data.play(entry.channels[0])
                }
                aria-label={`${t(SPORT_LABELS[sport])}: ${t("Play {name}", { name: entry.title })}`}
                className="group relative flex aspect-[3/1] min-h-[150px] w-full flex-col justify-end overflow-hidden rounded-2xl text-start ring-1 ring-white/10 transition duration-200 hover:ring-2 hover:ring-accent"
              >
                <CardPhoto sources={art.sources} subjectRight={art.subjectRight} />
                <span
                  aria-hidden
                  className="absolute inset-0 bg-gradient-to-r from-canvas/85 via-canvas/35 to-transparent rtl:bg-gradient-to-l"
                />
                <span className="relative flex flex-col gap-0.5 px-5 pb-4 pt-3">
                  {entry.liveNow && (
                    <span className="mb-1 w-fit rounded bg-danger px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-white">
                      {t("Live")}
                    </span>
                  )}
                  <span className="text-[clamp(20px,1.6vw,30px)] font-extrabold leading-tight text-white drop-shadow">
                    {t(SPORT_LABELS[sport])}
                  </span>
                  <span className="truncate text-[13.5px] font-medium text-white/85 drop-shadow">
                    {[league, entry.title].filter(Boolean).join(" · ")}
                  </span>
                  <span className="mt-2 inline-flex h-9 w-fit items-center gap-2 rounded-full bg-white px-4 text-[14px] font-bold text-black shadow-lg transition-transform group-hover:scale-105">
                    <Play size={13} fill="currentColor" strokeWidth={0} className="dir-icon" />
                    {t("Watch")}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>
      {choosing && (
        <SourceChooser
          entry={choosing}
          nowNext={data.nowNext}
          sourceNames={data.sourceNames}
          onPlay={(c) => {
            setChoosing(null);
            data.play(c);
          }}
          onClose={() => setChoosing(null)}
        />
      )}
    </section>
  );
}

/** The owner's card art for this channel's game, else for a team they follow in the sport. */
function cardArt(
  sport: keyof typeof SPORT_SCENERY,
  game: SportsGame | undefined,
  favorites: JlFavoriteTeam[],
): { sources: string[]; subjectRight: string | null } {
  const keys = [
    ...(game
      ? [game.home, game.away].filter((s) => s.id).map((s) => artKey.team(game.league, s.id))
      : []),
    ...favorites
      .filter((f) => leagueFitsSport(f.league, sport))
      .map((f) => artKey.team(f.league, f.id)),
  ];
  for (const key of keys) {
    const art = curatedArtSlot(key, "card");
    if (art)
      return {
        sources: [art.url, sportsSceneryPhoto(SPORT_SCENERY[sport])],
        subjectRight: art.borrowed ? art.url : null,
      };
  }
  return { sources: [sportsSceneryPhoto(SPORT_SCENERY[sport])], subjectRight: null };
}

function CardPhoto({ sources, subjectRight }: { sources: string[]; subjectRight: string | null }) {
  const [failed, setFailed] = useState<string[]>([]);
  const src = sources.find((u) => !failed.includes(u));
  if (!src) return <span aria-hidden className="absolute inset-0 bg-elevated" />;
  return (
    <img
      key={src}
      src={src}
      alt=""
      draggable={false}
      loading="lazy"
      onError={() => setFailed((f) => [...f, src])}
      className={`absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
        src === subjectRight ? "object-[74%_40%]" : "object-center"
      }`}
    />
  );
}

const STRIP_LIMIT = 12;

/** Live first, then finals, then what's next; the day's games from ESPN's feed. */
export function stripGames(games: SportsGame[], now = Date.now()): SportsGame[] {
  const rank = (g: SportsGame) => (isCurrentLiveGame(g) ? 0 : g.state === "post" ? 1 : 2);
  return games
    .filter((g) => Math.abs(g.startMs - now) < 20 * 3600_000 || isCurrentLiveGame(g))
    .filter((g) => g.home.name && g.away.name)
    .sort(
      (a, b) =>
        rank(a) - rank(b) || (rank(a) === 1 ? b.startMs - a.startMs : a.startMs - b.startMs),
    )
    .slice(0, STRIP_LIMIT);
}

/** Scores in a compact strip: logos, abbreviations, the score and a status pill. */
export function ScoresStrip({
  games,
  onOpenGame,
}: {
  games: SportsGame[];
  onOpenGame: (game: SportsGame) => void;
}) {
  const t = useT();
  if (!games.length) return null;
  return (
    <section aria-label={t("Scores")} className="flex flex-col gap-3 ps-[9px]">
      <h2 className="text-[20px] font-bold text-ink 2xl:text-[24px]">{t("Scores")}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 pe-[9px]">
        {games.map((game) => {
          const live = isCurrentLiveGame(game);
          const scored = game.state !== "pre";
          return (
            <button
              key={`${game.league}:${game.id}`}
              onClick={() => onOpenGame(game)}
              aria-label={`${game.away.name} ${visibleScore(game, game.away)} ${t("at")} ${game.home.name} ${visibleScore(game, game.home)}: ${statusText(game, t)}`}
              className="flex h-14 shrink-0 items-center gap-3 rounded-xl border border-white/10 bg-elevated/70 px-3.5 backdrop-blur-md transition-colors hover:border-white/30"
            >
              <StripSide side={game.away} />
              <span className="text-[13px] font-semibold uppercase text-ink-muted">
                {game.away.abbr || game.away.name}
              </span>
              <span className="text-[16px] font-extrabold tabular-nums text-ink">
                {scored ? `${game.away.score} - ${game.home.score}` : t("at")}
              </span>
              <span className="text-[13px] font-semibold uppercase text-ink-muted">
                {game.home.abbr || game.home.name}
              </span>
              <StripSide side={game.home} />
              <span
                className={`ms-1 rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                  live ? "bg-danger text-white" : "bg-ink/10 text-ink-muted"
                }`}
              >
                {statusText(game, t)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function StripSide({ side }: { side: SportsSide }) {
  return <TeamMark look={teamLook(side)} className="h-8 w-8 shrink-0" textClass="text-[11px]" />;
}
