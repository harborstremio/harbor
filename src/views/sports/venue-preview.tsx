import { TeamProfileLink, teamIdentity } from "./team-profile-link";
import { useRef, useState } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { SportsGame, SportsMatchDetail } from "@/lib/sports/espn";
import { VenueMarks } from "./venue-markings";
import { venueLineup } from "@/lib/sports/venue-lineups";
import { hubLeague } from "@/lib/sports/hub-data";
import { SportIcon } from "./sport-icon";
import { AthleteProfileLink, type AthleteIdentity } from "./athlete-profile";
import { useAthletePortrait } from "./use-athlete-portrait";
import { publishedPortraitUrl } from "@/lib/sports/athlete-portraits";
import "./field-preview.css";
import "./venue-preview.css";

function VenueAthlete({
  athlete,
  league,
  resolvePortrait = false,
}: {
  athlete: AthleteIdentity;
  league: string;
  resolvePortrait?: boolean;
}) {
  const [broken, setBroken] = useState("");
  const [selected, setSelected] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const provided = athlete.image || athlete.logo || "";
  const group = hubLeague(league)?.group;
  // Boxing parsers already verify each promoter photo against the named fighter.
  const providedPortrait = group === "boxing" ? provided : publishedPortraitUrl(provided);
  const photo = useAthletePortrait(
    {
      path: hubLeague(league)?.path ?? "",
      group,
      id: athlete.id,
      name: athlete.name,
      image: broken === provided ? "" : provided,
    },
    (resolvePortrait || selected) && (!providedPortrait || broken === providedPortrait),
  );
  const image =
    (providedPortrait && broken !== providedPortrait ? providedPortrait : photo.image) || provided;
  return (
    <div className="sh-venue-athlete" ref={root}>
      <button
        className="sh-venue-portrait"
        aria-label={athlete.name}
        onClick={() => {
          setSelected(true);
          root.current?.querySelector<HTMLButtonElement>(".sh-athlete-link")?.click();
        }}
      >
        {image && broken !== image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            decoding="async"
            onError={() => setBroken(image)}
          />
        ) : (
          <UserRound size={22} />
        )}
      </button>
      <AthleteProfileLink athlete={{ ...athlete, image }} league={league} label={athlete.name} />
    </div>
  );
}

export const VENUE_SPORTS = [
  "hockey",
  "tennis",
  "rugby",
  "cricket",
  "aussie",
  "lacrosse",
  "boxing",
  "combat",
];
export function VenuePreview({
  game,
  detail,
  sport,
  failed = false,
}: {
  game: SportsGame;
  detail: SportsMatchDetail | null;
  sport: string;
  failed?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<"home" | "away">("home");
  if (!VENUE_SPORTS.includes(sport)) return null;
  const singles = ["tennis", "boxing", "combat"].includes(sport);
  const singleTeam = ["rugby", "lacrosse", "cricket", "aussie"].includes(sport);
  return (
    <details className="sh-field-preview" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>
        <SportIcon name={sport} />
        <span>
          <strong>{t("Venue preview")}</strong>
          <small>
            {t(
              sport === "hockey"
                ? "Rink and player positions"
                : sport === "tennis"
                  ? "Court and player positions"
                  : singles
                    ? "Arena and competitors"
                    : "Field and team lineup",
            )}
          </small>
        </span>
        <b
          className={game.state === "in" && !failed && game.savedAt === undefined ? "is-live" : ""}
        >
          {game.state === "pre" ? t("Upcoming") : `${game.home.score} : ${game.away.score}`}
        </b>
        <ChevronDown size={18} />
      </summary>
      {open && (
        <div className="sh-field-body">
          <div className="sh-field-tools">
            <span>
              <TeamProfileLink team={teamIdentity(game, "home")}>{game.home.name}</TeamProfileLink>{" "}
              ·{" "}
              <TeamProfileLink team={teamIdentity(game, "away")}>{game.away.name}</TeamProfileLink>
            </span>
            <strong>{game.detail}</strong>
            {singleTeam && (
              <div role="group" aria-label={t("Team")}>
                {(["home", "away"] as const).map((side) => (
                  <button key={side} aria-pressed={side === team} onClick={() => setTeam(side)}>
                    {game[side].logo && <img src={game[side].logo} alt="" />}
                    {game[side].abbr || game[side].name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className={`sh-venue sh-venue-${sport}`}>
            <VenueMarks sport={sport} />
            {(["home", "away"] as const).map((side) => {
              if (singleTeam && team !== side) return null;
              const roster = detail?.[side === "home" ? "homeRoster" : "awayRoster"] ?? [];
              const slots = venueLineup(sport, roster);
              return singles ? (
                <div key={side} className={`sh-venue-competitor ${side}`}>
                  <VenueAthlete
                    athlete={{
                      ...game[side],
                      image: detail?.[side === "home" ? "homeProfile" : "awayProfile"]?.fullImage,
                    }}
                    league={game.league}
                    resolvePortrait
                  />
                </div>
              ) : (
                slots.map(({ x, y, label, player }, index) => (
                  <div
                    key={`${side}:${index}`}
                    className="sh-venue-position"
                    style={{
                      left: `${singleTeam ? x * 1.8 + 3 : side === "home" ? x : 100 - x}%`,
                      top: `${y}%`,
                    }}
                  >
                    {player ? (
                      <VenueAthlete athlete={player} league={game.league} />
                    ) : (
                      <span>{label}</span>
                    )}
                  </div>
                ))
              );
            })}
          </div>
          <p className="sh-muted">
            {t("Venue layout. Player locations are illustrative, not live tracking.")}
          </p>
          {!singles && (
            <div className="sh-venue-roster">
              {(singleTeam
                ? (detail?.[team === "home" ? "homeRoster" : "awayRoster"] ?? [])
                : [...(detail?.homeRoster ?? []), ...(detail?.awayRoster ?? [])]
              ).map((player) => (
                <VenueAthlete key={player.id} athlete={player} league={game.league} />
              ))}
            </div>
          )}
          {!singles && !detail?.homeRoster.length && !detail?.awayRoster.length && (
            <p className="sh-muted">{t("Lineup data is unavailable.")}</p>
          )}
          {!!detail?.events.length && (
            <div className="sh-venue-events" aria-label={t("Latest reported play")}>
              {detail.events
                .slice(-3)
                .reverse()
                .map((event, index) => (
                  <p key={event.id || index}>
                    <time>{event.time}</time>
                    <span>{event.text || event.participantName}</span>
                  </p>
                ))}
            </div>
          )}
        </div>
      )}
    </details>
  );
}
