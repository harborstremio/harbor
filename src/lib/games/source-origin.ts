import { sourceUrl, type GameSource, type SourceRelease } from './sources';
import type { GameSummary } from './types';

/** Navigation provenance, not proof that borrowed artwork identifies a download. */
export type SourceOrigin = {
  sourceId: string; sourceUrl: string; title: string; page?: string;
  steamId?: number; igdbId?: number; platform?: string; kind: SourceRelease['kind'];
};

export function sourceOrigin(value: unknown): SourceOrigin | undefined {
  if (!value || typeof value !== 'object') return;
  const v = value as SourceOrigin, url = sourceUrl(v.sourceUrl), page = sourceUrl(v.page);
  const text = (value: unknown, limit: number): value is string => typeof value === 'string' && !!value.trim() && value.length <= limit && !/[\x00-\x1f\x7f]/.test(value);
  if (!text(v.sourceId, 80) || !url || !text(v.title, 500) || !['game', 'patch', 'mod', 'extra'].includes(v.kind)) return;
  if (v.page !== undefined && !page || v.platform !== undefined && !text(v.platform, 100)) return;
  for (const id of [v.steamId, v.igdbId]) if (id !== undefined && (!Number.isSafeInteger(id) || id <= 0)) return;
  return { sourceId: v.sourceId, sourceUrl: url, title: v.title, page, steamId: v.steamId, igdbId: v.igdbId, platform: v.platform, kind: v.kind };
}

export function withSourceOrigin(game: GameSummary, source: GameSource, release: SourceRelease): GameSummary {
  return { ...game, sourceOrigin: { sourceId: source.id, sourceUrl: source.url, title: release.title, page: release.sourcePage,
    steamId: release.steamId, igdbId: release.igdbId, platform: release.platform, kind: release.kind } };
}

/** Feed row IDs can change on refresh. Match the original record, within its subscription. */
export function isOriginRelease(source: Pick<GameSource, 'id' | 'url'>, release: SourceRelease, origin?: SourceOrigin): boolean {
  return !!origin && origin.sourceId === source.id && origin.sourceUrl === source.url && origin.title === release.title
    && origin.steamId === release.steamId && origin.igdbId === release.igdbId && origin.kind === release.kind
    && origin.platform === release.platform && (!origin.page || origin.page === release.sourcePage);
}
