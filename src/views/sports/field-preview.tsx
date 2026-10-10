import { TeamProfileLink, teamIdentity } from "./team-profile-link";
import { useEffect, useState } from "react";
import { ChevronDown, UserRound } from "lucide-react";
import { useT } from "@/lib/i18n";
import { sportsLeagueByTag } from "@/lib/sports/provider";
import { safeFetch } from "@/lib/safe-fetch";
import type { SportsGame, SportsMatchDetail } from "@/lib/sports/espn";
import {
  basketballFive,
  parseFootballDepth,
  parseFootballSquad,
  footballPositions,
  type FieldPlayer,
} from "@/lib/sports/field-lineups";
import { SportIcon } from "./sport-icon";
import { AthleteProfileLink } from "./athlete-profile";
import "./field-preview.css";

type Depth = ReturnType<typeof parseFootballDepth> & {
  squad?: ReturnType<typeof parseFootballSquad>;
};
const depthCache = new Map<string, { at: number; data: Depth }>();
function Portrait({ item }: { item: FieldPlayer }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="sh-field-portrait">
      {item.player?.image && !failed ? (
        <img src={item.player.image} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        item.player?.jersey || <UserRound size={18} />
      )}
    </span>
  );
}
export function FieldPreview({
  game,
  detail,
  basketball,
  failed,
}: {
  game: SportsGame;
  detail: SportsMatchDetail | null;
  basketball: boolean;
  failed: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [team, setTeam] = useState<"home" | "away">("home");
  const [unit, setUnit] = useState<"offense" | "defense">("offense");
  const [depth, setDepth] = useState<{ key: string; data: Depth } | null>(null);
  const [pending, setPending] = useState(false);
  const [selected, setSelected] = useState<FieldPlayer | null>(null);
  const side = game[team];
  const year = new Date(game.startMs).getFullYear();
  const path = sportsLeagueByTag(game.league)?.path;
  const key = `${path}:${side.id}:${year}`;
  useEffect(() => {
    if (!open || basketball || !path?.startsWith("football/")) return;
    const controller = new AbortController();
    const cached = depthCache.get(key);
    setPending(!cached);
    if (cached && Date.now() - cached.at < 3600000) {
      setDepth({ key, data: cached.data });
      setPending(false);
      return;
    }
    void (async () => {
      try {
        const response = await safeFetch(
          `https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${encodeURIComponent(side.id)}/depthcharts`,
          {
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
          },
        );
        if (!response.ok) return;
        const data: Depth = parseFootballDepth(
          await response.json(),
          game.league === "NFL" ? "nfl" : "college-football",
        );
        if (data.year !== year) return;
        if (!data.offense.length && !data.defense.length) {
          const rosterResponse = await safeFetch(
            `https://site.api.espn.com/apis/site/v2/sports/${path}/teams/${encodeURIComponent(side.id)}/roster`,
            {
              signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
            },
          );
          if (rosterResponse.ok) {
            const roster = await rosterResponse.json();
            if (Number(roster.season?.year) === year) data.squad = parseFootballSquad(roster);
          }
        }
        depthCache.set(key, { at: Date.now(), data });
        while (depthCache.size > 40) depthCache.delete(depthCache.keys().next().value!);
        if (!controller.signal.aborted) setDepth({ key, data });
      } catch {
      } finally {
        if (!controller.signal.aborted) setPending(false);
      }
    })();
    return () => controller.abort();
  }, [open, basketball, key, side.id, game.league, path]);
  const home = basketballFive(detail?.homeRoster ?? []);
  const away = basketballFive(detail?.awayRoster ?? []).map((item) => ({
    ...item,
    x: 100 - item.x,
  }));
  const players = basketball
    ? [
        ...home.map((item) => ({ ...item, side: "home" })),
        ...away.map((item) => ({ ...item, side: "away" })),
      ]
    : (depth?.key === key && depth.data[unit].length
        ? depth.data[unit]
        : footballPositions(unit)
      ).map((item) => ({
        ...item,
        side: team,
      }));
  const live = game.state === "in" && !failed && game.savedAt === undefined;
  return (
    <details className="sh-field-preview" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary tabIndex={0}>
        <SportIcon name={basketball ? "basketball" : "football"} size={24} />
        <span>
          <strong>{t(basketball ? "On the court" : "On the field")}</strong>
          <small>{t(basketball ? "Announced starters" : "Team depth chart")}</small>
        </span>
        <b className={live ? "is-live" : ""}>
          {game.state === "pre" ? t("Upcoming") : `${game.home.score} : ${game.away.score}`}
        </b>
        <ChevronDown size={18} />
      </summary>
      {open && (
        <div className="sh-field-body">
          <div className="sh-field-tools">
            {basketball && (
              <span>
                <TeamProfileLink team={teamIdentity(game, "home")}>{game.home.name}</TeamProfileLink>{" "}
                ·{" "}
                <TeamProfileLink team={teamIdentity(game, "away")}>{game.away.name}</TeamProfileLink>
              </span>
            )}
            {!basketball && (
              <>
                <div role="group" aria-label={t("Team")}>
                  {(["home", "away"] as const).map((value) => (
                    <button
                      key={value}
                      aria-label={game[value].name}
                      title={game[value].name}
                      aria-pressed={team === value}
                      onClick={() => {
                        setTeam(value);
                        setSelected(null);
                      }}
                    >
                      {game[value].logo && <img src={game[value].logo} alt="" />}
                      {game[value].abbr}
                    </button>
                  ))}
                </div>
                <div role="group" aria-label={t("Lineups")}>
                  {(["offense", "defense"] as const).map((value) => (
                    <button
                      key={value}
                      aria-pressed={unit === value}
                      onClick={() => {
                        setUnit(value);
                        setSelected(null);
                      }}
                    >
                      {t(value === "offense" ? "Offense" : "Defense")}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          {!basketball && detail?.football && (
            <div className="sh-football-situation">
              <span>{t("Latest reported play")}</span>
              <b>
                {t("Current down")}: {detail.football.down}
              </b>
              {detail.football.distance !== undefined && (
                <b>
                  {t("Distance")}: {detail.football.distance}
                </b>
              )}
              {detail.football.yardLineText && (
                <b>
                  {t("Yard line")}: {detail.football.yardLineText}
                </b>
              )}
              {detail.football.possessionTeamId && (
                <b>
                  {t("Ball possession")}:{" "}
                  {[game.home, game.away].find(
                    (side) => side.id === detail.football?.possessionTeamId,
                  )?.abbr || "—"}
                </b>
              )}
            </div>
          )}
          <div
            className={basketball ? "sh-basketball-court" : "sh-football-field"}
            aria-label={t(basketball ? "Basketball court" : "American football field")}
          >
            {basketball ? (
              <>
                <i className="sh-court-center" />
                {["left", "right"].map((end) => (
                  <div key={end} className={`sh-court-end ${end}`}>
                    <i className="sh-court-arc" />
                    <i className="sh-court-key" />
                    <i className="sh-court-free" />
                    <i className="sh-court-hoop" />
                  </div>
                ))}
              </>
            ) : (
              <>
                <div className="sh-gridiron-end left">{side.abbr}</div>
                <div className="sh-gridiron-end right">{side.abbr}</div>
                <div className="sh-yard-lines">
                  {Array.from({ length: 9 }, (_, i) => (
                    <i key={i} style={{ left: `${(i + 1) * 10}%` }}>
                      <span>{Math.min(i + 1, 9 - i) * 10}</span>
                      <span>{Math.min(i + 1, 9 - i) * 10}</span>
                    </i>
                  ))}
                </div>
              </>
            )}
            {players.map((item, i) => (
              <button
                className={`sh-field-player ${item.side}`}
                key={`${item.side}:${item.slot}:${i}`}
                style={{ left: `${item.x}%`, top: `${item.y}%` }}
                disabled={!item.player}
                onClick={() => setSelected(item)}
                aria-label={item.player ? `${item.player.name} · ${item.slot}` : item.slot}
              >
                <Portrait item={item} />
                <strong>
                  {item.player?.name.split(" ").slice(1).join(" ") ||
                    item.player?.name ||
                    item.slot}
                </strong>
                <small>{item.slot}</small>
              </button>
            ))}
          </div>
          {selected?.player && (
            <div className="sh-field-inspect">
              <Portrait item={selected} />
              <strong>{selected.player.name}</strong>
              <AthleteProfileLink athlete={selected.player} league={game.league} />
              <span>
                {selected.player.position}
                {selected.player.jersey && ` · #${selected.player.jersey}`}
              </span>
            </div>
          )}
          <p className="sh-muted" role="status">
            {pending
              ? t("Loading lineups…")
              : players.some((item) => item.player)
                ? t(
                    basketball
                      ? "Lineup positions, not live player tracking."
                      : "Current team depth chart. Game-day lineups and live positions may differ.",
                  )
                : t(
                    basketball
                      ? "Lineups have not been announced yet."
                      : "Lineup data is unavailable.",
                  )}
          </p>
          {!basketball && depth?.key === key && !!depth.data.squad?.length && (
            <section className="sh-field-squad">
              <h3>{t("Team roster")}</h3>
              <p className="sh-muted">
                {t("Current team roster. The starting lineup has not been confirmed.")}
              </p>
              <div>
                {depth.data.squad.map((player) => (
                  <div key={player.id}>
                    <Portrait item={{ slot: player.position, x: 0, y: 0, player }} />
                    <AthleteProfileLink athlete={player} league={game.league} label={player.name} />
                    <small>
                      {player.position} · {player.jersey}
                    </small>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </details>
  );
}
