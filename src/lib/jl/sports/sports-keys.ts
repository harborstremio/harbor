/**
 * The sports keys each viewer brings (Settings → Sports plugins & keys): what each one
 * unlocks, where to get it, and the one cheap request "Test" makes to check it.
 * No keys live here; every request is built from the key the viewer typed.
 */

export type SportsKeyProvider = "allsports" | "thesportsdb" | "odds" | "cfbd";

export type SportsKeySettingField = "allsportsKey" | "thesportsdbKey" | "oddsApiKey" | "cfbdKey";

export type SportsKeyDef = {
  id: SportsKeyProvider;
  field: SportsKeySettingField;
  name: string;
  unlocks: string;
  signupUrl: string;
  /** Whether the provider has a no-cost plan; decides "Get a free key" vs "Get a key". */
  freePlan: boolean;
  placeholder: string;
};

export const SPORTS_KEYS: SportsKeyDef[] = [
  {
    id: "thesportsdb",
    field: "thesportsdbKey",
    name: "TheSportsDB",
    unlocks:
      "Team fan art behind the Sports hero and the Top 10 game cards. The free key is listed on TheSportsDB's API page; a paid key raises the request limit.",
    signupUrl: "https://www.thesportsdb.com/documentation",
    freePlan: true,
    placeholder: "API key",
  },
  {
    id: "odds",
    field: "oddsApiKey",
    name: "The Odds API",
    unlocks:
      "Moneyline and spread on game cards and the Sports hero. The free plan has 500 requests a month; JL Media Vision asks at most once every 6 hours per league, and only for leagues in your Top 10.",
    signupUrl: "https://the-odds-api.com/#get-access",
    freePlan: true,
    placeholder: "API key",
  },
  {
    id: "cfbd",
    field: "cfbdKey",
    name: "CollegeFootballData",
    unlocks: "College football games, AP rankings and team data for the Colleges pages.",
    signupUrl: "https://collegefootballdata.com/key",
    freePlan: true,
    placeholder: "API key",
  },
  {
    id: "allsports",
    field: "allsportsKey",
    name: "AllSports API",
    unlocks:
      "Live clocks, match stats, top players and TV listings for football, basketball, hockey, baseball and soccer, from api.market.",
    signupUrl: "https://api.market/store/recodex/allsportsapi",
    freePlan: false,
    placeholder: "api.market key",
  },
];

export function sportsKeyDef(id: SportsKeyProvider): SportsKeyDef {
  const def = SPORTS_KEYS.find((d) => d.id === id);
  if (!def) throw new Error(`Unknown sports key provider: ${id}`);
  return def;
}

/** True when the viewer has saved at least one sports key. */
export function hasAnySportsKey(settings: Partial<Record<SportsKeySettingField, string>>): boolean {
  return SPORTS_KEYS.some((d) => (settings[d.field] ?? "").trim().length > 0);
}

export function countSportsKeys(settings: Partial<Record<SportsKeySettingField, string>>): number {
  return SPORTS_KEYS.filter((d) => (settings[d.field] ?? "").trim().length > 0).length;
}

export const ODDS_API_BASE = "https://api.the-odds-api.com/v4";
export const THESPORTSDB_BASE = "https://www.thesportsdb.com/api/v1/json";
export const CFBD_BASE = "https://api.collegefootballdata.com";
export const ALLSPORTS_BASE = "https://prod.api.market/api/v1/recodex/allsportsapi";

/** TheSportsDB puts the key in the URL path, so only plain keys are accepted. */
export function isPathSafeKey(key: string): boolean {
  return /^[A-Za-z0-9_-]{1,80}$/.test(key);
}

export type KeyTestRequest = { url: string; headers: Record<string, string> };

/**
 * The cheapest request that proves a key works. The Odds API's sports list costs no
 * quota; the others read one small list.
 */
export function keyTestRequest(provider: SportsKeyProvider, rawKey: string): KeyTestRequest | null {
  const key = rawKey.trim();
  if (!key) return null;
  switch (provider) {
    case "thesportsdb":
      if (!isPathSafeKey(key)) return null;
      return { url: `${THESPORTSDB_BASE}/${key}/all_sports.php`, headers: {} };
    case "odds":
      return { url: `${ODDS_API_BASE}/sports/?apiKey=${encodeURIComponent(key)}`, headers: {} };
    case "cfbd":
      return { url: `${CFBD_BASE}/conferences`, headers: { Authorization: `Bearer ${key}` } };
    case "allsports":
      return {
        url: `${ALLSPORTS_BASE}/api/american-football/matches/live`,
        headers: { "x-api-market-key": key },
      };
  }
}

export type KeyTestResult = { ok: boolean; message: string };

/** Turns the test response into a plain-language verdict. `body` is parsed JSON or null. */
export function interpretKeyTest(
  provider: SportsKeyProvider,
  status: number,
  body: unknown,
  headers: { get(name: string): string | null } | null = null,
): KeyTestResult {
  const name = sportsKeyDef(provider).name;
  if (status === 0) {
    return { ok: false, message: `Couldn't reach ${name}. Check your internet connection and try again.` };
  }
  if (status === 401 || status === 403) {
    return { ok: false, message: `${name} didn't accept this key. Check for a typo or a missing character.` };
  }
  if (status === 429) {
    return {
      ok: false,
      message: `The key works, but its request limit is used up for now. Try again later.`,
    };
  }
  if (status >= 500) {
    return { ok: false, message: `${name} is having trouble right now (error ${status}). Try again later.` };
  }
  switch (provider) {
    case "thesportsdb": {
      const sports = (body as { sports?: unknown } | null)?.sports;
      if (status === 200 && Array.isArray(sports)) return { ok: true, message: "Key works." };
      return { ok: false, message: `${name} didn't accept this key.` };
    }
    case "odds": {
      if (status === 200 && Array.isArray(body)) {
        const left = headers?.get("x-requests-remaining");
        const n = left != null && left !== "" ? Number(left) : NaN;
        return {
          ok: true,
          message: Number.isFinite(n) ? `Key works. ${Math.floor(n)} requests left this month.` : "Key works.",
        };
      }
      return { ok: false, message: `${name} didn't accept this key.` };
    }
    case "cfbd": {
      if (status === 200 && Array.isArray(body)) return { ok: true, message: "Key works." };
      return { ok: false, message: `${name} didn't accept this key.` };
    }
    case "allsports": {
      // 204 = the key works and nothing is live right now.
      if (status === 200 || status === 204) return { ok: true, message: "Key works." };
      if (status === 404) {
        return { ok: false, message: "The key was accepted, but your plan doesn't include AllSports API." };
      }
      return { ok: false, message: `${name} answered with error ${status}.` };
    }
  }
}

type FetchLike = (
  url: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<{ status: number; headers: { get(name: string): string | null }; text(): Promise<string> }>;

/** Runs the test request with the given fetch (safeFetch in the app). */
export async function testSportsKey(
  provider: SportsKeyProvider,
  key: string,
  fetchImpl: FetchLike,
  signal?: AbortSignal,
): Promise<KeyTestResult> {
  if (!key.trim()) return { ok: false, message: "Enter a key first." };
  const req = keyTestRequest(provider, key);
  if (!req) return { ok: false, message: "This key has characters TheSportsDB keys never have. Check it and try again." };
  let status = 0;
  let body: unknown = null;
  let headers: { get(name: string): string | null } | null = null;
  try {
    const res = await fetchImpl(req.url, { headers: req.headers, signal });
    status = res.status;
    headers = res.headers;
    const text = await res.text().catch(() => "");
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = null;
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    status = 0;
  }
  return interpretKeyTest(provider, status, body, headers);
}
