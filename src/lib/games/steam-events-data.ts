export type SteamSaleEvent = {
  id: string; name: string; season: "spring" | "summer" | "autumn" | "winter";
  startDate: string; endDate: string; startsAt?: number; endsAt?: number;
  image?: string; url: string; sourceUrl: string; observedAt: number;
  cards?: { available: boolean; badgeRewards: boolean; sourceUrl: string; observedAt: number };
};
export const STEAM_SALE_SCHEDULE = "https://partner.steamgames.com/doc/marketing/discounts/seasonalsales?l=english";
export const STEAM_SALE_CARDS_FAQ = "https://help.steampowered.com/en/faqs/view/7238-6689-609B-881A";
const SEASONS = ["spring", "summer", "autumn", "winter"] as const;

/** Read Valve's live eligibility rule. Missing/changed wording stays unknown, never 'no cards'. */
export function applySteamSaleCardPolicy(events: SteamSaleEvent[], html: string, observedAt = Date.now()): SteamSaleEvent[] {
  if (html.length > 2_000_000) return events;
  const encoded = html.match(/\bdata-faqstore="([^"]+)"/i)?.[1];
  if (!encoded) return events;
  try {
    const value = JSON.parse(encoded.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"));
    const faq = Object.values(value.faqs ?? {}).find((item): item is { title: string; content: string; language: number } => {
      if (!item || typeof item !== "object") return false;
      const row = item as Record<string, unknown>;
      return row.language === 0 && typeof row.title === "string" && /Steam Sale Trading Cards/i.test(row.title) && typeof row.content === "string";
    });
    const content = faq?.content.replace(/\[[^\]]*\]/g, " ").replace(/\s+/g, " ");
    const rule = content?.match(/Steam Sale cards are only available during (?:the )?((?:(?:Spring|Summer|Autumn|Winter)(?:\s*(?:,|and|&)\s*|\s+)){1,4})Sales\b/i)?.[1];
    if (!rule) return events;
    const seasons = SEASONS.filter(season => new RegExp(`\\b${season}\\b`, "i").test(rule));
    if (!seasons.length) return events;
    const badgeRewards = /Crafting the Steam Sale badge earns you an emoticon and a profile background/i.test(content!);
    return events.map(event => ({ ...event, cards: { available: seasons.includes(event.season), badgeRewards, sourceUrl: STEAM_SALE_CARDS_FAQ, observedAt } }));
  } catch { return events; }
}
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const strip = (html: string) => html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
function date(value: string): string | null {
  const found = value.match(/^(\w+) (\d{1,2}), (20\d{2})$/i); if (!found) return null;
  const month = MONTHS.indexOf(found[1].toLowerCase()), day = Number(found[2]), year = Number(found[3]);
  const timestamp = new Date(Date.UTC(year, month, day));
  return month >= 0 && day > 0 && timestamp.getUTCMonth() === month ? timestamp.toISOString().slice(0, 10) : null;
}

/** Only dated seasonal headings published by Valve. Navigation labels are not events. */
export function parseSteamSaleSchedule(html: string, observedAt = Date.now()): SteamSaleEvent[] {
  if (html.length > 2_000_000) throw Error("Steam sale schedule is too large");
  const seen = new Set<string>(), events: SteamSaleEvent[] = [];
  for (const heading of html.matchAll(/<h[23]\b[^>]*>([\s\S]*?)<\/h[23]>/gi)) {
    const found = strip(heading[1]).match(/^(Spring|Summer|Autumn|Winter) Sale (20\d{2})\s*\|\s*(\w+ \d{1,2}, 20\d{2})\s*[-–]\s*(\w+ \d{1,2}, 20\d{2})$/i);
    if (!found) continue;
    const startDate = date(found[3]), endDate = date(found[4]), season = found[1].toLowerCase() as SteamSaleEvent["season"];
    if (!startDate || !endDate || endDate <= startDate || Number(endDate.slice(0, 4)) - Number(startDate.slice(0, 4)) > 1 || !startDate.startsWith(found[2])) continue;
    const id = `${season}-${found[2]}`; if (seen.has(id)) continue; seen.add(id);
    const doc = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].find(link => strip(link[2]).toLowerCase() === `steam ${season} sale ${found[2]}`);
    let sourceUrl = STEAM_SALE_SCHEDULE;
    try { const candidate = new URL(doc?.[1] ?? "", STEAM_SALE_SCHEDULE); if (candidate.origin === "https://partner.steamgames.com" && candidate.pathname.startsWith("/doc/marketing/upcoming_events/")) sourceUrl = candidate.href; } catch { /* Schedule remains the verified source. */ }
    events.push({ id, name: `${found[1]} Sale ${found[2]}`, season, startDate, endDate, sourceUrl, url: "https://store.steampowered.com/", observedAt });
  }
  if (!events.length) throw Error("Steam has not published a readable seasonal sale schedule");
  return events.sort((a, b) => a.startDate.localeCompare(b.startDate)).slice(0, 12);
}

const pacificDate = (now: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(now));

/** Resolve a documented local hour with Intl's timezone database, including daylight saving. */
function pacificHour(iso: string, hour: number): number {
  const midnight = Date.parse(`${iso}T00:00:00Z`), rough = midnight + hour * 3_600_000;
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(rough));
  const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
  const local = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
  return rough + rough - local;
}

export function enrichSteamSaleEvent(event: SteamSaleEvent, html: string): SteamSaleEvent {
  if (html.length > 2_000_000) return event;
  const body = html.match(/<div class="documentation_bbcode">([\s\S]*?)<div id="hashLocationHighlight"/i)?.[1];
  if (!body) return event;
  const text = strip(body), expectedName = `Steam ${event.season} Sale`;
  if (!text.toLowerCase().includes(expectedName.toLowerCase())) return event;
  const full = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${Number(iso.slice(8))}, ${iso.slice(0, 4)}`;
  const compact = event.startDate.slice(0, 7) === event.endDate.slice(0, 7)
    ? `${MONTHS[Number(event.startDate.slice(5, 7)) - 1]} ${Number(event.startDate.slice(8))} - ${Number(event.endDate.slice(8))}, ${event.startDate.slice(0, 4)}` : null;
  const normalized = text.toLowerCase().replace(/[–—]/g, "-");
  // A linked article with conflicting dates cannot provide the countdown's precision.
  const matchesDate = normalized.includes(`${full(event.startDate)} - ${full(event.endDate)}`) || (compact !== null && normalized.includes(compact));
  const time = matchesDate ? text.match(/at (\d{1,2})(?::00)?\s*(am|pm) Pacific\b/i) : null;
  const hour = time ? Number(time[1]) % 12 + (time[2].toLowerCase() === "pm" ? 12 : 0) : undefined;
  const image = matchesDate ? body.match(/<img\b[^>]*src="(https:\/\/shared\.(?:akamai|fastly)\.steamstatic\.com\/community_assets\/images\/steamworks_docs\/english\/[^"<>]+)"/i)?.[1] : undefined;
  return { ...event, ...(image ? { image } : {}), ...(hour !== undefined && Number(time![1]) >= 1 && Number(time![1]) <= 12 ? { startsAt: pacificHour(event.startDate, hour), endsAt: pacificHour(event.endDate, hour) } : {}) };
}

export function steamSalePhase(event: SteamSaleEvent, now = Date.now()): "upcoming" | "current" | "ended" {
  if (event.startsAt !== undefined && event.endsAt !== undefined) return now < event.startsAt ? "upcoming" : now >= event.endsAt ? "ended" : "current";
  const today = pacificDate(now); return today < event.startDate ? "upcoming" : today > event.endDate ? "ended" : "current";
}
export function currentSteamSale(events: readonly SteamSaleEvent[], now = Date.now()): SteamSaleEvent | null {
  return [...events].sort((a, b) => a.startDate.localeCompare(b.startDate)).find(event => steamSalePhase(event, now) !== "ended") ?? null;
}
export function steamSaleDays(event: SteamSaleEvent, now = Date.now()): number {
  const destination = steamSalePhase(event, now) === "upcoming" ? event.startDate : event.endDate;
  return Math.max(0, Math.round((Date.parse(`${destination}T00:00:00Z`) - Date.parse(`${pacificDate(now)}T00:00:00Z`)) / 86_400_000));
}
