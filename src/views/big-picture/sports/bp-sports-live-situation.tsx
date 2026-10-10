import type { SportsGame, SportsMatchDetail } from "@/lib/sports/espn-types";
import { hubLeague } from "@/lib/sports/hub-data";
import { sportsLeagueByTag } from "@/lib/sports/provider";
import { BP_SPORTS_TIP, BpSportsPanelCell } from "./bp-sports-extra-kit";
import { BpSportsLiveCourt, bpSportsHasCourt } from "./bp-sports-live-court";
import { BpSportsLiveDiamond, bpSportsHasDiamond } from "./bp-sports-live-diamond";
import { BpSportsLiveField, bpSportsHasField } from "./bp-sports-live-field";

const NARROW = "clamp(340px,34vw,660px)";

const WIDE = "clamp(380px,46vw,940px)";

function groupOf(game: SportsGame | null): string {
  if (!game) return "";
  return sportsLeagueByTag(game.league)?.group ?? hubLeague(game.league)?.group ?? "";
}

export type BpSportsSituationKind = "" | "diamond" | "field" | "court";

export function bpSportsSituationKind(
  game: SportsGame | null,
  detail: SportsMatchDetail | null,
): BpSportsSituationKind {
  if (!game || !detail) return "";
  if (bpSportsHasDiamond(detail)) return "diamond";
  if (bpSportsHasField(detail)) return "field";
  if (bpSportsHasCourt(groupOf(game), detail)) return "court";
  return "";
}

export function BpSportsLiveSituationCell({
  kind,
  detail,
  caption,
}: {
  kind: BpSportsSituationKind;
  detail: SportsMatchDetail;
  caption: string;
}) {
  if (kind === "") return null;

  return (
    <BpSportsPanelCell restoreKey="sports-situation" width={kind === "diamond" ? NARROW : WIDE}>
      {caption !== "" && <span className={`${BP_SPORTS_TIP} truncate`}>{caption}</span>}
      {kind === "diamond" && <BpSportsLiveDiamond detail={detail} />}
      {kind === "field" && <BpSportsLiveField detail={detail} />}
      {kind === "court" && <BpSportsLiveCourt detail={detail} />}
    </BpSportsPanelCell>
  );
}
