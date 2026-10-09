const viewed = new Map<string, number>();

export function getViewedSeason(seriesId: string): number | undefined {
  return viewed.get(seriesId);
}

export function setViewedSeason(seriesId: string, season: number): void {
  if (Number.isFinite(season)) viewed.set(seriesId, season);
}
