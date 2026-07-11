import {
  fetchCalendarRange,
  fetchCustomCalendar,
  fireWebhook,
  loadLastFiredState,
  saveLastFiredState,
  todayLocalISO,
  type CalendarItem,
  type LastFiredState,
} from "./calendar";
import { fetchAnticipatedCalendar, fetchLibraryCalendar, fetchTraktCalendar } from "./calendar-sources";
import { computeTvgIdCounts, epgProgramsForChannel } from "./iptv/epg-resolver";
import { getCachedPlaylist } from "./iptv/store";
import { fetchAndParseXmltv, indexProgramsByChannel } from "./iptv/xmltv";
import type { Settings, WebhookTrigger } from "./settings";
import { getSession as getTraktSession } from "./trakt/session";

function traktConnected(): boolean {
  return !!getTraktSession();
}

const WINDOW_DAYS_TRACK = 14;
const WINDOW_DAYS_FIRE = 2;

type SourceKey = "library" | "all" | "trakt" | "anticipated" | "custom";

function dateOffsetISO(daysFromToday: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rangeFromToday(): { start: string; end: string } {
  return { start: todayLocalISO(), end: dateOffsetISO(WINDOW_DAYS_TRACK) };
}

function fireWindowEnd(): string {
  return dateOffsetISO(WINDOW_DAYS_FIRE);
}

function applyContentTypeFilter(items: CalendarItem[], opts: Settings["webhooks"]): CalendarItem[] {
  return items.filter((i) => {
    if (i.isAnime) return opts.notifyAnime;
    if (i.type === "movie") return opts.notifyMovies;
    if (i.type === "tv") return opts.notifyTv;
    return false;
  });
}

async function fetchSource(source: SourceKey, settings: Settings, authKey: string | null): Promise<CalendarItem[]> {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const { start, end } = rangeFromToday();
  try {
    if (source === "library") {
      if (!authKey) return [];
      return await fetchLibraryCalendar(authKey, year, month, {
        tmdbKey: settings.tmdbKey,
        includeTrakt: traktConnected(),
      });
    }
    if (source === "trakt") {
      if (!traktConnected()) return [];
      return await fetchTraktCalendar(year, month);
    }
    if (source === "anticipated") {
      return await fetchAnticipatedCalendar(year, month);
    }
    if (source === "custom") {
      if (!settings.tmdbKey) return [];
      const extras: CalendarItem[][] = [];
      if (settings.customCalendar.includeTraktAnticipated) {
        extras.push(await fetchAnticipatedCalendar(year, month).catch(() => []));
      }
      if (settings.customCalendar.includeTraktWatchlist && traktConnected()) {
        extras.push(await fetchTraktCalendar(year, month).catch(() => []));
      }
      return await fetchCustomCalendar({
        apiKey: settings.tmdbKey,
        region: settings.region,
        filters: {
          trackedPeople: settings.customCalendar.trackedPeople,
          genres: settings.customCalendar.genres,
          watchProviders: settings.customCalendar.watchProviders,
          originCountries: settings.customCalendar.originCountries,
          mediaTypes: settings.customCalendar.mediaTypes,
        },
        start,
        end,
        extra: extras.flat(),
      });
    }
    if (!settings.tmdbKey) return [];
    return await fetchCalendarRange(settings.tmdbKey, start, end, settings.region);
  } catch (e) {
    console.warn(`[webhook] source ${source} fetch failed`, e);
    return [];
  }
}

function inFutureWindow(item: CalendarItem, todayISO: string, end: string): boolean {
  if (!item.releaseDate) return false;
  return item.releaseDate >= todayISO && item.releaseDate <= end;
}

function matchesTrigger(item: CalendarItem, trigger: WebhookTrigger, trackedPersonIds: number[]): boolean {
  void trackedPersonIds;
  switch (trigger.event) {
    case "newMovie":
      return item.type === "movie" && !item.isAnime;
    case "newSeries":
      return item.type === "tv" && !item.isAnime;
    case "newAnime":
      return item.isAnime;
    case "fromTraktAnticipated":
    case "fromTraktWatchlist":
      return true;
    case "fromTrackedPerson":
    case "fromGenre":
    case "fromProvider":
    case "fromCountry":
      return true;
    case "liveTvEvent":
      return true;
  }
}

function loadIptvFavorites(): Set<string> {
  try {
    const raw = localStorage.getItem("harbor.iptv.favorites.v2");
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as Record<string, { id?: string } | unknown>;
    const ids = new Set<string>();
    for (const v of Object.values(parsed)) {
      if (v && typeof v === "object" && "id" in v && typeof (v as { id?: string }).id === "string") {
        ids.add((v as { id: string }).id);
      }
    }
    return ids;
  } catch {
    return new Set();
  }
}

async function fetchLiveTvEvents(
  settings: Settings,
  leadMinutes: number,
  favoritesOnly: boolean,
  channelIds: string[] | null,
): Promise<CalendarItem[]> {
  const playlists = settings.iptvPlaylists.filter((p) => (p.kind ?? "m3u") !== "epg");
  if (playlists.length === 0) return [];
  const now = Date.now();
  const cutoff = now + leadMinutes * 60_000;
  const favIds = favoritesOnly ? loadIptvFavorites() : null;
  const out: CalendarItem[] = [];

  for (const pl of playlists.slice(0, 3)) {
    const cached = getCachedPlaylist(pl.id);
    if (!cached) continue;
    if (!pl.epgUrl) continue;
    let parsed;
    try {
      parsed = await fetchAndParseXmltv(pl.epgUrl);
    } catch {
      continue;
    }
    const byChannel = indexProgramsByChannel(parsed.programs);
    const tvgIdCounts = computeTvgIdCounts(cached.channels);
    for (const channel of cached.channels) {
      if (favIds && favIds.size > 0 && !favIds.has(channel.id)) continue;
      if (channelIds && channelIds.length > 0 && !channelIds.includes(channel.id)) continue;
      const chanPrograms = epgProgramsForChannel(
        channel,
        { byChannel, channelMeta: parsed.channelMeta, fetchedAt: now },
        tvgIdCounts,
      );
      if (!chanPrograms) continue;
      for (const p of chanPrograms) {
        if (p.startMs < now) continue;
        if (p.startMs > cutoff) continue;
        const date = new Date(p.startMs);
        out.push({
          id: `iptv:${channel.id}:${p.startMs}`,
          imdbId: null,
          type: "tv",
          name: `${p.title} — ${channel.name}`,
          poster: channel.logo,
          background: null,
          releaseDate: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
          isAnime: false,
          overview: p.description ?? "",
          voteAverage: 0,
        });
      }
    }
  }
  return out;
}

function sourcesForTrigger(trigger: WebhookTrigger): SourceKey[] {
  switch (trigger.event) {
    case "fromTraktAnticipated":
      return ["anticipated"];
    case "fromTraktWatchlist":
      return ["trakt"];
    case "fromTrackedPerson":
    case "fromGenre":
    case "fromProvider":
    case "fromCountry":
      return ["custom"];
    default:
      return ["all"];
  }
}

function ruleKey(ruleId: string, item: CalendarItem): string {
  return `rule:${ruleId}:${item.id}`;
}

function legacyKey(source: SourceKey, kind: "discord" | "telegram", item: CalendarItem): string {
  return `${source}:${kind}:${item.id}`;
}

function legacyBaselineKey(source: SourceKey, kind: "discord" | "telegram"): string {
  return `__baseline__:${source}:${kind}`;
}

function ruleBaselineKey(ruleId: string): string {
  return `__baseline__:rule:${ruleId}`;
}

type ChannelResult = { kind: string; ok: boolean; status: number; error: string | null };

function commit(state: LastFiredState, abortReason: string, results: ChannelResult[], totalFired: number) {
  if (saveLastFiredState(state)) return null;
  console.warn(`[webhook] state persist failed, aborting ${abortReason} to prevent spam`);
  return { fired: totalFired, channels: results };
}

export async function runWebhookTick(
  settings: Settings,
  authKey: string | null,
): Promise<{ fired: number; channels: ChannelResult[] }> {
  const { discordUrl, telegramUrl, sources } = settings.webhooks;
  if (!discordUrl && !telegramUrl) return { fired: 0, channels: [] };
  const todayISO = todayLocalISO();
  const fireEnd = fireWindowEnd();
  const state: LastFiredState = loadLastFiredState();
  pruneState(state, todayISO);
  let totalFired = 0;
  const channelResults: ChannelResult[] = [];

  const enabledSources = (Object.entries(sources) as Array<[SourceKey, boolean]>)
    .filter(([, on]) => on)
    .map(([k]) => k);

  const sourceCache = new Map<SourceKey, CalendarItem[]>();
  const sourceFor = async (k: SourceKey): Promise<CalendarItem[]> => {
    if (sourceCache.has(k)) return sourceCache.get(k)!;
    const rows = await fetchSource(k, settings, authKey);
    sourceCache.set(k, rows);
    return rows;
  };

  for (const source of enabledSources) {
    const rows = await sourceFor(source);
    const typed = applyContentTypeFilter(rows, settings.webhooks);
    const fireable = typed.filter((i) => inFutureWindow(i, todayISO, fireEnd));
    for (const channel of ["discord", "telegram"] as const) {
      const url = channel === "discord" ? discordUrl : telegramUrl;
      if (!url) continue;

      if (!state[legacyBaselineKey(source, channel)]) {
        if (typed.length === 0) continue;
        for (const item of fireable) state[legacyKey(source, channel, item)] = todayISO;
        state[legacyBaselineKey(source, channel)] = todayISO;
        const aborted = commit(state, "baseline write", channelResults, totalFired);
        if (aborted) return aborted;
        continue;
      }

      const newItems = fireable.filter((i) => !state[legacyKey(source, channel, i)]);
      if (newItems.length === 0) continue;
      for (const item of newItems) state[legacyKey(source, channel, item)] = todayISO;
      const aborted = commit(state, "legacy fire", channelResults, totalFired);
      if (aborted) return aborted;
      const text = headlineForSource(source, newItems.length);
      const result = await fireWebhook(channel, url, { text, items: newItems });
      channelResults.push({ kind: `${source}/${channel}`, ...result });
      if (result.ok) totalFired += newItems.length;
    }
  }

  const trackedPersonIds = settings.customCalendar.trackedPeople.map((p) => p.id);
  for (const rule of settings.webhookRules) {
    if (!rule.enabled) continue;
    if (!rule.channels.discord && !rule.channels.telegram) continue;
    let candidates: CalendarItem[] = [];
    if (rule.trigger.event === "liveTvEvent") {
      candidates = await fetchLiveTvEvents(
        settings,
        rule.trigger.leadMinutes ?? 15,
        rule.trigger.favoritesOnly !== false,
        rule.trigger.channelIds ?? null,
      );
    } else {
      const sourcesNeeded = sourcesForTrigger(rule.trigger);
      for (const k of sourcesNeeded) {
        const rows = await sourceFor(k);
        candidates = candidates.concat(rows);
      }
    }
    const isLive = rule.trigger.event === "liveTvEvent";
    const seen = new Set<string>();
    const uniq = candidates.filter((i) => {
      if (seen.has(i.id)) return false;
      seen.add(i.id);
      return isLive ? true : inFutureWindow(i, todayISO, fireEnd);
    });
    const matched = uniq.filter((i) => matchesTrigger(i, rule.trigger, trackedPersonIds));

    if (!state[ruleBaselineKey(rule.id)]) {
      if (candidates.length === 0) continue;
      for (const item of matched) state[ruleKey(rule.id, item)] = todayISO;
      state[ruleBaselineKey(rule.id)] = todayISO;
      const aborted = commit(state, "rule baseline write", channelResults, totalFired);
      if (aborted) return aborted;
      continue;
    }

    const newMatched = matched.filter((i) => !state[ruleKey(rule.id, i)]);
    if (newMatched.length === 0) continue;
    const targets = (["discord", "telegram"] as const).filter(
      (c) => rule.channels[c] && (c === "discord" ? discordUrl : telegramUrl),
    );
    if (targets.length === 0) continue;
    for (const item of newMatched) state[ruleKey(rule.id, item)] = todayISO;
    const aborted = commit(state, "rule fire", channelResults, totalFired);
    if (aborted) return aborted;
    for (const channel of targets) {
      const url = channel === "discord" ? discordUrl! : telegramUrl!;
      const text = `Harbor rule "${rule.name}": ${newMatched.length} new ${newMatched.length === 1 ? "release" : "releases"}`;
      const result = await fireWebhook(channel, url, { text, items: newMatched });
      channelResults.push({ kind: `rule:${rule.id}/${channel}`, ...result });
      if (result.ok) totalFired += newMatched.length;
    }
  }

  saveLastFiredState(state);
  return { fired: totalFired, channels: channelResults };
}

function headlineForSource(source: SourceKey, count: number): string {
  const noun = count === 1 ? "release" : "releases";
  switch (source) {
    case "library":
      return `Harbor: ${count} upcoming ${noun} from your library`;
    case "all":
      return `Harbor: ${count} new upcoming ${noun}`;
    case "trakt":
      return `Harbor: ${count} upcoming ${noun} from your Trakt watchlist`;
    case "anticipated":
      return `Harbor: ${count} new entries on Trakt Anticipated`;
    case "custom":
      return `Harbor: ${count} new ${noun} in your custom feed`;
  }
}

function pruneState(state: LastFiredState, todayISO: string): void {
  const cutoff = new Date(todayISO);
  cutoff.setDate(cutoff.getDate() - 60);
  const cutoffISO = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
  for (const k of Object.keys(state)) {
    if (state[k] < cutoffISO) delete state[k];
  }
}
