import { lazy, Suspense, useRef, useState, type ReactNode } from "react";
import type { SportsGame, SportsSide } from "@/lib/sports/espn";
import type { TeamIdentity } from "@/lib/sports/team-profile";
import { hubLeague } from "@/lib/sports/hub-data";
import "./team-profile.css";

const Profile = lazy(() =>
  import("./team-profile").then((module) => ({ default: module.TeamProfile })),
);

const INDIVIDUAL_GROUPS = new Set([
  "combat",
  "boxing",
  "tennis",
  "golf",
  "motorsport",
  "esports",
  "cycling",
  "winter",
  "athletics",
  "snooker",
  "darts",
  "badminton",
  "tabletennis",
]);

export function teamIdentity(
  game: SportsGame,
  side: "home" | "away" | SportsSide,
): TeamIdentity | undefined {
  const group = hubLeague(game.league)?.group;
  if (!group || INDIVIDUAL_GROUPS.has(group)) return;
  const team = typeof side === "string" ? game[side] : side;
  if (!team.name || /^(?:tbd|tba|unknown|winner|loser|bye)(?:\b|$)/i.test(team.name)) return;
  return {
    id: team.id,
    name: team.name,
    logo: team.logo,
    league: game.league,
    source: game.source,
  };
}

export function TeamProfileLink({
  team,
  children,
  className = "",
}: {
  team?: TeamIdentity;
  children: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  if (!team) return <span className={className}>{children}</span>;
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={`sh-team-profile-link ${className}`}
        aria-label={team.name}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        {children}
      </button>
      {open && (
        <Suspense fallback={null}>
          <Profile
            team={team}
            onClose={() => {
              setOpen(false);
              trigger.current?.focus({ preventScroll: true });
            }}
          />
        </Suspense>
      )}
    </>
  );
}
