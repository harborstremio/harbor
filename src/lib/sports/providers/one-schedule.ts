import { safeFetch } from "@/lib/safe-fetch";
import type { SportsGame } from "../espn-types";

export const ONE_SCHEDULE_URL = "https://www.onefc.com/events/";
export const ONE_LOGO = "https://cdn.onefc.com/wp-content/uploads/2020/01/ONE_logo-1024-w.png";
const CACHE_MS = 30 * 60_000;
let cache: { at: number; games: SportsGame[] } | undefined;
let pending: Promise<SportsGame[]> | undefined;

/** The official calendar publishes exact timestamps, but no live scores or bout results. */
export function oneCalendarEvent(card: {
  url: string;
  name: string;
  timestamp: string;
  image?: string;
  venue?: string;
}): SportsGame | null {
  const startMs = Number(card.timestamp) * 1000;
  if (!/^\d{10}$/.test(card.timestamp) || !Number.isFinite(startMs) || !card.name.trim())
    return null;
  let url: URL;
  try {
    url = new URL(card.url);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "www.onefc.com" ||
    !/^\/events\/[a-z0-9-]+\/$/.test(url.pathname)
  )
    return null;
  let artwork: string | undefined;
  try {
    const image = new URL(card.image || "");
    if (image.protocol === "https:" && image.hostname === "cdn.onefc.com") artwork = image.href;
  } catch {
    /* Promotion artwork is used when the event has no poster. */
  }
  const id = url.pathname.split("/")[2];
  const empty = { id: "", name: "", abbr: "", logo: "", score: "", winner: false };
  return {
    id,
    source: "official-one",
    league: "ONE",
    state: "pre",
    startMs,
    detail: "",
    artwork,
    home: { ...empty },
    away: { ...empty },
    context: {
      id,
      name: card.name.trim(),
      round: "",
      draw: "",
      venue: card.venue?.trim() || "",
      major: false,
    },
  };
}

export function parseOneCalendar(html: string): SportsGame[] {
  // Template content stays inert: remote scripts, images and event handlers are never attached.
  const template = document.createElement("template");
  template.innerHTML = html;
  const cards = template.content.querySelectorAll(".simple-post-card.is-event");
  if (!cards.length) throw new Error("ONE calendar format is unavailable");
  const games = new Map<string, SportsGame>();
  for (const card of Array.from(cards).slice(0, 100)) {
    const title = card.querySelector<HTMLAnchorElement>("a.title");
    const game = oneCalendarEvent({
      url: title?.getAttribute("href") || "",
      name: title?.textContent || "",
      timestamp: card.querySelector("[data-timestamp]")?.getAttribute("data-timestamp") || "",
      image: card.querySelector("img")?.getAttribute("src") || "",
      venue: card.querySelector(".location")?.textContent || "",
    });
    if (game) {
      if (card.closest("#past-events-section")) game.state = "post";
      games.set(game.id, game);
    }
  }
  if (!games.size) throw new Error("ONE calendar contained no valid events");
  return [...games.values()].sort((a, b) => a.startMs - b.startMs);
}

export async function fetchOneSchedule(signal: AbortSignal): Promise<SportsGame[]> {
  signal.throwIfAborted();
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.games;
  if (!pending) {
    // The day and discovery consumers share one bounded request; one consumer leaving cannot cancel its peer.
    pending = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 9000);
      try {
        const response = await safeFetch(ONE_SCHEDULE_URL, { signal: controller.signal });
        if (!response.ok) throw new Error(`ONE calendar ${response.status}`);
        const html = await response.text();
        if (html.length > 1_000_000) throw new Error("ONE calendar exceeded its size limit");
        const games = parseOneCalendar(html);
        cache = { at: Date.now(), games };
        return games;
      } finally {
        clearTimeout(timer);
      }
    })().finally(() => {
      pending = undefined;
    });
  }
  const games = await pending;
  signal.throwIfAborted();
  return games;
}
