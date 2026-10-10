import type { SportsPage } from "@/lib/jl/sports/pages";
import { AthletePage } from "./athlete";
import { CollegePage } from "./college";
import { CollegesPage } from "./colleges";
import { ConferencesPage } from "./conferences";
import { LeaguePage } from "./league";
import { LeaguesPage } from "./leagues";
import { MatchCenterPage } from "./match-center";
import { StudentPage } from "./student";
import { TeamPage } from "./team";
import { WorldSportsPage } from "./world-sports";

/** One view for every deeper Sports page; each kind lives in its own file. */
export function SportsPageView({ page }: { page: SportsPage }) {
  switch (page.kind) {
    case "team":
      return <TeamPage page={page} />;
    case "athlete":
      return <AthletePage page={page} />;
    case "league":
      return <LeaguePage page={page} />;
    case "leagues":
      return <LeaguesPage page={page} />;
    case "world":
      return <WorldSportsPage />;
    case "match-center":
      return <MatchCenterPage page={page} />;
    case "colleges":
      return <CollegesPage page={page} />;
    case "college":
      return <CollegePage page={page} />;
    case "conferences":
      return <ConferencesPage page={page} />;
    case "student":
      return <StudentPage page={page} />;
  }
}
