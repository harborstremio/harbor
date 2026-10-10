import type { SportsGame, SportsSide } from "../espn-types";
import { normalizeSportsSearch } from "../search-text";
import { parsePbcCalendar, parseQueensberryCalendar } from "./boxing-partners";
import { parsePbcDetail } from "../boxing-pbc-detail";
import { parseQueensberryDetail } from "../boxing-queensberry-detail";

type TextLoader = (url: string, signal: AbortSignal) => Promise<string>;
export const BOXING_CALENDARS = {
  matchroom: "https://www.matchroomboxing.com/events/",
  pbc: "https://www.premierboxingchampions.com/boxing-schedule",
  queensberry: "https://queensberry.co.uk/pages/events",
};
export type MatchroomCard = {
  url: string;
  title: string;
  venue: string;
  image?: string;
};
const emptySide = (): SportsSide => ({
  id: "",
  name: "",
  abbr: "",
  logo: "",
  score: "",
  winner: false,
});
const clean = (value: string | null | undefined, limit = 200) =>
  (value || "").replace(/\s+/g, " ").trim().slice(0, limit);
function safeImage(value: string | null | undefined) {
  try {
    const url = new URL(value || "");
    return url.protocol === "https:" &&
      url.hostname === "www.matchroomboxing.com" &&
      url.pathname.startsWith("/app/uploads/")
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}
export function officialBoxingUrl(game: SportsGame): string | undefined {
  if (game.source !== "official-boxing") return;
  const split = game.id.indexOf(":");
  const provider = game.id.slice(0, split);
  const path = game.id.slice(split + 1);
  if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(path)) return;
  if (provider === "matchroom" && /^events\/[a-z0-9-]+$/.test(path))
    return `https://www.matchroomboxing.com/${path}/`;
  if (provider === "pbc" && /^fight-night-[a-z0-9-]+$/.test(path))
    return `https://www.premierboxingchampions.com/${path}`;
  if (provider === "queensberry" && /^(?:blogs|pages)\/(?:events\/)?[a-z0-9-]+$/.test(path))
    return `https://queensberry.co.uk/${path}`;
}
function inertPage(html: string) {
  if (html.length > 1_000_000) throw new Error("Boxing calendar exceeds its size limit");
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content;
}
export function parseMatchroomCards(html: string): MatchroomCard[] {
  const page = inertPage(html);
  const section = page.querySelector(".events-upcoming");
  if (!section) throw new Error("Matchroom calendar unavailable");
  return Array.from(section.querySelectorAll(".fight-card"))
    .slice(0, 12)
    .flatMap((card) => {
      const link = card.querySelector<HTMLAnchorElement>("a[href*='/events/']");
      const url = link?.getAttribute("href") || "";
      if (!/^https:\/\/www\.matchroomboxing\.com\/events\/[a-z0-9-]+\/$/.test(url)) return [];
      return [
        {
          url,
          title: clean(link?.getAttribute("title")),
          venue: clean(card.querySelector(".location")?.textContent),
          image: safeImage(
            card.querySelector(".image img")?.getAttribute("data-src") ||
              card.querySelector(".image img")?.getAttribute("src"),
          ),
        },
      ];
    });
}
export function publishedBoxingDate(text: string): string | undefined {
  const match = text.match(
    /\b(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})\b/i,
  );
  if (!match) return;
  const month =
    [
      "january",
      "february",
      "march",
      "april",
      "may",
      "june",
      "july",
      "august",
      "september",
      "october",
      "november",
      "december",
    ].indexOf(match[2].toLowerCase()) + 1;
  const iso = `${match[3]}-${String(month).padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  const d = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : undefined;
}
export function parseMatchroomEvent(html: string, card: MatchroomCard): SportsGame | null {
  const page = inertPage(html);
  if (page.querySelector('link[rel="canonical"]')?.getAttribute("href") !== card.url) return null;
  const hero = page.querySelector(".single-event-hero .event-details");
  const dateOnly = publishedBoxingDate(hero?.querySelector(".date")?.textContent || "");
  if (!hero || !dateOnly) return null;
  const sides = [".boxer-1", ".boxer-2"].map((selector) => {
    const person = hero.querySelector(selector);
    const name = clean(
      [
        person?.querySelector(".first-name")?.textContent,
        person?.querySelector(".last-name")?.textContent,
      ]
        .filter(Boolean)
        .join(" "),
    );
    const record = Array.from(person?.querySelectorAll(".record p") || [])
      .map((el) => clean(el.textContent))
      .join(" · ");
    return {
      ...emptySide(),
      name: /^(?:tbc|tba)(?:\s+(?:tbc|tba))*$/i.test(name) ? "" : name,
      logo: safeImage(person?.querySelector("img.main")?.getAttribute("src")) || "",
      ...(record ? { record } : {}),
    };
  });
  const [year, month, day] = dateOnly.split("-").map(Number);
  const slug = new URL(card.url).pathname.replace(/^\/|\/$/g, "");
  const name = sides.every((side) => side.name)
    ? `${sides[0].name} vs ${sides[1].name}`
    : /^(?:TBC|TBA)\s+vs/i.test(card.title)
      ? slug
          .split("/")
          .pop()!
          .split("-")
          .map((word) =>
            /^[ivx]+$/.test(word) ? word.toUpperCase() : word[0].toUpperCase() + word.slice(1),
          )
          .join(" ")
      : card.title;
  return {
    id: `matchroom:${slug}`,
    source: "official-boxing",
    league: "BOXING",
    state: "pre",
    startMs: new Date(year, month - 1, day, 12).getTime(),
    dateOnly,
    detail: "",
    home: sides[0],
    away: sides[1],
    artwork: card.image,
    broadcasts: page.querySelector('a[href*="dazn.com"]') ? ["DAZN"] : [],
    context: {
      id: `matchroom:${slug}`,
      name,
      venue: card.venue,
      draw: "Matchroom Boxing",
      round: "",
      major: false,
    },
  };
}

function titleParts(game: SportsGame) {
  const names =
    game.home.name && game.away.name
      ? [game.home.name, game.away.name]
      : (game.context?.name || game.home.name).split(/\s+(?:vs\.?|v\.?|versus)\s+/i);
  return names.length === 2 ? names.map(normalizeSportsSearch).sort() : [];
}
/** An identical event from two calendars is one card; a rematch on another date is retained. */
export function mergeBoxingGames(official: SportsGame[], supplemental: SportsGame[]): SportsGame[] {
  const result: SportsGame[] = [];
  for (const game of [...official, ...supplemental]) {
    if (result.some((existing) => existing.source === game.source && existing.id === game.id))
      continue;
    const names = titleParts(game);
    const duplicate = result.find((existing) => {
      if (Math.abs(existing.startMs - game.startMs) > 36 * 3600_000) return false;
      const other = titleParts(existing);
      if (!names.length || !other.length) return false;
      return names.every(
        (name, index) =>
          name === other[index] ||
          (name.split(" ").length === 1 && other[index].endsWith(` ${name}`)) ||
          (other[index].split(" ").length === 1 && name.endsWith(` ${other[index]}`)),
      );
    });
    if (duplicate) {
      duplicate.artwork ||= game.artwork;
      duplicate.poster ||= game.poster;
      continue;
    }
    result.push({ ...game });
  }
  return result.sort((a, b) => a.startMs - b.startMs);
}
export function boxingOnDay(game: SportsGame, day: string, upcoming = false) {
  const date = new Date(game.startMs);
  const value =
    game.dateOnly?.replaceAll("-", "") ||
    `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return upcoming ? game.state !== "post" && value >= day : value === day;
}
export function createBoxingScheduleLoader(read: TextLoader, now = Date.now) {
  type Entry = { at: number; games: SportsGame[]; failed: number };
  let saved: Entry | undefined;
  let flight: { controller: AbortController; users: number; promise: Promise<Entry> } | undefined;
  return function load(signal: AbortSignal): Promise<SportsGame[]> {
    signal.throwIfAborted();
    if (saved && now() - saved.at < (saved.failed ? 60_000 : 30 * 60_000))
      return Promise.resolve(saved.games);
    if (!flight || flight.controller.signal.aborted) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 25_000);
      const entry = {
        controller,
        users: 0,
        promise: Promise.resolve({ at: 0, games: [], failed: 0 } as Entry),
      };
      entry.promise = (async () => {
        const enrich = async (
          games: SportsGame[],
          parse: (html: string, game: SportsGame) => SportsGame,
        ) => {
          const results = [...games];
          let index = 0;
          let rejected = 0;
          await Promise.all(
            [0, 1].map(async () => {
              // Only upcoming calendar cards, bounded independently of provider HTML size.
              while (index < Math.min(games.length, 12)) {
                controller.signal.throwIfAborted();
                const i = index++;
                const url = officialBoxingUrl(games[i]);
                if (!url) continue;
                try {
                  results[i] = parse(await read(url, controller.signal), games[i]);
                } catch {
                  rejected++;
                  const prior = saved?.games.find(
                    (item) => item.source === games[i].source && item.id === games[i].id,
                  );
                  if (prior) {
                    const preserve = (side: SportsSide, previous: SportsSide) =>
                      !side.name || side.name === previous.name
                        ? {
                            ...side,
                            name: side.name || previous.name,
                            logo: side.logo || previous.logo,
                          }
                        : side;
                    results[i] = {
                      ...games[i],
                      home: preserve(games[i].home, prior.home),
                      away: preserve(games[i].away, prior.away),
                    };
                  }
                }
              }
            }),
          );
          if (rejected)
            throw Object.assign(new Error("Some boxing portraits unavailable"), { games: results });
          return results;
        };
        const tasks = [
          async () => {
            const html = await read(BOXING_CALENDARS.matchroom, controller.signal);
            const cards = parseMatchroomCards(html);
            const games: SportsGame[] = [];
            let index = 0;
            let rejected = 0;
            await Promise.all(
              [0, 1].map(async () => {
                while (index < cards.length) {
                  controller.signal.throwIfAborted();
                  const card = cards[index++];
                  try {
                    const result = parseMatchroomEvent(
                      await read(card.url, controller.signal),
                      card,
                    );
                    if (result) games.push(result);
                    else rejected++;
                  } catch {
                    rejected++;
                  }
                }
              }),
            );
            if (rejected)
              throw Object.assign(new Error("Some Matchroom events unavailable"), { games });
            return games;
          },
          async () =>
            enrich(
              parsePbcCalendar(await read(BOXING_CALENDARS.pbc, controller.signal)),
              parsePbcDetail,
            ),
          async () =>
            enrich(
              parseQueensberryCalendar(await read(BOXING_CALENDARS.queensberry, controller.signal)),
              parseQueensberryDetail,
            ),
        ];
        const results: PromiseSettledResult<SportsGame[]>[] = [];
        // Two calendar providers at once; Matchroom detail requests are capped at two.
        let index = 0;
        await Promise.all(
          [0, 1].map(async () => {
            while (index < tasks.length) {
              controller.signal.throwIfAborted();
              const i = index++;
              try {
                results[i] = { status: "fulfilled", value: await tasks[i]() };
              } catch (reason) {
                results[i] = { status: "rejected", reason };
              }
            }
          }),
        );
        controller.signal.throwIfAborted();
        const failed = results.filter((result) => result.status === "rejected").length;
        const games = mergeBoxingGames(
          results.flatMap((result) =>
            result.status === "fulfilled"
              ? result.value
              : Array.isArray(result.reason?.games)
                ? result.reason.games
                : [],
          ),
          [],
        );
        if (!games.length && failed) {
          if (saved) return { ...saved, at: now(), failed };
          throw new Error("Boxing calendars unavailable");
        }
        // Retain cached provider entries when just that provider failed, without resurrecting cancellations from successful calendars.
        const providers = ["matchroom:", "pbc:", "queensberry:"];
        const retained =
          saved?.games.filter(
            (game) =>
              results[providers.findIndex((prefix) => game.id.startsWith(prefix))]?.status ===
              "rejected",
          ) || [];
        return { games: mergeBoxingGames(games, retained), at: now(), failed };
      })()
        .then((value) => {
          saved = value;
          return value;
        })
        .finally(() => {
          clearTimeout(timer);
          if (flight === entry) flight = undefined;
        });
      flight = entry;
    }
    const entry = flight;
    entry.users++;
    return new Promise((resolve, reject) => {
      let settled = false;
      const release = () => {
        if (settled) return false;
        settled = true;
        signal.removeEventListener("abort", abort);
        entry.users--;
        if (!entry.users && flight === entry) entry.controller.abort();
        return true;
      };
      const abort = () => {
        if (release()) reject(new DOMException("Aborted", "AbortError"));
      };
      signal.addEventListener("abort", abort, { once: true });
      entry.promise.then(
        (value) => {
          if (release()) resolve(value.games);
        },
        (error) => {
          if (release()) reject(error);
        },
      );
    });
  };
}
const load = createBoxingScheduleLoader(async (url, signal) => {
  const { safeFetchBytes } = await import("@/lib/safe-fetch");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const timer = setTimeout(abort, 9000);
  try {
    // Background schedule reads must stay bounded and never open a source-check window.
    // Capped native requests return blocked responses without invoking the visible solver.
    const response = await safeFetchBytes(url, { signal: controller.signal }, 9000, 1_000_000);
    if (!response.ok) throw new Error(`Boxing schedule ${response.status}`);
    const html = await response.text();
    if (html.length > 1_000_000) throw new Error("Boxing schedule too large");
    return html;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
});
export const fetchBoxingCalendars = (signal: AbortSignal) => load(signal);
