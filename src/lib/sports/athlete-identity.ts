export type AthleteSource = "espn" | "thesportsdb" | "api-sports";
export type AthleteIdentityRequest = {
  id: string;
  name: string;
  source?: AthleteSource;
  image?: string;
  logo?: string;
};
export type AthleteBio = {
  name: string;
  image: string;
  bio: string[];
  team?: { name: string; logo: string };
  recordUrl?: string;
};
type Json = Record<string, unknown>;
const object = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
const text = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 400) : "");
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const normal = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

/** Some scoreboards omit athlete.id but publish the explicit a: identity in the competitor UID. */
export function espnPublishedAthleteId(raw: unknown): string {
  const entry = object(raw),
    athlete = object(entry.athlete);
  const direct = String(athlete.id ?? "");
  if (/^\d{1,20}$/.test(direct)) return direct;
  const id = /(?:^|~)a:(\d{1,20})(?:~|$)/.exec(text(entry.uid))?.[1];
  return entry.type === "athlete" && id && (!entry.id || String(entry.id) === id) ? id : "";
}

export function athleteImageUrl(value: unknown): string {
  try {
    const url = new URL(text(value));
    return url.protocol === "https:" && !url.username && !url.password && !url.port
      ? url.href
      : "";
  } catch {
    return "";
  }
}

/** Keep provider-published player links, including cricket's distinct ESPN Cricinfo host. */
export function espnAthleteRecordUrl(raw: unknown, id: string): string {
  return (
    list(raw)
      .map(object)
      .sort(
        (a, b) => Number(list(b.rel).includes("stats")) - Number(list(a.rel).includes("stats")),
      )
      .map((link) => text(link.href))
      .find((value) => {
        try {
          const url = new URL(value);
          return (
            url.protocol === "https:" &&
            !url.username &&
            !url.password &&
            !url.port &&
            /(^|\.)(espn\.com|espncricinfo\.com|cricinfo\.com)$/.test(url.hostname) &&
            (url.pathname.split("/id/")[1]?.split("/")[0] === id ||
              url.pathname.endsWith(`/player/${id}.html`))
          );
        } catch {
          return false;
        }
      }) || ""
  );
}

export function parseEspnAthleteBio(raw: unknown, id: string): AthleteBio | null {
  const person = object(object(raw).athlete);
  if (String(person.id ?? "") !== id || !text(person.displayName)) return null;
  const team = object(person.team),
    position = object(person.position);
  const style = [...list(person.batStyle), ...list(person.bowlStyle)].map((value) =>
    text(object(value).description),
  );
  const teamName = text(team.displayName);
  return {
    name: text(person.displayName),
    image: athleteImageUrl(object(person.headshot).href),
    bio: [
      text(position.displayName || position.name),
      ...[
        person.displayDOB,
        person.displayBirthPlace,
        person.displayHeight,
        person.displayWeight,
        person.displayDraft,
        person.displayExperience,
      ].map(text),
      ...style,
    ].filter(Boolean),
    team: teamName
      ? {
          name: teamName,
          logo: athleteImageUrl(team.logo || object(list(team.logos)[0]).href),
        }
      : undefined,
    recordUrl: espnAthleteRecordUrl(person.links, id) || undefined,
  };
}

const SPORTS: Record<string, string[]> = {
  soccer: ["soccer", "football"],
  basketball: ["basketball"],
  football: ["americanfootball"],
  baseball: ["baseball"],
  hockey: ["icehockey"],
  combat: ["fighting", "mma"],
  boxing: ["boxing"],
  motorsport: ["motorsport"],
  tennis: ["tennis"],
  golf: ["golf"],
  rugby: ["rugby", "rugbyleague", "rugbyunion"],
  cricket: ["cricket"],
  aussie: ["australianfootball", "australianrulesfootball", "aussierules"],
  lacrosse: ["lacrosse"],
  volleyball: ["volleyball"],
  handball: ["handball"],
  badminton: ["badminton"],
  tabletennis: ["tabletennis"],
  cycling: ["cycling"],
  snooker: ["snooker"],
  darts: ["darts"],
  athletics: ["athletics"],
  swimming: ["swimming"],
  winter: ["skiing", "snowboarding", "wintersports"],
  netball: ["netball"],
  fieldhockey: ["fieldhockey"],
  esports: ["esports"],
  waterpolo: ["waterpolo"],
  softball: ["softball"],
};

/** Only an explicit database ID may enter this parser. ESPN IDs are never reused here. */
export function parseSportsDbAthleteBio(
  raw: unknown,
  id: string,
  group: string,
): AthleteBio | null {
  if (!/^\d{1,15}$/.test(id)) return null;
  const matches = list(object(raw).players)
    .map(object)
    .filter(
      (person) =>
        String(person.idPlayer ?? "") === id &&
        SPORTS[group]?.includes(normal(text(person.strSport))),
    );
  if (matches.length !== 1 || !text(matches[0].strPlayer)) return null;
  const person = matches[0],
    teamName = text(person.strTeam);
  return {
    name: text(person.strPlayer),
    image: athleteImageUrl(person.strCutout) || athleteImageUrl(person.strThumb),
    bio: [
      person.strPosition,
      person.strNationality,
      person.dateBorn,
      person.strBirthLocation,
      person.strHeight,
      person.strWeight,
    ]
      .map(text)
      .filter(Boolean),
    team: teamName ? { name: teamName, logo: "" } : undefined,
    recordUrl: `https://www.thesportsdb.com/player/${id}`,
  };
}

export async function fetchSportsDbAthleteBio(
  id: string,
  group: string,
  signal: AbortSignal,
): Promise<AthleteBio | null> {
  if (!/^\d{1,15}$/.test(id) || !SPORTS[group]) return null;
  signal.throwIfAborted();
  const { safeFetch } = await import("../safe-fetch");
  const response = await safeFetch(
    `https://www.thesportsdb.com/api/v1/json/123/lookupplayer.php?id=${id}`,
    {
      signal: AbortSignal.any([signal, AbortSignal.timeout(9000)]),
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Athlete profile unavailable");
  return parseSportsDbAthleteBio(await response.json(), id, group);
}
