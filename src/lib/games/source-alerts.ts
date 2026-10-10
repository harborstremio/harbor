import { sourceOrigin } from './source-origin';
import { sourceListingGame } from "./source-listing";
import type { GameSummary } from "./types";
import type { GameSource, SourceRelease } from "./sources";
import { sourceMatch, sourceUrl } from "./sources";

export const SOURCE_ALERT_PREFIX = "harbor.games.source-alerts.v1:";
export const SOURCE_ALERT_LIMIT = 200;
export type SourceAlertWatch = { id: string; game: GameSummary; addedAt: number; checkedAt?: number; failed?: boolean; foundAt?: number };
export type SourceAlertNotice = { id: string; watchId: string; game: GameSummary; sourceId: string; sourceName: string; releaseTitle: string; match: "identity" | "title"; createdAt: number; read: boolean };
export type SourceAlertState = { watches: SourceAlertWatch[]; notices: SourceAlertNotice[] };
type Store = Pick<Storage, "getItem" | "setItem">;
const MAX_BYTES = 2_000_000;
const text = (value: unknown, max = 500): value is string => typeof value === "string" && value.length > 0 && value.length <= max && !/[\x00-\x1f\x7f]/.test(value);
const positive = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
const time = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;

/** Persist portable identity only; catalog Steam associations are not edition identity. */
export function sourceAlertGame(value: unknown): GameSummary | null {
  if (!value || typeof value !== "object") return null;
  const game = value as GameSummary;
  if (typeof game.id === "string" && game.id.startsWith("source:")) return sourceListingGame(game);
  if (!text(game.id, 256) || !text(game.name) || !Array.isArray(game.platforms)) return null;
  if (game.steamId !== undefined && !positive(game.steamId) || game.igdbId !== undefined && !positive(game.igdbId)) return null;
  const steamId = game.id.startsWith("igdb:") ? undefined : game.steamId;
  return { ...(sourceOrigin(game.sourceOrigin) ? {sourceOrigin:sourceOrigin(game.sourceOrigin)} : {}), id: game.id, name: game.name, steamId, igdbId: game.igdbId, capsule: sourceUrl(game.capsule) ?? "", platforms: game.platforms.filter((p): p is string => text(p, 100)).slice(0, 30), ...(game.adultContent === true ? { adultContent: true } : {}) };
}

export function readSourceAlerts(profile: string, storage: Store = localStorage): SourceAlertState {
  const raw = storage.getItem(SOURCE_ALERT_PREFIX + profile);
  if (!raw) return { watches: [], notices: [] };
  if (raw.length > MAX_BYTES) throw Error("source_alert_storage");
  const value = JSON.parse(raw);
  if (value?.version !== 1 || !Array.isArray(value.watches) || !Array.isArray(value.notices) || value.watches.length > SOURCE_ALERT_LIMIT || value.notices.length > 100) throw Error("source_alert_storage");
  const seen = new Set<string>();
  const watches: SourceAlertWatch[] = value.watches.flatMap((item: SourceAlertWatch) => {
    const game = sourceAlertGame(item?.game);
    if (!game || !text(item.id, 256) || !time(item.addedAt) || seen.has(game.id)) return [];
    seen.add(game.id);
    return [{ id: item.id, game, addedAt: item.addedAt, ...(time(item.checkedAt) ? { checkedAt: item.checkedAt } : {}), ...(time(item.foundAt) ? { foundAt: item.foundAt } : {}), failed: item.failed === true }];
  });
  const notices: SourceAlertNotice[] = value.notices.flatMap((item: SourceAlertNotice) => {
    const game = sourceAlertGame(item?.game);
    return game && text(item.id, 800) && text(item.watchId, 256) && text(item.sourceId, 256) && text(item.sourceName, 120) && text(item.releaseTitle) && time(item.createdAt) && ["identity", "title"].includes(item.match)
      ? [{ id: item.id, watchId: item.watchId, game, sourceId: item.sourceId, sourceName: item.sourceName, releaseTitle: item.releaseTitle, match: item.match, createdAt: item.createdAt, read: item.read === true }] : [];
  });
  return { watches, notices };
}

const listeners = new Set<(profile: string) => void>();
export function subscribeSourceAlerts(listener: (profile: string) => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
function write(profile: string, state: SourceAlertState, storage: Store) {
  const raw = JSON.stringify({ version: 1, ...state });
  if (raw.length > MAX_BYTES) throw Error("source_alert_storage");
  storage.setItem(SOURCE_ALERT_PREFIX + profile, raw);
  for (const listener of listeners) listener(profile);
}

export function setSourceAlert(profile: string, game: GameSummary, enabled: boolean, storage: Store = localStorage, now = Date.now(), id = crypto.randomUUID()) {
  const state = readSourceAlerts(profile, storage), portable = sourceAlertGame(game);
  if (!portable) throw Error("source_alert_game");
  const existing = state.watches.find(watch => watch.game.id === game.id);
  if (enabled && existing) return;
  if (enabled && state.watches.length >= SOURCE_ALERT_LIMIT) throw Error("source_alert_limit");
  const watches = enabled ? [...state.watches, { id, game: portable, addedAt: now }] : state.watches.filter(watch => watch.game.id !== game.id);
  write(profile, { ...state, watches }, storage);
}

export function sourceAlertMatch(release: SourceRelease, game: GameSummary) {
  if (release.kind !== "game" || !release.files.length) return null;
  // Community catalogs often omit kind even for separate update/DLC-only packages.
  const suffix = release.title.split(/\s+(?:[–—|]|-\s|\[|\()/)[1]?.trim();
  if (suffix && /^(?:update(?:\s+only)?|patch|dlc(?:\s+only)?|soundtrack|artbook|dedicated\s+server|demo|trainer|bonus\s+content)\b/i.test(suffix)) return null;
  return sourceMatch(release, game);
}

/** Claim and persist before delivery. A canceled/rearmed watch cannot consume an old result. */
export function claimSourceAlert(profile: string, watchId: string, source: GameSource, release: SourceRelease, storage: Store = localStorage, now = Date.now()): SourceAlertNotice | null {
  if (!source.enabled) return null;
  const state = readSourceAlerts(profile, storage), watch = state.watches.find(item => item.id === watchId);
  if (!watch || watch.foundAt !== undefined) return null;
  const match = sourceAlertMatch(release, watch.game);
  if (!match) return null;
  const notice: SourceAlertNotice = { id: `g:${profile}:${watch.id}`, watchId, game: watch.game, sourceId: source.id, sourceName: source.name, releaseTitle: release.title, match, createdAt: now, read: false };
  write(profile, { watches: state.watches.map(item => item.id === watchId ? { ...item, foundAt: now, checkedAt: now, failed: false } : item), notices: [notice, ...state.notices].slice(0, 100) }, storage);
  return notice;
}

export function recordSourceAlertCheck(profile: string, ids: string[], failed: boolean, storage: Store = localStorage, now = Date.now()) {
  const state = readSourceAlerts(profile, storage);
  if (!state.watches.some(watch => ids.includes(watch.id) && watch.foundAt === undefined)) return;
  write(profile, { ...state, watches: state.watches.map(watch => ids.includes(watch.id) && watch.foundAt === undefined ? { ...watch, checkedAt: now, failed } : watch) }, storage);
}

export function markSourceAlertsRead(profile: string, storage: Store = localStorage) {
  const state = readSourceAlerts(profile, storage);
  if (state.notices.some(notice => !notice.read)) write(profile, { ...state, notices: state.notices.map(notice => ({ ...notice, read: true })) }, storage);
}
