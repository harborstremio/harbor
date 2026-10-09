import type { AthleteIdentityRequest } from "@/lib/sports/athlete-identity";
import type { LeagueDef } from "@/lib/sports/espn";
import { AthleteProfileLink } from "./athlete-profile";
import { CompetitionAthletePortrait } from "./competition-athlete-portrait";
import "./competition-athletes.css";

export function LeagueGuideAthlete({
  athlete,
  league,
}: {
  athlete: AthleteIdentityRequest;
  league: LeagueDef;
}) {
  return (
    <span className="sh-league-guide-athlete">
      <CompetitionAthletePortrait
        name={athlete.name}
        athlete={athlete}
        league={league.key}
        group={league.group}
      />
      {athlete.id ? (
        <AthleteProfileLink athlete={athlete} league={league.key} label={athlete.name} inline />
      ) : (
        <strong>{athlete.name}</strong>
      )}
    </span>
  );
}

export function LeagueGuideAthletes({
  athletes,
  league,
}: {
  athletes: AthleteIdentityRequest[];
  league: LeagueDef;
}) {
  return (
    <div className="sh-league-guide-teams">
      {athletes.map((athlete) => (
        <div
          className="sh-league-guide-team sh-league-guide-person"
          key={`${athlete.id}:${athlete.name}`}
        >
          <LeagueGuideAthlete athlete={athlete} league={league} />
        </div>
      ))}
    </div>
  );
}
