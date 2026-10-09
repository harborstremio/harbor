import type { LeagueDef, SportsGame, SportsSide } from "./espn-types";
import { espnPublishedAthleteId } from "./athlete-identity";
import { publishedPortraitUrl } from "./athlete-portraits.ts";
import { publishedScore, publishedScoreDetail } from "./score-detail";
import { publishedSideContext } from "./card-context.ts";

/** 21st, not 21th: only 11, 12 and 13 take th among the teens. */
function ordinal(value: number): string {
  const teen = value % 100;
  if (teen >= 11 && teen <= 13) return `${value}th`;
  const last = value % 10;
  const suffix = last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th";
  return `${value}${suffix}`;
}

export function toSide(c: Record<string, unknown> | undefined, group?: string): SportsSide {
  const team = (c?.team ?? {}) as Record<string, unknown>;
  const athlete = (c?.athlete ?? {}) as Record<string, unknown>;
  const roster = (c?.roster ?? {}) as Record<string, unknown>;
  const isAthlete = c?.type === "athlete";

  let scoreValue = publishedScore(c?.score);
  if (!scoreValue && group === "tennis") {
    const sets = (c?.linescores as Record<string, unknown>[] | undefined) ?? [];
    const won = sets.filter((s) => s?.winner === true).length;
    scoreValue = sets.length > 0 ? String(won) : "";
  }
  if (!scoreValue && FIELD_GROUPS.has(group ?? "") && typeof c?.order === "number") {
    scoreValue = ordinal(c.order as number);
  }

  if (isAthlete) {
    const headshot =
      typeof athlete.headshot === "object" && athlete.headshot !== null
        ? (athlete.headshot as Record<string, unknown>).href
        : athlete.headshot;
    let logoUrl =
      publishedPortraitUrl(headshot) ||
      (typeof athlete.flag === "object" && athlete.flag !== null
        ? (((athlete.flag as Record<string, unknown>).href as string) ?? "")
        : "");

    if (!publishedPortraitUrl(logoUrl) && group === "combat" && c?.id) {
      logoUrl = `https://a.espncdn.com/i/headshots/mma/players/full/${c.id}.png`;
    }

    return {
      ...publishedSideContext(c),
      ...publishedScoreDetail(c, group),
      id: typeof athlete.id === "string" ? athlete.id : String(c?.id ?? ""),
      name: (athlete.displayName as string) ?? (athlete.fullName as string) ?? "",
      abbr: (athlete.shortName as string) ?? "",
      logo: logoUrl,
      score: scoreValue,
      winner: c?.winner === true,
      athleteId: espnPublishedAthleteId(c),
      athleteSource: "espn",
      athleteImage: publishedPortraitUrl(headshot) || undefined,
    };
  }
  // A doubles pair arrives as type:"team" with NO team object, carrying a roster instead. Without
  // this branch the side comes back unnamed and the blank-name guard below discards a real match.
  const pairName = typeof roster.displayName === "string" ? roster.displayName.trim() : "";
  if (pairName) {
    const squad = Array.isArray(roster.athletes) ? (roster.athletes as Record<string, unknown>[]) : [];
    const members = squad
      .map((entry) => {
        const person = ((entry?.athlete ?? entry) ?? {}) as Record<string, unknown>;
        const flag = person.flag;
        return {
          id: String(person.id ?? ""),
          name:
            ((person.displayName as string) ?? (person.fullName as string) ?? "").trim(),
          flag:
            typeof flag === "object" && flag !== null
              ? (((flag as Record<string, unknown>).href as string) ?? "")
              : "",
        };
      })
      .filter((member) => member.name);
    return {
      ...publishedSideContext(c),
      ...publishedScoreDetail(c, group),
      id: String(c?.id ?? ""),
      name: pairName,
      abbr: typeof roster.shortDisplayName === "string" ? roster.shortDisplayName : "",
      logo: members[0]?.flag ?? "",
      score: scoreValue,
      winner: c?.winner === true,
      ...(members.length > 0 ? { members } : {}),
    };
  }
  return {
    ...publishedSideContext(c),
    ...publishedScoreDetail(c, group),
    id: typeof team.id === "string" ? team.id : String(team.id ?? ""),
    name: (team.displayName as string) ?? (team.name as string) ?? "",
    abbr: (team.abbreviation as string) ?? "",
    logo: typeof team.logo === "string" ? team.logo : "",
    score: scoreValue,
    winner: c?.winner === true,
  };
}

/** Races and leaderboards place a whole field; a pair of them is not the result. */
const FIELD_GROUPS = new Set(["motorsport", "golf", "cycling", "swimming", "athletics"]);

export function parseEvents(events: unknown[], def: LeagueDef): SportsGame[] {
  const out: SportsGame[] = [];
  for (const evRaw of events) {
    if (!evRaw || typeof evRaw !== "object") continue;
    const ev = evRaw as Record<string, unknown>;

    if (def.group === "tennis" && /challenger|itf|futures|utr/i.test(String(ev.name ?? "")))
      continue;

    const groupings = ev.groupings as
      | { competitions?: unknown[]; grouping?: { displayName?: string } }[]
      | undefined;
    const flatComps: Record<string, unknown>[] = [];
    const drawOf = new Map<Record<string, unknown>, string>();
    if (Array.isArray(groupings)) {
      for (const g of groupings) {
        const draw = g.grouping?.displayName ?? "";
        // Major tournaments publish both tours in each scoreboard response.
        if (
          def.group === "tennis" &&
          ((def.path === "tennis/atp" && /^women['’]?s/i.test(draw)) ||
            (def.path === "tennis/wta" && /^men['’]?s/i.test(draw)))
        )
          continue;
        if (Array.isArray(g.competitions)) {
          for (const c of g.competitions) {
            const comp = c as Record<string, unknown>;
            flatComps.push(comp);
            drawOf.set(comp, g.grouping?.displayName ?? "");
          }
        }
      }
    }

    const directComps = (ev.competitions as Record<string, unknown>[] | undefined) ?? [];
    const allComps = flatComps.length > 0 ? flatComps : directComps;
    if (allComps.length === 0) continue;

    const compsToProcess: Record<string, unknown>[] =
      def.group === "combat" ? allComps : def.group === "tennis" ? allComps : [];

    if (compsToProcess.length === 0 && def.group !== "tennis") {
      let comp = allComps.find((c) => c.featured === true);
      if (!comp && (def.key === "F1" || def.key === "NASCAR")) {
        const raceComp = allComps.find((c) => {
          const typeAbbr = (
            (c.type as Record<string, unknown>)?.abbreviation as string
          )?.toUpperCase();
          return typeAbbr === "RACE" || typeAbbr === "R" || typeAbbr?.includes("MAIN");
        });
        const qualComp = allComps.find((c) => {
          const typeAbbr = (
            (c.type as Record<string, unknown>)?.abbreviation as string
          )?.toUpperCase();
          return typeAbbr?.includes("QUAL") || typeAbbr === "Q";
        });
        const sprintComp = allComps.find((c) => {
          const typeAbbr = (
            (c.type as Record<string, unknown>)?.abbreviation as string
          )?.toUpperCase();
          return typeAbbr?.includes("SPRINT") || typeAbbr === "S";
        });
        comp = raceComp || qualComp || sprintComp || allComps[allComps.length - 1];
      } else {
        comp = comp ?? allComps[0];
      }
      if (comp) compsToProcess.push(comp);
    }

    for (const comp of compsToProcess) {
      const cs = (comp.competitors as Record<string, unknown>[] | undefined) ?? [];
      if (cs.length < 2 && !FIELD_GROUPS.has(def.group)) continue;

      const isAthleteType = cs.some((x) => x.type === "athlete");
      let home: Record<string, unknown> | undefined;
      let away: Record<string, unknown> | undefined;

      if (isAthleteType) {
        const sorted = [...cs].sort(
          (a, b) =>
            Number((a as Record<string, unknown>).order ?? 99) -
            Number((b as Record<string, unknown>).order ?? 99),
        );
        home = sorted[0];
        away = sorted[1];
      } else {
        home = cs.find((x) => x.homeAway === "home") ?? cs[0];
        away = cs.find((x) => x.homeAway === "away") ?? cs[1];
      }

      if ((!home || !away) && !FIELD_GROUPS.has(def.group)) continue;
      const t = ((comp.status as Record<string, unknown>)?.type ?? {}) as Record<string, unknown>;
      const rawState = t.state;
      const state = rawState === "in" || rawState === "post" ? rawState : "pre";

      const homeId = String(home?.id ?? "");
      const awayId = String(away?.id ?? "");
      if (homeId.startsWith("-") && awayId.startsWith("-")) continue;

      const hSide = toSide(home, def.group);
      const aSide = toSide(away, def.group);
      if (def.group === "tennis") {
        const bad = (n: string) => !n.trim() || /^tbd$/i.test(n.trim());
        if (bad(hSide.name) || bad(aSide.name)) continue;
      }

      const idStr =
        def.group === "combat" || def.group === "tennis"
          ? `${ev.id}|${comp.id}`
          : String(ev.id ?? `${def.key}-${out.length}`);

      const round =
        ((comp.round as Record<string, unknown> | undefined)?.displayName as string) ?? "";
      const venue =
        ((comp.venue as Record<string, unknown> | undefined)?.fullName as string) ||
        ((ev.venue as Record<string, unknown> | undefined)?.displayName as string) ||
        "";
      const contextual = ["tennis", "combat"].includes(def.group) || FIELD_GROUPS.has(def.group);
      const field =
        FIELD_GROUPS.has(def.group) && cs.length > 2
          ? [...cs]
              .sort((a, b) => Number(a.order ?? 999) - Number(b.order ?? 999))
              .map((entry) => toSide(entry, def.group))
              .filter((side) => side.name.trim().length > 0)
          : undefined;
      out.push({
        id: idStr,
        league: def.tag,
        state,
        detail: (t.shortDetail as string) ?? (t.detail as string) ?? "",
        home: hSide,
        away: aSide,
        field,
        broadcasts: Array.isArray(comp.broadcasts)
          ? comp.broadcasts.flatMap((b: { names?: string[] }) => b.names ?? [])
          : [],
        startMs: Date.parse(((comp.date as string) || (ev.date as string)) ?? "") || 0,
        context:
          contextual || !!venue || !!round
            ? {
                id: String(ev.id ?? ""),
                name: contextual ? (ev.name as string) || (ev.shortName as string) || "" : "",
                round,
                draw:
                  drawOf.get(comp) ??
                  ((comp.type as Record<string, unknown> | undefined)?.text as string) ??
                  "",
                venue,
                major: ev.major === true,
              }
            : undefined,
      });
    }
  }
  return out;
}
