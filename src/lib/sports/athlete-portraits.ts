import { commonsAthletePortrait } from "./athlete-commons-portraits";

/** Published portraits only: ESPN identifiers are not interchangeable with tour or CDN identifiers. */
export type AthletePortraitRequest = {
  path: string;
  /** Catalog sport identity for providers whose paths are numeric or not ESPN routes. */
  group?: string;
  id: string;
  name: string;
  image?: string;
};
export type AthletePortrait = {
  url: string;
  source: "ESPN" | "TheSportsDB" | "Wikipedia" | "Wikimedia Commons";
  sourceUrl: string;
};
function validAttribution(source: unknown, value: unknown): boolean {
  try {
    if (typeof value !== "string") return false;
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
    if (source === "TheSportsDB")
      return url.hostname === "www.thesportsdb.com" && /^\/player\/\d+$/.test(url.pathname);
    if (source === "Wikipedia")
      return url.hostname === "en.wikipedia.org" && url.pathname.startsWith("/wiki/");
    if (source === "Wikimedia Commons")
      return (
        url.hostname === "commons.wikimedia.org" && /^\/wiki\/File(?::|%3A)/i.test(url.pathname)
      );
    return (
      source === "ESPN" && ["www.espn.com", "site.web.api.espn.com"].includes(url.hostname)
    );
  } catch {
    return false;
  }
}
type Json = Record<string, unknown>;
const record = (value: unknown): Json =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
const text = (value: unknown) => (typeof value === "string" ? value : "");
const normal = (value: unknown) =>
  text(value)
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
const SPORT_NAMES: Record<string, string> = {
  tennis: "Tennis",
  golf: "Golf",
  racing: "Motorsport",
  mma: "Fighting",
  boxing: "Boxing",
  soccer: "Soccer",
  basketball: "Basketball",
  baseball: "Baseball",
  football: "American Football",
  hockey: "Ice Hockey",
  rugby: "Rugby",
  cricket: "Cricket",
  combat: "Fighting",
  motorsport: "Motorsport",
  volleyball: "Volleyball",
  handball: "Handball",
  badminton: "Badminton",
  tabletennis: "Table Tennis",
  snooker: "Snooker",
  darts: "Darts",
  cycling: "Cycling",
  athletics: "Athletics",
  swimming: "Swimming",
  softball: "Softball",
  aussie: "Australian Football",
  lacrosse: "Lacrosse",
  fieldhockey: "Field Hockey",
  netball: "Netball",
  waterpolo: "Water Polo",
  esports: "Esports",
};
const espnPath = (path: string) => /^[a-z]+\/[a-z0-9.-]{1,50}$/.test(path);
const portraitSport = (request: AthletePortraitRequest) => {
  if (request.group === "winter") {
    if (request.path === "5342") return "Biathlon";
    if (["5625", "5722", "5724"].includes(request.path)) return "Skiing";
    return "Winter Sports";
  }
  return SPORT_NAMES[request.group ?? request.path.split("/")[0]];
};
const validRequest = (request: AthletePortraitRequest) =>
  (espnPath(request.path) || /^(?:\d{1,8}|[a-z][a-z0-9-]{0,50})$/.test(request.path)) &&
  !!portraitSport(request) &&
  request.name.trim().length > 1 &&
  request.name.length <= 160;

/** Country flags and team logos must stay available as fallbacks, never become athlete photos. */
export function publishedPortraitUrl(value: unknown): string {
  try {
    const url = new URL(text(value));
    if (url.protocol !== "https:" || url.username || url.password || url.port) return "";
    if (
      url.hostname === "a.espncdn.com" &&
      /^\/i\/headshots\/[a-z0-9-]+\/players\/(?:full|[a-z0-9-]+)\/[^/]+\.(?:png|jpe?g|webp)$/i.test(
        url.pathname,
      )
    )
      return url.href;
    if (
      ["r2.thesportsdb.com", "www.thesportsdb.com"].includes(url.hostname) &&
      /^\/images\/media\/player\/(?:thumb|cutout)\/[^/]+\.(?:png|jpe?g|webp)$/i.test(
        url.pathname,
      )
    )
      return url.href;
    if (
      ["thumb.wikimedia.org", "upload.wikimedia.org"].includes(url.hostname) &&
      /^\/wikipedia\/(?:commons|en)\//.test(url.pathname) &&
      /\.(?:png|jpe?g|webp)$/i.test(url.pathname)
    )
      return url.href;
  } catch {
    /* Missing artwork is normal for smaller competitions. */
  }
  return "";
}

export function espnAthletePortrait(
  data: unknown,
  request: AthletePortraitRequest,
): AthletePortrait | null {
  const root = record(data),
    person = record(root.athlete ?? data);
  if (
    String(person.id ?? "") !== request.id ||
    normal(person.displayName ?? person.fullName) !== normal(request.name)
  )
    return null;
  const url = publishedPortraitUrl(record(person.headshot).href);
  if (!url) return null;
  const links = Array.isArray(person.links) ? person.links : [];
  const sourceUrl =
    links
      .map((link) => text(record(link).href))
      .find((link) => {
        try {
          const parsed = new URL(link);
          return (
            parsed.protocol === "https:" &&
            parsed.hostname === "www.espn.com" &&
            !parsed.username &&
            !parsed.password
          );
        } catch {
          return false;
        }
      }) ||
    `https://site.web.api.espn.com/apis/common/v3/sports/${request.path}/athletes/${request.id}`;
  return { url, source: "ESPN", sourceUrl };
}

export function sportsDbAthletePortrait(
  data: unknown,
  request: AthletePortraitRequest,
): AthletePortrait | null {
  const players = record(data).player;
  if (!validRequest(request) || !Array.isArray(players)) return null;
  const sport = normal(portraitSport(request));
  const gender =
    request.path === "tennis/atp" ? "male" : request.path === "tennis/wta" ? "female" : "";
  const matches = players
    .slice(0, 100)
    .map(record)
    .filter(
      (player) =>
        normal(player.strPlayer) === normal(request.name) &&
        normal(player.strSport) === sport &&
        (!gender || !player.strGender || normal(player.strGender) === gender),
    );
  // An ambiguous same-name result is less useful than the existing flag or sport emblem.
  if (matches.length !== 1 || !/^\d+$/.test(text(matches[0].idPlayer))) return null;
  const player = matches[0];
  const url = publishedPortraitUrl(player.strCutout) || publishedPortraitUrl(player.strThumb);
  return url
    ? {
        url,
        source: "TheSportsDB",
        sourceUrl: `https://www.thesportsdb.com/player/${player.idPlayer}`,
      }
    : null;
}

const SPORT_WORDS: Record<string, RegExp> = {
  Golf: /\bgolfers?\b/i,
  Tennis: /\btennis\b/i,
  Cycling: /\b(?:cyclists?|cycling)\b/i,
  Athletics:
    /\b(?:athletes?|sprinters?|runners?|hurdlers?|jumpers?|throwers?|decathletes?|heptathletes?|race walkers?|marathon)\b/i,
  Swimming: /\b(?:swimmers?|divers?|water polo)\b/i,
  Skiing: /\b(?:skiers?|skiing|ski jumpers?)\b/i,
  Biathlon: /\b(?:biathletes?|biathlon)\b/i,
  "Winter Sports":
    /\b(?:skiers?|skiing|snowboarders?|skaters?|curlers?|bobsledders?|lugers?|biathletes?|biathlon)\b/i,
  Motorsport: /\b(?:racing drivers?|drivers?|riders?|motorcycle racers?)\b/i,
  Boxing: /\bboxers?\b/i,
  Fighting:
    /\b(?:mixed martial artists?|fighters?|wrestlers?|judokas?|karatekas?|taekwondo)\b/i,
  Snooker: /\bsnooker\b/i,
  Darts: /\bdarts\b/i,
  Badminton: /\bbadminton\b/i,
  "Table Tennis": /\btable tennis\b/i,
  Soccer: /\b(?:footballers?|soccer)\b/i,
  Basketball: /\bbasketball\b/i,
  Baseball: /\bbaseball\b/i,
  "American Football": /\b(?:american football|football player)\b/i,
  "Ice Hockey": /\bice hockey\b/i,
  Rugby: /\brugby\b/i,
  Cricket: /\bcricket(?:ers?)?\b/i,
  Volleyball: /\bvolleyball\b/i,
  Handball: /\bhandball\b/i,
  Softball: /\bsoftball\b/i,
  "Australian Football": /\bAustralian rules football(?:ers?)?\b/i,
  Lacrosse: /\blacrosse\b/i,
  "Field Hockey": /\bfield hockey\b/i,
  Netball: /\bnetball\b/i,
  "Water Polo": /\bwater polo\b/i,
  Esports: /\b(?:esports|e-sports|professional gamers?)\b/i,
};

/**
 * ESPN publishes no headshot outside its major leagues and TheSportsDB stops at the famous few, so
 * a niche individual sport has no face anywhere else. The summary's own one-line description is
 * what keeps a namesake out: the article must call this person the sport they compete in.
 */
export function wikipediaAthletePortrait(
  data: unknown,
  request: AthletePortraitRequest,
): AthletePortrait | null {
  const page = record(data);
  if (!validRequest(request) || page.type !== "standard") return null;
  if (normal(page.title) !== normal(request.name)) return null;
  const sport = portraitSport(request);
  const expected = sport ? SPORT_WORDS[sport] : undefined;
  const said = `${text(page.description)} ${text(page.extract).slice(0, 400)}`;
  if (!expected || !expected.test(said)) return null;
  const url =
    publishedPortraitUrl(record(page.thumbnail).source) ||
    publishedPortraitUrl(record(page.originalimage).source);
  if (!url) return null;
  const sourceUrl = text(record(record(page.content_urls).desktop).page);
  return {
    url,
    source: "Wikipedia",
    sourceUrl: sourceUrl || `https://en.wikipedia.org/wiki/${encodeURIComponent(request.name)}`,
  };
}

type Cached = { at: number; value: AthletePortrait | null; sourcesVersion?: number };
type FetchJson = (url: string, signal: AbortSignal) => Promise<unknown>;
type Job = {
  key: string;
  request: AthletePortraitRequest;
  controller: AbortController;
  users: number;
  promise: Promise<AthletePortrait | null>;
  resolve: (value: AthletePortrait | null) => void;
  reject: (reason: unknown) => void;
};
const STORE_KEY = "harbor.sports.athlete-portraits.v1";
const SOURCES_VERSION = 2;
const POSITIVE_TTL = 7 * 86400000,
  NEGATIVE_TTL = 15 * 60000;
const abortError = () => new DOMException("Portrait request cancelled", "AbortError");

/** Call for visible featured athletes or opened details, not every fixture in a scoreboard. */
export function createAthletePortraitResolver(options: {
  fetchJson: FetchJson;
  storage?: Pick<Storage, "getItem" | "setItem">;
  asyncStorage?: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  };
  now?: () => number;
  concurrency?: number;
}) {
  const now = options.now ?? Date.now;
  const cache = new Map<string, Cached>();
  const jobs = new Map<string, Job>();
  const queue: Job[] = [];
  const concurrency = Math.min(3, Math.max(1, options.concurrency ?? 2));
  let active = 0,
    loaded = false,
    saveTimer: ReturnType<typeof setTimeout> | undefined;
  const fresh = (entry: Cached) =>
    (entry.value !== null || entry.sourcesVersion === SOURCES_VERSION) &&
    now() >= entry.at &&
    now() - entry.at < (entry.value ? POSITIVE_TTL : NEGATIVE_TTL);
  const ingest = (stored: string | null | undefined) => {
    try {
      if (!stored || stored.length > 180000) return;
      const entries: unknown = JSON.parse(stored);
      if (!Array.isArray(entries)) return;
      for (const row of entries.slice(-160)) {
        if (!Array.isArray(row) || typeof row[0] !== "string" || row[0].length > 240) continue;
        const entry = record(row[1]);
        const value = entry.value === null ? null : record(entry.value);
        if (
          typeof entry.at !== "number" ||
          (value &&
            (!publishedPortraitUrl(value.url) ||
              !validAttribution(value.source, value.sourceUrl)))
        )
          continue;
        const hit = { at: entry.at, value, sourcesVersion: entry.sourcesVersion } as Cached;
        if (fresh(hit) && (!cache.has(row[0]) || cache.get(row[0])!.at < hit.at))
          cache.set(row[0], hit);
      }
      while (cache.size > 160) cache.delete(cache.keys().next().value!);
    } catch {
      /* Storage can be disabled without preventing portraits. */
    }
  };
  const restore = () => {
    if (loaded) return;
    loaded = true;
    try {
      ingest(options.storage?.getItem(STORE_KEY));
    } catch {
      /* Private mode. */
    }
  };
  let isReady = !options.asyncStorage;
  const ready = options.asyncStorage
    ? options.asyncStorage
        .getItem(STORE_KEY)
        .then(ingest)
        .catch(() => {})
        .finally(() => {
          isReady = true;
        })
    : Promise.resolve();
  const save = () => {
    if ((!options.storage && !options.asyncStorage) || saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      const saved = JSON.stringify([...cache]);
      try {
        options.storage?.setItem(STORE_KEY, saved);
      } catch {
        /* Quota is non-fatal. */
      }
      void options.asyncStorage?.setItem(STORE_KEY, saved).catch(() => {});
    }, 500);
  };
  const read = async (url: string, controller: AbortController) => {
    const deadline = AbortSignal.timeout(6000);
    const signal = AbortSignal.any([controller.signal, deadline]);
    // Bound the body read too, including a transport which ignores cancellation.
    return new Promise<unknown>((resolve, reject) => {
      const stop = () => reject(signal.reason ?? abortError());
      signal.addEventListener("abort", stop, { once: true });
      if (signal.aborted) {
        stop();
        return;
      }
      void options
        .fetchJson(url, signal)
        .then(resolve, reject)
        .finally(() => signal.removeEventListener("abort", stop));
    });
  };
  const lookup = async (job: Job) => {
    const { request, controller } = job;
    // ESPN does not publish headshot metadata for most ATP/WTA profiles. Start with
    // the existing free database there instead of paying for a redundant bio request.
    if (
      espnPath(request.path) &&
      !request.path.startsWith("tennis/") &&
      /^\d{1,20}$/.test(request.id)
    ) {
      try {
        const person = await read(
          `https://site.web.api.espn.com/apis/common/v3/sports/${request.path}/athletes/${request.id}`,
          controller,
        );
        const portrait = espnAthletePortrait(person, request);
        if (portrait) return portrait;
      } catch {
        controller.signal.throwIfAborted();
      }
    }
    controller.signal.throwIfAborted();
    try {
      const data = await read(
        `https://www.thesportsdb.com/api/v1/json/123/searchplayers.php?p=${encodeURIComponent(request.name.trim())}`,
        controller,
      );
      const portrait = sportsDbAthletePortrait(data, request);
      if (portrait) return portrait;
    } catch {
      controller.signal.throwIfAborted();
    }
    controller.signal.throwIfAborted();
    try {
      const summary = await read(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(request.name.trim().replace(/ /g, "_"))}`,
        controller,
      );
      const portrait = wikipediaAthletePortrait(summary, request);
      if (portrait) return portrait;
    } catch {
      controller.signal.throwIfAborted();
    }
    controller.signal.throwIfAborted();
    const sport = SPORT_WORDS[portraitSport(request)];
    return sport
      ? commonsAthletePortrait(request, sport, (url) => read(url, controller))
      : null;
  };
  const pump = () => {
    while (active < concurrency && queue.length) {
      const job = queue.shift()!;
      if (job.controller.signal.aborted) {
        if (jobs.get(job.key) === job) jobs.delete(job.key);
        job.reject(abortError());
        continue;
      }
      active++;
      void lookup(job)
        .then((value) => {
          job.controller.signal.throwIfAborted();
          cache.delete(job.key);
          cache.set(job.key, { at: now(), value, sourcesVersion: SOURCES_VERSION });
          while (cache.size > 160) cache.delete(cache.keys().next().value!);
          save();
          job.resolve(value);
        })
        .catch((error) => {
          if (job.controller.signal.aborted) job.reject(error);
          else {
            cache.set(job.key, { at: now(), value: null, sourcesVersion: SOURCES_VERSION });
            while (cache.size > 160) cache.delete(cache.keys().next().value!);
            save();
            job.resolve(null);
          }
        })
        .finally(() => {
          active--;
          if (jobs.get(job.key) === job) jobs.delete(job.key);
          pump();
        });
    }
  };
  const keyOf = (request: AthletePortraitRequest) => {
    const sport = portraitSport(request);
    // Preserve existing ESPN cache hits; other providers must include their sport identity.
    const scope = sport === SPORT_NAMES[request.path.split("/")[0]] ? "" : `:${normal(sport)}`;
    return `${request.path}${scope}:${request.id}:${normal(request.name)}`;
  };
  const peek = (request: AthletePortraitRequest): AthletePortrait | null | undefined => {
    restore();
    const hit = cache.get(keyOf(request));
    return hit && fresh(hit) ? hit.value : undefined;
  };
  const resolve = (
    request: AthletePortraitRequest,
    signal?: AbortSignal,
  ): Promise<AthletePortrait | null> => {
    if (signal?.aborted) return Promise.reject(signal.reason ?? abortError());
    if (!isReady) return ready.then(() => resolve(request, signal));
    if (!validRequest(request)) return Promise.resolve(null);
    const hit = peek(request);
    if (hit !== undefined) return Promise.resolve(hit);
    const key = keyOf(request);
    let job = jobs.get(key);
    if (job?.controller.signal.aborted) {
      jobs.delete(key);
      job = undefined;
    }
    if (!job) {
      if (queue.length >= 24) return Promise.resolve(null);
      let done!: Job["resolve"], fail!: Job["reject"];
      const promise = new Promise<AthletePortrait | null>((res, rej) => {
        done = res;
        fail = rej;
      });
      job = {
        key,
        request,
        controller: new AbortController(),
        users: 0,
        promise,
        resolve: done,
        reject: fail,
      };
      jobs.set(key, job);
      queue.push(job);
    }
    const shared = job;
    shared.users++;
    const result = new Promise<AthletePortrait | null>((res, rej) => {
      let settled = false;
      const finish = () => {
        if (settled) return false;
        settled = true;
        signal?.removeEventListener("abort", stop);
        shared.users--;
        if (!shared.users) {
          shared.controller.abort();
          const slot = queue.indexOf(shared);
          if (slot >= 0) {
            queue.splice(slot, 1);
            if (jobs.get(key) === shared) jobs.delete(key);
            shared.reject(abortError());
          }
        }
        return true;
      };
      const stop = () => {
        if (finish()) rej(signal?.reason ?? abortError());
      };
      signal?.addEventListener("abort", stop, { once: true });
      shared.promise.then(
        (value) => {
          if (finish()) res(value);
        },
        (error) => {
          if (finish()) rej(error);
        },
      );
    });
    pump();
    return result;
  };
  return { resolve, peek, ready };
}

let sharedResolver: ReturnType<typeof createAthletePortraitResolver> | undefined;
export function athletePortraits() {
  if (!sharedResolver) {
    let storage: Storage | undefined;
    try {
      if (typeof localStorage !== "undefined") storage = localStorage;
    } catch {
      /* Private mode. */
    }
    sharedResolver = createAthletePortraitResolver({
      storage,
      asyncStorage:
        typeof window === "undefined"
          ? undefined
          : {
              getItem: async (key) =>
                (await import("./artwork-storage")).readArtworkMetadata(key),
              setItem: async (key, value) =>
                (await import("./artwork-storage")).writeArtworkMetadata(key, value),
            },
      fetchJson: async (url, signal) => {
        const { safeFetch } = await import("../safe-fetch");
        const response = await safeFetch(url, { signal });
        if (!response.ok) throw new Error("Portrait feed unavailable");
        return response.json();
      },
    });
  }
  return sharedResolver;
}
