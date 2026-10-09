import type { SportsGame } from "./espn-types";

type DotaMatch = Record<string, unknown>;
export function parseDotaMatches(raw: unknown, live: boolean, now = Date.now()): SportsGame[] {
  if (!Array.isArray(raw)) throw new Error("Invalid OpenDota response");
  return raw.flatMap((item: DotaMatch) => {
    const id = String(item.match_id || "");
    const home = String((live ? item.team_name_radiant : item.radiant_name) || "");
    const away = String((live ? item.team_name_dire : item.dire_name) || "");
    const league = Number(live ? item.league_id : item.leagueid);
    if (!id || !home || !away || !league) return [];
    if (
      live &&
      (!Number(item.last_update_time) || now - Number(item.last_update_time) * 1000 > 5 * 60_000)
    )
      return [];
    const seconds = Number(live ? item.game_time : item.duration) || 0;
    const startMs = live ? Number(item.activate_time) * 1000 : Number(item.start_time) * 1000;
    if (!Number.isFinite(startMs) || !startMs) return [];
    const side = (name: string, radiant: boolean) => ({
      id: String(
        (live
          ? item[radiant ? "team_id_radiant" : "team_id_dire"]
          : item[radiant ? "radiant_team_id" : "dire_team_id"]) || "",
      ),
      name,
      abbr: name,
      logo: "",
      score: String(item[radiant ? "radiant_score" : "dire_score"] ?? ""),
      winner: !live && (radiant ? item.radiant_win === true : item.radiant_win === false),
    });
    return [
      {
        id,
        league: "DOTA2",
        source: "opendota",
        state: live ? ("in" as const) : ("post" as const),
        home: side(home, true),
        away: side(away, false),
        startMs,
        detail: `${Math.max(0, Math.floor(seconds / 60))}:${String(Math.max(0, seconds % 60)).padStart(2, "0")}`,
        context: {
          id,
          name: String(item.league_name || `${home} vs ${away}`),
          round: "",
          draw: "",
          venue: "",
          major: false,
        },
        artwork:
          "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/570/header.jpg",
      },
    ];
  });
}
