/**
 * The small AllSports fallback for a team page whose ESPN schedule is empty: find the team by name
 * and read its next and previous games. Plain parsers, no I/O. (To be folded into the shared
 * AllSports client when it lands.)
 */

type Rec = Record<string, unknown>;

const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const arr = (v: unknown): Rec[] => (Array.isArray(v) ? (v as Rec[]) : []);
const clean = (v: unknown) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** AllSports sport slug for a Harbor league tag and sport group. Null where it has no equivalent. */
export function asSportFor(leagueTag: string, sportGroup: string): string | null {
  if (leagueTag === "NFL" || leagueTag === "NCAAF") return "american-football";
  if (leagueTag === "NBA" || leagueTag === "NCAA") return "basketball";
  if (leagueTag === "NHL") return "ice-hockey";
  if (leagueTag === "MLB") return "baseball";
  if (sportGroup === "soccer") return "football";
  return null;
}

/** API path prefix for a sport: soccer ("football") is served without one. */
export function asBase(slug: string): string {
  return slug === "football" ? "/api" : `/api/${slug}`;
}

/** "Kansas City Chiefs" → "kansas-city-chiefs", the search path segment. */
export function asSearchSlug(name: string): string {
  return norm(name).replace(/ /g, "-").slice(0, 60);
}

/** The search result that is this team: same name, best score. */
export function pickAsTeam(doc: unknown, name: string): number | null {
  const want = norm(name);
  const hits = arr(rec(doc).results)
    .filter((r) => r.type === "team")
    .map((r) => ({ e: rec(r.entity), score: Number(r.score ?? 0) }))
    .filter((h) => h.e.id != null && norm(clean(h.e.name)) === want)
    .sort((a, b) => b.score - a.score);
  const id = Number(hits[0]?.e.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export type AsTeamGame = {
  id: string;
  state: "pre" | "in" | "post";
  startMs: number;
  home: string;
  away: string;
  homeScore: string | null;
  awayScore: string | null;
  league: string;
};

export function parseAsEvents(doc: unknown): AsTeamGame[] {
  const out: AsTeamGame[] = [];
  for (const e of arr(rec(doc).events)) {
    const id = e.id != null ? String(e.id) : "";
    const home = clean(rec(e.homeTeam).name);
    const away = clean(rec(e.awayTeam).name);
    if (!/^\d{1,12}$/.test(id) || !home || !away) continue;
    const type = rec(e.status).type;
    const score = (s: unknown) => {
      const v = rec(s).current ?? rec(s).display;
      return v == null ? null : String(v);
    };
    out.push({
      id,
      state: type === "inprogress" ? "in" : type === "finished" ? "post" : "pre",
      startMs: Number(e.startTimestamp) * 1000 || 0,
      home,
      away,
      homeScore: score(e.homeScore),
      awayScore: score(e.awayScore),
      league: clean(rec(rec(e.tournament).uniqueTournament).name) || clean(rec(e.tournament).name),
    });
  }
  return out;
}
