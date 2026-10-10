import { legacyEsportsMatch } from "@/lib/sports/legacy-esports-match";
import { LegacyEsportsEvent } from "./legacy-esports-event";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ExternalLink } from "lucide-react";
import { useScrollMemory, useView } from "@/lib/view";
import { useT } from "@/lib/i18n";
import { EventField } from "./event-field";
import { openUrl } from "@/lib/window";
import type { SportsGame } from "@/lib/sports/espn";
import { hubLeague } from "@/lib/sports/hub-data";
import { SPORTS_BROADCASTS } from "@/lib/sports/broadcasts";
import { WatchSources } from "./watch-sources";
import { useEventDate } from "./hub-cards";
import { HubCompetition } from "./hub-competition";
import { BroadcastPlayer } from "./hub-broadcasts";
import { WhereToWatch } from "./where-to-watch";
import { SportsReminderButton } from "./reminder-button";
import { F1Hub } from "./f1-hub";
import { FightCard } from "./fight-card";
import { EsportsMap } from "./esports-map";
import { VenuePreview } from "./venue-preview";
import { EventMetadata } from "./event-metadata";
import { EventOdds } from "./event-odds";
import { BoxingEventDetails } from "./boxing-event-details";
import { LeagueLogo } from "./league-logo";
import { getLeagueLabel } from "@/lib/sports/espn";
import { gameKey } from "@/lib/sports/hub-cache";
import "./hub-event-page.css";
import { BackToTop } from "@/components/back-to-top";

function StandardHubEventPage({
  game,
  games,
  shellBackAvailable = false,
}: {
  game: SportsGame;
  games: SportsGame[];
  shellBackAvailable?: boolean;
}) {
  const t = useT();
  const date = useEventDate();
  const { goBack, openMatchDetail } = useView();
  const scrollRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  useScrollMemory(`sports-event:${gameKey(game)}`, scrollRef);
  const [watch, setWatch] = useState(false);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);
  const league = hubLeague(game.league);
  const broadcast = SPORTS_BROADCASTS.find((item) => item.league === game.league);
  const fights = games
    .filter((g) => g.league === game.league && g.context?.id === game.context?.id)
    .sort((a, b) => Number(b.id === game.id) - Number(a.id === game.id) || b.startMs - a.startMs);
  const combat = hubLeague(game.league)?.group === "combat" && game.id.includes("|");
  const field = ["cycling", "athletics", "winter"].includes(hubLeague(game.league)?.group || "");
  const competition =
    field || ["motorsport", "golf"].includes(hubLeague(game.league)?.group || "");
  const fieldArt = field ? game.artwork || game.poster || "" : "";
  return (
    <main ref={scrollRef} className="sh-match-page sh-event-page" aria-labelledby="sports-event-title">
      <header className="sh-match-header">
        {!shellBackAvailable && <button className="sh-button" onClick={goBack}><ArrowLeft size={18} />{t("Back")}</button>}
        {league && <LeagueLogo league={league} size={28} />}
        <span>{league ? getLeagueLabel(league) : game.league}</span>
      </header>
      <div className="sh-event-page-heading">
        <div>
          <h1 ref={titleRef} tabIndex={-1} id="sports-event-title">{game.context?.name || game.home.name}</h1>
          <p>
            {date(game.startMs, false, game.dateOnly)}
            {game.context?.venue ? ` · ${game.context.venue}` : ""}
          </p>
        </div>
        <SportsReminderButton game={game} />
      </div>
      <div className="sh-event-page-body">
        {hubLeague(game.league)?.group === "esports" && <EsportsMap game={game} />}
        <VenuePreview game={game} detail={null} sport={hubLeague(game.league)?.group ?? ""} />
        <WhereToWatch game={game} />
        <WatchSources game={game} />
        {game.source === "official-boxing" ? (
          <BoxingEventDetails game={game} />
        ) : combat ? (
          <FightCard
            games={fights.length ? fights : [game]}
            expanded
            onOpen={(g) => openMatchDetail(g)}
          />
        ) : competition ? (
          <>
            {game.league === "F1" && <F1Hub game={game} />}
            {fieldArt && (
              <img
                className="sh-published-event-art"
                src={fieldArt}
                alt=""
                loading="lazy"
                decoding="async"
                onError={(event) => {
                  event.currentTarget.hidden = true;
                }}
              />
            )}
            <HubCompetition game={game} />
          </>
        ) : game.source === "thesportsdb-hub" && hubLeague(game.league) ? (
          <EventMetadata
            key={`${game.league}:${game.id}`}
            game={game}
            league={hubLeague(game.league)!}
          />
        ) : (
          <div className={`sh-event-info ${game.poster || game.artwork ? "has-art" : ""}`}>
            {(game.poster || game.artwork) && (
              <img className="sh-event-poster" src={game.poster || game.artwork} alt="" />
            )}
            <div>
              <h3>{t("Event details")}</h3>
              {!game.field?.length && (
                <p>
                  {game.home.name} {game.away.name && `· ${game.away.name}`}
                </p>
              )}
              {game.source === "opendota" ? (
                <>
                  <p>
                    {game.home.score} : {game.away.score} · {game.detail}
                  </p>
                  <button
                    className="sh-button"
                    onClick={() => openUrl(`https://www.opendota.com/matches/${game.id}`)}
                  >
                    {t("View match statistics")}
                    <ExternalLink size={15} />
                  </button>
                </>
              ) : (
                <p className="sh-muted">
                  {t(
                    game.source === "official-one"
                      ? "Schedule from ONE Championship. Visit the official event page for the announced fight card."
                      : "Schedule from TheSportsDB. Live scores and detailed statistics are not supplied by this feed.",
                  )}
                </p>
              )}
              {broadcast && (
                <button className="sh-button" onClick={() => setWatch(true)}>
                  {t("Open official channel")}
                  <ArrowRight size={16} />
                </button>
              )}
              {!!game.field?.length && (
                <EventField field={game.field} state={game.state} league={game.league} />
              )}
            </div>
          </div>
        )}
        {game.source === "official-one" && /^[a-z0-9-]+$/.test(game.id) && (
          <button
            className="sh-button"
            onClick={() => openUrl(`https://www.onefc.com/events/${game.id}/`)}
          >
            {t("Official event page")}
            <ExternalLink size={16} />
          </button>
        )}
        <EventOdds game={game} />
      </div>
      <BackToTop scrollRef={scrollRef} onReturnToTop={() => titleRef.current?.focus({ preventScroll: true })} />
      {watch && broadcast && <BroadcastPlayer broadcast={broadcast} onClose={() => setWatch(false)} />}
    </main>
  );
}

export function HubEventPage(props: {
  game: SportsGame;
  games: SportsGame[];
  shellBackAvailable?: boolean;
}) {
  const { goBack } = useView();
  return legacyEsportsMatch(props.game) ? (
    <LegacyEsportsEvent game={props.game} onClose={goBack} page shellBackAvailable={props.shellBackAvailable} />
  ) : (
    <StandardHubEventPage {...props} />
  );
}
