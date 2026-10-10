import { TeamProfileLink, teamIdentity } from "./team-profile-link";

import "./team-links.css";

import { useRef } from "react";

import { ArrowRight } from "lucide-react";

import { useT } from "@/lib/i18n";

import { useInViewport } from "@/lib/visibility";

import type { SportsGame } from "@/lib/sports/espn";

import { SoccerPreview } from "./soccer-preview";

import { useMatchDetail } from "./use-match-detail";

import { EventOdds } from "./event-odds";

import { EventLogo } from "./hub-cards";

export function HubPitchSpotlight({
  game,

  active,

  onOpen,
}: {
  game: SportsGame;

  active: boolean;

  onOpen: (g: SportsGame) => void;
}) {
  const t = useT();

  const root = useRef<HTMLElement>(null);

  const inView = useInViewport(root, false);

  const { detail, loading, failed, retry } = useMatchDetail(
    game,

    active && inView,
  );

  const score = detail ?? game;

  return (
    <section ref={root} className="sh-pitch-spotlight">
      <div className="sh-section-head">
        <div>
          <span className="sh-eyebrow">{t("ON THE PITCH")}</span>

          <h2>
            <TeamProfileLink team={teamIdentity(game, "home")}>{game.home.name}</TeamProfileLink> ·{" "}
            <TeamProfileLink team={teamIdentity(game, "away")}>{game.away.name}</TeamProfileLink>
          </h2>

          <p>{t("The shape of the game. Explore the announced lineup.")}</p>
        </div>

        <button className="sh-button" onClick={() => onOpen(game)}>
          {t("Match center")}

          <ArrowRight size={16} />
        </button>
      </div>

      <div className="sh-pitch-score" aria-live="polite">
        <TeamProfileLink className="sh-pitch-score-team is-home" team={teamIdentity(score, "home")}>
          <EventLogo
            side={{ ...score.home, logo: score.home.logo || game.home.logo }}
            sport="soccer"
          />
          <span>{score.home.abbr || score.home.name}</span>
        </TeamProfileLink>

        <strong>
          {score.state === "pre" ? "—" : score.home.score}

          <i>:</i>

          {score.state === "pre" ? "—" : score.away.score}
        </strong>

        <TeamProfileLink className="sh-pitch-score-team is-away" team={teamIdentity(score, "away")}>
          <span>{score.away.abbr || score.away.name}</span>
          <EventLogo
            side={{ ...score.away, logo: score.away.logo || game.away.logo }}
            sport="soccer"
          />
        </TeamProfileLink>

        <small
          className={
            score.state === "in" && !failed && score.savedAt === undefined ? "is-live" : ""
          }
        >
          {failed || score.savedAt !== undefined
            ? t("Last saved score")
            : t(
                score.state === "in"
                  ? "Live now"
                  : score.state === "post"
                    ? "Full time"
                    : "Upcoming",
              )}{" "}
          · {score.detail}
        </small>
      </div>

      <SoccerPreview
        key={`${game.league}:${game.id}`}

        game={score}

        detail={detail}

        loading={loading}

        failed={failed}

        hideScore

        defaultOpen
      />

      {failed && (
        <button className="sh-text-button" onClick={retry}>
          {t("Retry")}
        </button>
      )}

      <EventOdds game={score} />
    </section>
  );
}
