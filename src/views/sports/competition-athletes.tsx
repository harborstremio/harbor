import type { AthleteIdentityRequest } from "@/lib/sports/athlete-identity";
import { isIndividualCompetition } from "@/lib/sports/competition-metadata";
import { AthleteProfileLink } from "./athlete-profile";
import { CompetitionAthletePortrait } from "./competition-athlete-portrait";
import "./competition-athletes.css";

/** Team names and unverified report text remain text, even in an individual sport. */
export function CompetitionAthletes({
  name,
  athletes,
  league,
  group,
}: {
  name: string;
  athletes?: AthleteIdentityRequest[];
  league: string;
  group: string;
}) {
  if (!isIndividualCompetition(group)) return <>{name}</>;
  const normalize = (value: string) =>
    value
      .normalize("NFKD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  return (
    <span className="sh-competition-athletes">
      {name.split(" / ").map((label, index) => {
        const matches = (athletes ?? []).filter((person) => normalize(person.name) === normalize(label));
        const person = matches.length === 1 ? matches[0] : undefined;
        const named = !/^(?:tbd|tba|unknown|winner|loser|bye)(?:\b|$)/i.test(label);
        return (
          <span className="sh-competition-athlete" key={`${label}:${index}`}>
            {named && (
              <CompetitionAthletePortrait name={label} athlete={person} league={league} group={group} />
            )}
            <span className="sh-competition-athlete-name">
              {person && named ? (
                <AthleteProfileLink athlete={person} league={league} label={label} inline />
              ) : label}
            </span>
          </span>
        );
      })}
    </span>
  );
}
