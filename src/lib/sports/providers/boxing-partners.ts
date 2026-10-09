import type { SportsGame, SportsSide } from "../espn-types";

const PBC = "https://www.premierboxingchampions.com";
const QUEENSBERRY = "https://queensberry.co.uk";
const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const clean = (value?: string | null) => (value || "").replace(/\s+/g, " ").trim();

export function boxingCalendarDate(value: string): string | undefined {
  const text = clean(value).replace(/^[A-Za-z]+,\s*/, "");
  const match =
    text.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/) ||
    text.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (!match) return;
  const firstIsDay = /^\d+$/.test(match[1]);
  const day = Number(match[firstIsDay ? 1 : 2]);
  const month = months.indexOf(match[firstIsDay ? 2 : 1].slice(0, 3).toLowerCase());
  const year = Number(match[3]);
  if (month < 0 || year < 2020 || year > 2100) return;
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCMonth() !== month || date.getUTCDate() !== day) return;
  return date.toISOString().slice(0, 10);
}

/** Resolve the visible Eastern broadcast time, including DST, instead of PBC's incorrect JSON-LD offset. */
export function boxingEasternTime(date: string, time: string): number | undefined {
  const match = clean(time).match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)\s+ET\b/i);
  if (!match || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
  const hour = Number(match[1]);
  const minute = Number(match[2] || 0);
  if (hour < 1 || hour > 12 || minute > 59) return;
  const [year, month, day] = date.split("-").map(Number);
  const target = Date.UTC(
    year,
    month - 1,
    day,
    (hour % 12) + (match[3].toUpperCase() === "PM" ? 12 : 0),
    minute,
  );
  try {
    const format = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    const wallTime = (ms: number) => {
      const parts = Object.fromEntries(
        format.formatToParts(ms).map((part) => [part.type, part.value]),
      );
      return Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    };
    let result = target;
    for (let i = 0; i < 3; i++) result += target - wallTime(result);
    return wallTime(result) === target ? result : undefined;
  } catch {
    return;
  }
}

function content(html: string): DocumentFragment {
  if (html.length > 1_000_000) throw new Error("Boxing calendar exceeded its size limit");
  const template = document.createElement("template");
  // Inert parsing only: never attach provider scripts, styles or handlers to the page.
  template.innerHTML = html;
  return template.content;
}

function eventUrl(
  value: string | null | undefined,
  origin: string,
  prefix: string,
): URL | undefined {
  try {
    const url = new URL(value || "", origin);
    if (url.origin !== origin || !url.pathname.startsWith(prefix) || url.username || url.password)
      return;
    if (!/^\/[a-z0-9/-]+$/i.test(url.pathname)) return;
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return;
  }
}

function side(name = ""): SportsSide {
  return { id: "", name, abbr: "", logo: "", score: "", winner: false };
}

function game(
  provider: "pbc" | "queensberry",
  url: URL,
  date: string,
  title: string,
  venue: string,
  startMs?: number,
): SportsGame {
  const id = `${provider}:${url.pathname.replace(/^\/+|\/+$/g, "")}`;
  const [year, month, day] = date.split("-").map(Number);
  return {
    id,
    source: "official-boxing",
    league: "BOXING",
    state: "pre",
    detail: "",
    startMs: startMs ?? new Date(year, month - 1, day, 12).getTime(),
    ...(startMs === undefined ? { dateOnly: date } : {}),
    home: side(),
    away: side(),
    context: {
      id,
      name: title,
      venue,
      round: "",
      draw: provider === "pbc" ? "Premier Boxing Champions" : "Queensberry",
      major: false,
    },
  };
}

export function parsePbcCalendar(html: string): SportsGame[] {
  const root = content(html);
  const cards = Array.from(root.querySelectorAll(".fight-row")).slice(0, 30);
  if (!cards.length) throw new Error("PBC calendar format is unavailable");
  const games = new Map<string, SportsGame>();
  for (const card of cards) {
    const link = card.querySelector<HTMLAnchorElement>('a[href*="fight-night-"]');
    const url = eventUrl(link?.getAttribute("href"), PBC, "/fight-night-");
    const heading = card.querySelector(".schedule-date");
    const visibleDate = clean(heading?.textContent).match(
      /^[A-Za-z]+,\s+[A-Za-z]+\s+\d{1,2},?\s+\d{4}/,
    )?.[0];
    const date = boxingCalendarDate(visibleDate || "");
    const fighters = Array.from(
      card.querySelectorAll("h2 a")[0]?.querySelectorAll("span") || [],
    ).map((el) => clean(el.textContent));
    if (
      !url ||
      !date ||
      fighters.length !== 2 ||
      fighters.some((name) => !name || name.length > 120)
    )
      continue;
    const startMs = boxingEasternTime(date, clean(heading?.querySelector(".time")?.textContent));
    const result = game(
      "pbc",
      url,
      date,
      fighters.join(" vs "),
      clean(card.querySelector(".arena")?.textContent),
      startMs,
    );
    result.home = side(fighters[0]);
    result.away = side(fighters[1]);
    // The schedule's JSON-LD repeats an unrelated generic image and unordered performers.
    // Leave artwork absent so the promotion fallback is used instead of the wrong fight.
    games.set(result.id, result);
  }
  return [...games.values()].sort((a, b) => a.startMs - b.startMs);
}

export function parseQueensberryCalendar(html: string): SportsGame[] {
  const root = content(html);
  const cards = Array.from(root.querySelectorAll(".upcoming-events-blocks")).slice(0, 30);
  if (!cards.length) throw new Error("Queensberry calendar format is unavailable");
  const games = new Map<string, SportsGame>();
  for (const card of cards) {
    const url = eventUrl(
      card.querySelector(".upcoming-first-btn a")?.getAttribute("href"),
      QUEENSBERRY,
      "/pages/",
    );
    const date = boxingCalendarDate(
      clean(card.querySelector(".upcoming-first-icon-text")?.textContent),
    );
    const title = clean(card.querySelector("h3")?.textContent);
    if (!url || !date || !title || title.length > 250) continue;
    const result = game(
      "queensberry",
      url,
      date,
      title,
      clean(card.querySelector(".upcoming-second-icon-text")?.textContent),
    );
    try {
      const poster = new URL(card.querySelector("img")?.getAttribute("src") || "", QUEENSBERRY);
      if (
        poster.origin === QUEENSBERRY &&
        !poster.username &&
        !poster.password &&
        poster.pathname.startsWith("/cdn/shop/files/") &&
        /\.(?:png|jpe?g|webp)$/i.test(poster.pathname)
      ) {
        result.poster = poster.href;
        result.artwork = poster.href;
      }
    } catch {
      /* Promotion artwork remains the fallback. */
    }
    // Calendar cards publish campaign titles, not verified fighter identities or start times.
    games.set(result.id, result);
  }
  return [...games.values()].sort((a, b) => a.startMs - b.startMs);
}
