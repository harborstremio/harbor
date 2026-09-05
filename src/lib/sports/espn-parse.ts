import type { LeagueDef, SportsGame, SportsSide } from "./espn-types";

export function toSide(c: Record<string, unknown> | undefined, group?: string): SportsSide {
  const team = (c?.team ?? {}) as Record<string, unknown>;
  const athlete = (c?.athlete ?? {}) as Record<string, unknown>;
  const isAthlete = c?.type === "athlete";

  let scoreValue = typeof c?.score === "string" ? c.score : String(c?.score ?? "");
  if (!scoreValue && group === "tennis") {
    const sets = (c?.linescores as Record<string, unknown>[] | undefined) ?? [];
    const won = sets.filter((s) => s?.winner === true).length;
    scoreValue = sets.length > 0 ? String(won) : "";
  }
  if (!scoreValue && (group === "motorsport" || group === "golf") && typeof c?.order === "number") {
    const order = c.order as number;
    const suffix = order === 1 ? "st" : order === 2 ? "nd" : order === 3 ? "rd" : "th";
    scoreValue = `${order}${suffix}`;
  }

  if (isAthlete) {
    let logoUrl = typeof athlete.flag === "object" && athlete.flag !== null
      ? ((athlete.flag as Record<string, unknown>).href as string) ?? ""
      : "";

    if (group === "combat" && c?.id) {
      logoUrl = `https://a.espncdn.com/i/headshots/mma/players/full/${c.id}.png`;
    }

    return {
      id: typeof athlete.id === "string" ? athlete.id : String(c?.id ?? ""),
      name: (athlete.displayName as string) ?? (athlete.fullName as string) ?? "",
      abbr: (athlete.shortName as string) ?? "",
      logo: logoUrl,
      score: scoreValue,
      winner: c?.winner === true,
    };
  }
  return {
    id: typeof team.id === "string" ? team.id : String(team.id ?? ""),
    name: (team.displayName as string) ?? (team.name as string) ?? "",
    abbr: (team.abbreviation as string) ?? "",
    logo: typeof team.logo === "string" ? team.logo : "",
    score: scoreValue,
    winner: c?.winner === true,
  };
}

export function parseEvents(events: unknown[], def: LeagueDef): SportsGame[] {
  const out: SportsGame[] = [];
  for (const evRaw of events) {
    const ev = evRaw as Record<string, unknown>;

    if (def.group === "tennis" && /challenger|itf|futures|utr/i.test(String(ev.name ?? ""))) continue;

    const groupings = ev.groupings as
      | { competitions?: unknown[]; grouping?: { displayName?: string } }[]
      | undefined;
    const flatComps: Record<string, unknown>[] = [];
    const drawOf = new Map<Record<string, unknown>, string>();
    if (Array.isArray(groupings)) {
      for (const g of groupings) {
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
      def.group === "combat"
        ? allComps
        : def.group === "tennis"
          ? allComps.filter((c) => {
              const st = ((c.status as Record<string, unknown>)?.type as Record<string, unknown> | undefined)
                ?.state;
              return st === "in" || st === "pre";
            })
          : [];

    if (compsToProcess.length === 0 && def.group !== "tennis") {
      let comp = allComps.find((c) => c.featured === true);
      if (!comp && (def.key === "F1" || def.key === "NASCAR")) {
        const raceComp = allComps.find((c) => {
          const typeAbbr = ((c.type as Record<string, unknown>)?.abbreviation as string)?.toUpperCase();
          return typeAbbr === "RACE" || typeAbbr === "R" || typeAbbr?.includes("MAIN");
        });
        const qualComp = allComps.find((c) => {
          const typeAbbr = ((c.type as Record<string, unknown>)?.abbreviation as string)?.toUpperCase();
          return typeAbbr?.includes("QUAL") || typeAbbr === "Q";
        });
        const sprintComp = allComps.find((c) => {
          const typeAbbr = ((c.type as Record<string, unknown>)?.abbreviation as string)?.toUpperCase();
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
      if (cs.length < 2) continue;

      const isAthleteType = cs.some((x) => x.type === "athlete");
      let home: Record<string, unknown> | undefined;
      let away: Record<string, unknown> | undefined;

      if (isAthleteType) {
        const sorted = [...cs].sort((a, b) =>
          Number((a as Record<string, unknown>).order ?? 99) - Number((b as Record<string, unknown>).order ?? 99)
        );
        home = sorted[0];
        away = sorted[1];
      } else {
        home = cs.find((x) => x.homeAway === "home") ?? cs[0];
        away = cs.find((x) => x.homeAway === "away") ?? cs[1];
      }

      if (!home || !away) continue;
      const t = ((comp.status as Record<string, unknown>)?.type ?? {}) as Record<string, unknown>;
      const rawState = t.state;
      const state = rawState === "in" || rawState === "post" ? rawState : "pre";

      const homeId = String((home as Record<string, unknown>).id ?? "");
      const awayId = String((away as Record<string, unknown>).id ?? "");
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

      const round = ((comp.round as Record<string, unknown> | undefined)?.displayName as string) ?? "";
      out.push({
        id: idStr,
        league: def.tag,
        state,
        detail: (t.shortDetail as string) ?? (t.detail as string) ?? "",
        home: hSide,
        away: aSide,
        startMs: Date.parse(((comp.date as string) || (ev.date as string)) ?? "") || 0,
        context:
          def.group === "tennis"
            ? {
                id: String(ev.id ?? ""),
                name: (ev.shortName as string) || (ev.name as string) || "",
                round,
                draw: drawOf.get(comp) ?? ((comp.type as Record<string, unknown> | undefined)?.text as string) ?? "",
                venue: ((ev.venue as Record<string, unknown> | undefined)?.displayName as string) ?? "",
                major: ev.major === true,
              }
            : undefined,
      });
    }
  }
  return out;
}
