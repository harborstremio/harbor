import type { AudienceBoard } from "@/lib/games/audience-charts";
import { LibrarySourceMark } from "./game-library-marks";
import { GameLauncherLogo } from "./game-launcher-logo";

/** Original platform marks inherit the dropdown's selected/focused contrast. */
export function AudiencePlatformMark({ board }: { board: AudienceBoard }) {
  if (board === "steam") return <GameLauncherLogo launcher="steam" size={19}/>;
  if (board === "xbox") return <span className="games-audience-xbox-mark" aria-hidden="true"/>;
  if (board === "deck") return <span className="games-audience-deck-mark" aria-hidden="true"/>;
  if (board === "pc") return <LibrarySourceMark source="custom" size={21}/>;
  return <span className="games-audience-console-marks" aria-hidden="true">
    <span className="games-audience-playstation-mark"/>
    <span className="games-audience-xbox-mark"/>
  </span>;
}
