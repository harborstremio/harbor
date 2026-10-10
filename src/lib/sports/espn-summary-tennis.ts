import { safeFetch } from "@/lib/safe-fetch";
import type { LeagueDef, MatchTeamStatRow, SportsMatchDetail } from "./espn-types";
import { toSide } from "./espn-parse";
import { SITE_BASE } from "./espn-leagues";
import { localStamp } from "./espn-scoreboard";

const WINDOW_DAYS = 21;

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

export async function fetchTennisSummary(
  def: LeagueDef,
  eventId: string,
  startMs?: number,
): Promise<SportsMatchDetail | null> {
  const [evId, cId] = eventId.split("|");
  const now = startMs || Date.now();
  const span = WINDOW_DAYS * 86400000;
  const wide = `${localStamp(new Date(now - span))}-${localStamp(new Date(now + span))}`;
  let event: any = null;
  let comp: any = null;
  let drawName = "";
  for (const q of [`?dates=${localStamp(new Date(now))}`, `?dates=${wide}`]) {
    const sres = await safeFetch(`${SITE_BASE}/${def.path}/scoreboard${q}`, {
      signal: AbortSignal.timeout(10000),
    });
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
    home: toSide(homeRaw, "tennis"),
    away: toSide(awayRaw, "tennis"),
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
