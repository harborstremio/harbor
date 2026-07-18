import { useEffect, useState, useMemo } from "react";
import { ArrowLeft } from "lucide-react";
import { useT } from "@/lib/i18n";
import { useView } from "@/lib/view";
import { fetchMatchSummary, type SportsGame, type SportsMatchDetail } from "@/lib/sports/espn";

export function MatchDetailView({ game }: { game: SportsGame }) {
  const t = useT();
  const { goBack } = useView();
  const [detail, setDetail] = useState<SportsMatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"summary" | "lineups" | "stats" | "profile">("summary");
  const isCombat = game.id.includes("|") || game.league === "UFC";

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchMatchSummary(game.league, game.id).then((res) => {
      if (!active) return;
      if (res) setDetail(res);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [game]);

  const hYellow = parseInt(detail?.homeStats?.yellowCards || "0", 10);
  const hRed = parseInt(detail?.homeStats?.redCards || "0", 10);
  const aYellow = parseInt(detail?.awayStats?.yellowCards || "0", 10);
  const aRed = parseInt(detail?.awayStats?.redCards || "0", 10);

  return (
    <div className="flex h-full flex-col bg-canvas pb-8">
      {/* Header */}
      <div className="relative shrink-0 pb-10 pt-24">
        <div className="absolute inset-x-0 top-0 h-full bg-gradient-to-b from-brand/10 via-brand/5 to-transparent opacity-80" />
        <button
          onClick={goBack}
          className="absolute start-6 top-24 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-elevated/80 text-ink shadow-lg ring-1 ring-edge-soft/50 transition-colors hover:bg-elevated hover:text-ink-muted md:top-20"
        >
          <ArrowLeft size={20} className="dir-icon" />
        </button>
        <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 pt-4">
          <div className="flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-4 py-1.5 text-[12px] font-bold uppercase tracking-widest text-brand">
            {game.state === "in" && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand"></span>
              </span>
            )}
            {game.league}
          </div>
          <div className="flex w-full items-center justify-center gap-4 md:gap-12">
            <div className="flex flex-1 flex-col items-center gap-4 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-elevated/40 p-3 shadow-xl ring-1 ring-edge-soft/50 backdrop-blur-sm md:h-32 md:w-32 md:p-5">
                {game.home.logo ? (
                  <img
                    src={game.home.logo}
                    className="h-full w-full object-contain drop-shadow-md"
                    alt=""
                  />
                ) : (
                  <div className="h-full w-full rounded-full bg-canvas" />
                )}
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-xl font-bold leading-tight md:text-2xl">
                  {game.home.name}
                </span>
                {detail && (hYellow > 0 || hRed > 0) && (
                  <div className="flex items-center gap-1">
                    {hYellow > 0 &&
                      Array.from({ length: hYellow }).map((_, i) => (
                        <div
                          key={`y-${i}`}
                          className="h-3.5 w-2.5 rounded-[2px] bg-yellow-400 shadow-sm ring-1 ring-black/20"
                        />
                      ))}
                    {hRed > 0 &&
                      Array.from({ length: hRed }).map((_, i) => (
                        <div
                          key={`r-${i}`}
                          className="h-3.5 w-2.5 rounded-[2px] bg-red-500 shadow-sm ring-1 ring-black/20"
                        />
                      ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center justify-center gap-4 rounded-[2rem] border border-edge-soft/30 bg-elevated/50 px-6 py-4 shadow-2xl ring-1 ring-inset ring-white/5 backdrop-blur-xl md:px-8 md:py-5">
                <span className="text-5xl font-black tabular-nums tracking-tighter text-ink drop-shadow-sm md:text-7xl">
                  {game.home.score || "0"}
                </span>
                <span className="text-3xl font-black text-ink-subtle md:text-5xl">-</span>
                <span className="text-5xl font-black tabular-nums tracking-tighter text-ink drop-shadow-sm md:text-7xl">
                  {game.away.score || "0"}
                </span>
              </div>
              <div className="rounded-full bg-ink px-4 py-1.5 text-[13px] font-bold tracking-wide text-canvas shadow-md">
                {game.detail ||
                  (game.state === "in"
                    ? t("Live")
                    : game.state === "post"
                      ? t("Final")
                      : t("Upcoming"))}
              </div>
            </div>
            <div className="flex flex-1 flex-col items-center gap-4 text-center">
              <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-elevated/40 p-3 shadow-xl ring-1 ring-edge-soft/50 backdrop-blur-sm md:h-32 md:w-32 md:p-5">
                {game.away.logo ? (
                  <img
                    src={game.away.logo}
                    className="h-full w-full object-contain drop-shadow-md"
                    alt=""
                  />
                ) : (
                  <div className="h-full w-full rounded-full bg-canvas" />
                )}
              </div>
              <div className="flex flex-col items-center gap-2">
                <span className="text-xl font-bold leading-tight md:text-2xl">
                  {game.away.name}
                </span>
                {detail && (aYellow > 0 || aRed > 0) && (
                  <div className="flex items-center gap-1">
                    {aYellow > 0 &&
                      Array.from({ length: aYellow }).map((_, i) => (
                        <div
                          key={`y-${i}`}
                          className="h-3.5 w-2.5 rounded-[2px] bg-yellow-400 shadow-sm ring-1 ring-black/20"
                        />
                      ))}
                    {aRed > 0 &&
                      Array.from({ length: aRed }).map((_, i) => (
                        <div
                          key={`r-${i}`}
                          className="h-3.5 w-2.5 rounded-[2px] bg-red-500 shadow-sm ring-1 ring-black/20"
                        />
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mx-auto mt-8 flex w-full max-w-4xl shrink-0 gap-6 border-b border-edge-soft/50 px-6">
        {(isCombat
          ? (["summary", "profile", "stats"] as const)
          : (["summary", "lineups", "stats"] as const)
        ).map((tId) => (
          <button
            key={tId}
            onClick={() => setTab(tId)}
            className={`relative pb-3 text-sm font-semibold capitalize transition-colors ${tab === tId ? "text-ink" : "text-ink-subtle hover:text-ink-muted"}`}
          >
            {t(tId)}
            {tab === tId && (
              <div className="absolute inset-x-0 bottom-0 h-0.5 rounded-t-full bg-brand" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col overflow-y-auto px-6 py-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-ink-subtle border-t-transparent" />
          </div>
        ) : !detail ? (
          <div className="flex flex-1 items-center justify-center text-ink-subtle">
            {t("Failed to load match details.")}
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {tab === "summary" && <SummaryTab detail={detail} />}
            {tab === "lineups" && <LineupsTab detail={detail} />}
            {tab === "stats" && <StatsTab detail={detail} />}
            {tab === "profile" && <MmaProfileTab detail={detail} />}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryTab({ detail }: { detail: SportsMatchDetail }) {
  const t = useT();
  if (!detail.events || detail.events.length === 0) {
    return (
      <div className="text-center text-sm text-ink-subtle">{t("No events available yet.")}</div>
    );
  }

  const allPlayers = [...detail.homeRoster, ...detail.awayRoster];

  return (
    <div className="flex flex-col gap-4">
      {detail.events.map((e, i) => {
        let playerImage = "";
        let foundPlayer = null;
        if (e.participantName) {
          const pName = e.participantName.toLowerCase();
          foundPlayer = allPlayers.find((p) => {
            const lower = p.name.toLowerCase();
            return (
              lower === pName ||
              lower.includes(pName) ||
              pName.includes(lower.split(" ").pop() || "___")
            );
          });
        }
        if (!foundPlayer && e.text) {
          const textLower = e.text.toLowerCase();
          foundPlayer = allPlayers.find((p) => {
            const lastName = p.name.toLowerCase().split(" ").pop();
            return lastName && lastName.length > 2 && textLower.includes(lastName);
          });
        }
        if (foundPlayer && foundPlayer.image) {
          playerImage = foundPlayer.image;
        }

        return (
          <div
            key={i}
            className="flex items-center gap-4 rounded-xl border border-edge-soft/30 bg-elevated/40 p-4"
          >
            <div className="flex w-12 shrink-0 items-center justify-center font-bold text-ink-muted">
              {e.time}
            </div>
            {playerImage ? (
              <img
                src={playerImage}
                className="h-10 w-10 shrink-0 rounded-full bg-canvas object-cover ring-1 ring-edge-soft/50"
                alt=""
              />
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-canvas ring-1 ring-edge-soft/50">
                {e.type === "goal" && <span className="text-lg">⚽</span>}
                {e.type === "yellow_card" && <div className="h-4 w-3 rounded-sm bg-yellow-400" />}
                {e.type === "red_card" && <div className="h-4 w-3 rounded-sm bg-red-500" />}
                {e.type === "substitution" && <span className="text-lg">🔄</span>}
                {e.type === "other" && <span className="text-lg">ℹ️</span>}
              </div>
            )}
            <div className="flex flex-1 flex-col justify-center gap-1">
              <span className="text-[14px] font-semibold text-ink">{e.text}</span>
              {e.participantName && (
                <span className="text-[12px] text-ink-subtle">{e.participantName}</span>
              )}
            </div>
            {playerImage && (
              <div className="flex shrink-0 items-center justify-center px-2">
                {e.type === "goal" && <span className="text-xl drop-shadow-md">⚽</span>}
                {e.type === "yellow_card" && (
                  <div className="h-5 w-3.5 rounded-[2px] bg-yellow-400 shadow-md ring-1 ring-black/20" />
                )}
                {e.type === "red_card" && (
                  <div className="h-5 w-3.5 rounded-[2px] bg-red-500 shadow-md ring-1 ring-black/20" />
                )}
                {e.type === "substitution" && <span className="text-xl drop-shadow-md">🔄</span>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function LineupsTab({ detail }: { detail: SportsMatchDetail }) {
  const t = useT();
  if (!detail.homeRoster.length && !detail.awayRoster.length) {
    return (
      <div className="text-center text-sm text-ink-subtle">{t("Lineups not available yet.")}</div>
    );
  }

  const isSoccer = [
    "EPL",
    "UCL",
    "LALIGA",
    "SERIEA",
    "BUNDESLIGA",
    "LIGUE1",
    "MLS",
    "ROSHN",
    "UEL",
    "UECL",
    "WC",
    "AFC",
  ].includes(detail.league);

  return (
    <div className="flex flex-col gap-8">
      {isSoccer && detail.homeRoster.length > 0 && (
        <div className="flex flex-col gap-8 md:flex-row">
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center justify-between border-b border-edge-soft/50 pb-2 px-2">
              <div className="flex items-center gap-3">
                {detail.home.logo && (
                  <img src={detail.home.logo} className="h-8 w-8 object-contain" alt="" />
                )}
                <span className="font-bold text-lg">{detail.home.name}</span>
              </div>
              {detail.homeFormation && (
                <span className="rounded-full bg-elevated px-3 py-1 text-xs font-bold text-ink-muted ring-1 ring-edge-soft/50">
                  {t(detail.homeFormation)}
                </span>
              )}
            </div>
            <TeamPitch
              roster={detail.homeRoster}
              formation={detail.homeFormation || ""}
              teamAbbr={detail.home.abbr || "HOME"}
              isHome={true}
            />
          </div>
          <div className="flex flex-1 flex-col gap-4">
            <div className="flex items-center justify-between border-b border-edge-soft/50 pb-2 px-2">
              <div className="flex items-center gap-3">
                {detail.away.logo && (
                  <img src={detail.away.logo} className="h-8 w-8 object-contain" alt="" />
                )}
                <span className="font-bold text-lg">{detail.away.name}</span>
              </div>
              {detail.awayFormation && (
                <span className="rounded-full bg-elevated px-3 py-1 text-xs font-bold text-ink-muted ring-1 ring-edge-soft/50">
                  {t(detail.awayFormation)}
                </span>
              )}
            </div>
            <TeamPitch
              roster={detail.awayRoster}
              formation={detail.awayFormation || ""}
              teamAbbr={detail.away.abbr || "AWAY"}
              isHome={false}
            />
          </div>
        </div>
      )}

      {/* Full Roster List */}
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="flex flex-1 flex-col gap-4 rounded-2xl bg-elevated/30 p-4 ring-1 ring-edge-soft/50">
          <div className="text-sm font-bold uppercase tracking-wider text-ink-muted border-b border-edge-soft/50 pb-2">
            {detail.home.name} - {t("Full Roster")}
          </div>
          <div className="flex flex-col gap-2">
            {detail.homeRoster.map((p) => (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <span className="flex w-6 items-center justify-center text-xs font-bold text-ink-subtle">
                  {p.jersey || "-"}
                </span>
                <span
                  className={`flex-1 ${p.starter ? "font-bold text-ink" : "font-medium text-ink-muted"}`}
                >
                  {p.name}
                </span>
                <span className="w-8 text-end text-[11px] font-semibold uppercase text-brand/80">
                  {p.position}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-4 rounded-2xl bg-elevated/30 p-4 ring-1 ring-edge-soft/50">
          <div className="text-sm font-bold uppercase tracking-wider text-ink-muted border-b border-edge-soft/50 pb-2">
            {detail.away.name} - {t("Full Roster")}
          </div>
          <div className="flex flex-col gap-2">
            {detail.awayRoster.map((p) => (
              <div key={p.id} className="flex items-center gap-3 text-sm">
                <span className="flex w-6 items-center justify-center text-xs font-bold text-ink-subtle">
                  {p.jersey || "-"}
                </span>
                <span
                  className={`flex-1 ${p.starter ? "font-bold text-ink" : "font-medium text-ink-muted"}`}
                >
                  {p.name}
                </span>
                <span className="w-8 text-end text-[11px] font-semibold uppercase text-brand/80">
                  {p.position}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PitchPlayerNode({ player, isHome }: { player: any; isHome: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-elevated text-[12px] font-bold shadow-md ring-2 ring-canvas/80 md:h-10 md:w-10 md:text-[14px]">
        {player.image ? (
          <img src={player.image} className="h-full w-full rounded-full object-cover" alt="" />
        ) : (
          <div
            className={`flex h-full w-full items-center justify-center rounded-full ${isHome ? "bg-brand text-brand-foreground" : "bg-white text-black"}`}
          >
            {player.jersey || "-"}
          </div>
        )}
      </div>
      <span className="max-w-[60px] truncate text-center text-[10px] font-semibold text-white drop-shadow-md md:max-w-[80px] md:text-[11px] bg-black/40 px-1.5 py-0.5 rounded">
        {player.name.split(" ").pop()}
      </span>
    </div>
  );
}

function TeamPitch({
  roster,
  formation,
  teamAbbr,
  isHome,
}: {
  roster: any[];
  formation: string;
  teamAbbr: string;
  isHome: boolean;
}) {
  const starters = roster.filter((p) => p.starter).slice(0, 11);
  const keeper =
    starters.find((p) => p.position && p.position.toUpperCase().includes("G")) || starters[0];
  const field = starters.filter((p) => p.id !== keeper?.id);

  const pitchRows = useMemo(() => {
    if (!formation) {
      // Fallback: Group by position if formation string is missing (e.g. old matches)
      const defs = field.filter((p) => p.position && p.position.toUpperCase().includes("D"));
      const mids = field.filter((p) => p.position && p.position.toUpperCase().includes("M"));
      const fwds = field.filter(
        (p) =>
          p.position &&
          (p.position.toUpperCase().includes("F") ||
            p.position.toUpperCase().includes("A") ||
            p.position.toUpperCase().includes("S")),
      );

      const unknowns = field.filter(
        (p) => !defs.includes(p) && !mids.includes(p) && !fwds.includes(p),
      );
      const finalMids = [...mids, ...unknowns];

      return [[keeper], defs, finalMids, fwds].filter((row) => row.length > 0);
    }

    const counts = formation
      .split("-")
      .map(Number)
      .filter((n) => !isNaN(n));
    if (counts.length === 0) return [[keeper], field];

    const rows: any[][] = [];
    let offset = 0;
    for (const c of counts) {
      rows.push(field.slice(offset, offset + c));
      offset += c;
    }

    return [...rows.reverse(), [keeper]];
  }, [formation, field, keeper]);

  return (
    <div className="relative mx-auto flex w-full max-w-sm flex-col items-center rounded-3xl border border-edge-soft/50 bg-[#2b4c30] p-4 shadow-xl aspect-[3/4]">
      {/* Pitch Lines (Half Pitch Blueprint) */}
      <div className="pointer-events-none absolute inset-4 rounded-xl border-2 border-white/20"></div>
      <div className="pointer-events-none absolute left-1/2 top-4 h-24 w-48 -translate-x-1/2 rounded-b-xl border-2 border-t-0 border-white/20"></div>
      <div className="pointer-events-none absolute left-1/2 bottom-4 h-32 w-64 -translate-x-1/2 rounded-t-xl border-2 border-b-0 border-white/20"></div>
      <div className="pointer-events-none absolute left-1/2 bottom-4 h-12 w-24 -translate-x-1/2 rounded-t-lg border-2 border-b-0 border-white/20"></div>
      <div className="pointer-events-none absolute left-1/2 bottom-[calc(1rem+32px)] h-2 w-2 -translate-x-1/2 rounded-full bg-white/40"></div>

      <div className="absolute left-2 top-2 rounded bg-black/40 px-2 py-1 text-[10px] font-bold uppercase text-white/80">
        {teamAbbr}
      </div>

      <div className="relative z-10 flex w-full flex-1 flex-col justify-between py-4">
        {pitchRows.map((row: any[], i: number) => (
          <div key={i} className="flex w-full justify-around px-2">
            {row.map((p: any) => (
              <PitchPlayerNode key={p.id} player={p} isHome={isHome} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatRow({ label, hVal, aVal }: { label: string; hVal: string; aVal: string }) {
  const t = useT();
  const hNum = parseFloat((hVal || "0").replace(/[^0-9.-]/g, ""));
  const aNum = parseFloat((aVal || "0").replace(/[^0-9.-]/g, ""));

  return (
    <div className="flex items-center justify-between py-2 text-sm font-medium">
      <div
        className={`w-12 text-center tabular-nums sm:w-16 ${hNum > aNum ? "font-bold text-ink" : "text-ink-subtle"}`}
      >
        {hVal || "-"}
      </div>
      <div className="flex-1 px-2 text-center text-xs tracking-wider text-ink-subtle uppercase">
        {t(label)}
      </div>
      <div
        className={`w-12 text-center tabular-nums sm:w-16 ${aNum > hNum ? "font-bold text-ink" : "text-ink-subtle"}`}
      >
        {aVal || "-"}
      </div>
    </div>
  );
}

function MmaProfileTab({ detail }: { detail: SportsMatchDetail }) {
  const t = useT();
  const hP = detail.homeProfile;
  const aP = detail.awayProfile;

  if (!hP || !aP) {
    return (
      <div className="text-center text-sm text-ink-subtle">
        {t("Profile details not available.")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Full Body Images */}
      <div className="flex justify-between items-end bg-elevated/20 rounded-2xl p-4 overflow-hidden relative">
        {/* Background gradient effect for depth */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-ink/5" />

        <div className="flex-1 flex flex-col items-center z-10">
          <div className="h-64 sm:h-80 relative w-full flex justify-center">
            {hP.fullImage && (
              <img
                src={hP.fullImage}
                className="max-h-full object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)]"
                alt={detail.home.name}
              />
            )}
          </div>
          <div className="font-bold text-lg mt-2">{detail.home.name}</div>
        </div>

        <div className="shrink-0 flex items-center justify-center font-black text-ink-muted px-4 z-10 opacity-30 text-2xl">
          VS
        </div>

        <div className="flex-1 flex flex-col items-center z-10">
          <div className="h-64 sm:h-80 relative w-full flex justify-center">
            {aP.fullImage && (
              <img
                src={aP.fullImage}
                className="max-h-full object-contain drop-shadow-[0_10px_10px_rgba(0,0,0,0.3)]"
                alt={detail.away.name}
              />
            )}
          </div>
          <div className="font-bold text-lg mt-2">{detail.away.name}</div>
        </div>
      </div>

      {/* Tale of the Tape */}
      <div className="flex flex-col gap-1 rounded-2xl bg-elevated/20 p-4 ring-1 ring-edge-soft/50 shadow-sm">
        <StatRow label="Height" hVal={hP.height} aVal={aP.height} />
        <StatRow label="Weight" hVal={hP.weight} aVal={aP.weight} />
        <StatRow label="Age" hVal={hP.age} aVal={aP.age} />
        <StatRow label="Reach" hVal={hP.reach} aVal={aP.reach} />
        <StatRow label="Stance" hVal={t(hP.stance)} aVal={t(aP.stance)} />
      </div>
    </div>
  );
}

function StatsTab({ detail }: { detail: SportsMatchDetail }) {
  const t = useT();

  const StatsTabRow = ({ label, hVal, aVal }: { label: string; hVal?: string; aVal?: string }) => {
    if (!hVal && !aVal) return null;

    const hNum = parseFloat((hVal || "0").replace(/[^0-9.-]/g, ""));
    const aNum = parseFloat((aVal || "0").replace(/[^0-9.-]/g, ""));

    const hIsGreater = hNum > aNum;
    const aIsGreater = aNum > hNum;

    return (
      <div className="flex items-center justify-between border-b border-edge-soft/50 py-3 text-sm last:border-0">
        <span className={`w-12 font-bold ${hIsGreater ? "text-green-500" : "text-ink"}`}>
          {hVal || "0"}
        </span>
        <span className="text-ink-subtle">{t(label)}</span>
        <span className={`w-12 text-end font-bold ${aIsGreater ? "text-green-500" : "text-ink"}`}>
          {aVal || "0"}
        </span>
      </div>
    );
  };

  if (!detail.allStats || detail.allStats.length === 0) {
    return (
      <div className="text-center text-sm text-ink-subtle">
        {t("Statistics not available yet.")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-elevated/20 p-4 ring-1 ring-edge-soft/50 shadow-sm">
      {detail.allStats.map((stat, i) => (
        <StatsTabRow key={i} label={stat.label} hVal={stat.homeValue} aVal={stat.awayValue} />
      ))}
    </div>
  );
}
