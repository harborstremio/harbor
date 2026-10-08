/**
 * College Sports directory: every NCAA member school (public reference data: name, division,
 * conference, state, athletics site). Plain data and pure helpers, no I/O.
 */

export type CollegeDivision = "I" | "II" | "III";

export type College = {
  /** "ncaa:<orgId>". */
  id: string;
  name: string;
  division: CollegeDivision | null;
  /** Division I football level. */
  subdivision: "FBS" | "FCS" | null;
  conference: string | null;
  state: string | null;
  /** Athletics site host, e.g. "gallaudetbison.com". */
  site: string | null;
  hbcu: boolean;
};

export const DIVISIONS: readonly CollegeDivision[] = ["I", "II", "III"];

/** The NCAA's public member directory (the same list the NCAA site shows). */
export const NCAA_DIRECTORY_URL =
  "https://web3.ncaa.org/directory/api/directory/memberList?type=12";

const HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

/** "https://www.GallaudetBison.com/sports/football" → "gallaudetbison.com"; null if it isn't a host. */
export function normalizeSite(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const raw = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0];
  return HOST.test(raw) && raw.length <= 100 ? raw : null;
}

const clean = (v: unknown, max: number): string | null => {
  const s = String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return s ? s.slice(0, max) : null;
};

/** One NCAA directory entry → College, or null when it isn't an active, named member. */
export function mapNcaaSchool(raw: unknown): College | null {
  const x = raw as Record<string, unknown> | null;
  if (!x || typeof x !== "object") return null;
  if (x.deactive !== undefined && x.deactive !== "N") return null;
  const orgId = Number(x.orgId);
  const name = clean(x.nameOfficial, 160);
  if (!Number.isFinite(orgId) || orgId <= 0 || !name) return null;
  const division =
    ({ 1: "I", 2: "II", 3: "III" } as const)[Number(x.division) as 1 | 2 | 3] ?? null;
  const sub = ({ 1: "FBS", 2: "FCS" } as const)[Number(x.subdivision) as 1 | 2] ?? null;
  const address = x.memberOrgAddress as Record<string, unknown> | null | undefined;
  const state =
    typeof address?.state === "string" && /^[A-Z]{2}$/.test(address.state) ? address.state : null;
  return {
    id: `ncaa:${orgId}`,
    name,
    division,
    subdivision: division === "I" ? sub : null,
    conference: clean(x.conferenceName, 120),
    state,
    site: normalizeSite(x.athleticWebUrl),
    hbcu: x.historicallyBlackFlag === "Y",
  };
}

/** The NCAA directory response → schools sorted by name (empty when it isn't a list). */
export function parseNcaaDirectory(json: unknown): College[] {
  if (!Array.isArray(json)) return [];
  const seen = new Set<string>();
  const out: College[] = [];
  for (const raw of json) {
    const c = mapNcaaSchool(raw);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    out.push(c);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Validates a stored or bundled list (snapshot, local cache). */
export function isCollege(v: unknown): v is College {
  const r = v as Record<string, unknown> | null;
  const opt = (x: unknown) => x === null || typeof x === "string";
  return (
    !!r &&
    typeof r.id === "string" &&
    typeof r.name === "string" &&
    (r.division === null || r.division === "I" || r.division === "II" || r.division === "III") &&
    (r.subdivision === null || r.subdivision === "FBS" || r.subdivision === "FCS") &&
    opt(r.conference) &&
    opt(r.state) &&
    opt(r.site) &&
    typeof r.hbcu === "boolean"
  );
}

export const divisionLabel = (d: CollegeDivision | null): string =>
  d ? `Division ${d}` : "College";

export type CollegeFilter = {
  q?: string;
  division?: CollegeDivision | null;
  subdivision?: "FBS" | "FCS" | null;
  conference?: string | null;
  state?: string | null;
};

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Schools matching every set filter; a name search matches any word order ("state ohio"). */
export function filterColleges(list: readonly College[], f: CollegeFilter): College[] {
  const words = fold(f.q ?? "")
    .split(" ")
    .filter(Boolean);
  return list.filter((c) => {
    if (f.division && c.division !== f.division) return false;
    if (f.subdivision && c.subdivision !== f.subdivision) return false;
    if (f.conference && c.conference !== f.conference) return false;
    if (f.state && c.state !== f.state) return false;
    if (!words.length) return true;
    const hay = fold(`${c.name} ${c.conference ?? ""} ${c.site ?? ""}`);
    return words.every((w) => hay.includes(w));
  });
}

/** Conferences (with school counts) among the schools of a division, by name. */
export function conferencesFor(
  list: readonly College[],
  division: CollegeDivision | null,
): { name: string; schools: number }[] {
  const counts = new Map<string, number>();
  for (const c of list) {
    if (!c.conference || (division && c.division !== division)) continue;
    counts.set(c.conference, (counts.get(c.conference) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, schools]) => ({ name, schools }));
}

/** "Gallaudet University" → "GU"; "University of North Carolina at Pembroke" → "UNCP". */
export function monogram(name: string): string {
  const words = name
    .replace(/[^A-Za-z&' -]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !/^(of|the|at|and|&|in|for)$/i.test(w));
  if (!words.length) return "";
  return (
    words.length === 1
      ? words[0].slice(0, 3)
      : words
          .slice(0, 4)
          .map((w) => w[0])
          .join("")
  ).toUpperCase();
}

/** A steady hue per school for its poster (the directory carries no colours). */
export function collegeHue(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}
