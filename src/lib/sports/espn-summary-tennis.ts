import { safeFetch } from "@/lib/safe-fetch";
import type { LeagueDef, MatchTeamStatRow, SportsMatchDetail, SportsSide } from "./espn-types";
import { SITE_BASE } from "./espn-leagues";
import { localStamp } from "./espn-scoreboard";

const WINDOW_DAYS = 21;

function side(c: any): SportsSide {
  return {
    id: String(c.athlete?.id ?? c.athlete?.guid ?? c.id ?? ""),
    name: c.athlete?.displayName || "",
    abbr: c.athlete?.shortName || "",
    logo: c.athlete?.flag?.href || "",
    score: typeof c.score === "string" ? c.score : String(c.score ?? ""),
    winner: c.winner === true,
  };
}

function setRows(homeRaw: any, awayRaw: any): MatchTeamStatRow[] {
  const allStats: MatchTeamStatRow[] = [];
  const hl: any[] = homeRaw.linescores || [];
  const al: any[] = awayRaw.linescores || [];
  const setCount = Math.max(hl.length, al.length);
  for (let i = 0; i < setCount; i++) {
    const hv = hl[i]?.value ?? hl[i]?.displayValue;
    const av = al[i]?.value ?? al[i]?.displayValue;
    allStats.push({
      label: `Set ${i + 1}`,
      homeValue: hv != null ? String(hv) : "-",
      awayValue: av != null ? String(av) : "-",
    });
  }
  return allStats;
}

export async function fetchTennisSummary(def: LeagueDef, eventId: string): Promise<SportsMatchDetail | null> {
  const [evId, cId] = eventId.split("|");
  const now = Date.now();
  const span = WINDOW_DAYS * 86400000;
  const wide = `${localStamp(new Date(now - span))}-${localStamp(new Date(now + span))}`;
  let event: any = null;
  let comp: any = null;
  let drawName = "";
  for (const q of ["", `?dates=${wide}`]) {
    const sres = await safeFetch(`${SITE_BASE}/${def.path}/scoreboard${q}`);
    if (!sres.ok) continue;
    const sdata = await sres.json();
    event = (sdata.events || []).find((e: any) => String(e.id) === evId) ?? null;
    for (const g of event?.groupings || []) {
      const found = (g.competitions || []).find((c: any) => String(c.id) === cId);
      if (found) {
        comp = found;
        drawName = g.grouping?.displayName || "";
        break;
      }
    }
    if (comp) break;
  }
  if (!comp) return null;
  const cs: any[] = comp.competitors || [];
  const sorted = [...cs].sort((a, b) => (a.order || 99) - (b.order || 99));
  const homeRaw = sorted[0];
  const awayRaw = sorted[1];
  if (!homeRaw || !awayRaw) return null;
  const tp = comp.status?.type || {};
  const round = comp.round?.displayName || comp.type?.text || "";
  const tourName = event?.shortName || event?.name || "";
  return {
    id: eventId,
    league: def.tag,
    state: tp.state === "in" || tp.state === "post" ? tp.state : "pre",
    detail: [tourName, round, tp.shortDetail || tp.detail].filter(Boolean).join(" · "),
    startMs: Date.parse(comp.date || event?.date || "") || 0,
    home: side(homeRaw),
    away: side(awayRaw),
    homeRoster: [],
    awayRoster: [],
    homeStats: {},
    awayStats: {},
    allStats: setRows(homeRaw, awayRaw),
    events: [],
    context: {
      id: String(event?.id ?? ""),
      name: tourName,
      round,
      draw: drawName || comp.type?.text || "",
      venue: event?.venue?.displayName || "",
      major: event?.major === true,
      court: typeof comp.court === "string" ? comp.court : comp.court?.displayName || "",
      bestOf: Number(comp.format?.regulation?.periods) || undefined,
    },
  };
}
