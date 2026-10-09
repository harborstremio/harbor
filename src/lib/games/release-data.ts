export type GameRelease = {
  id: number; platform: { id: number; name: string }; date?: number; dateFormat?: number; dateFormatName?: string;
  label: string; region?: { id: number; name: string }; status?: { id: number; name: string };
};
export type AlternativeTitle = { name: string; comment: string };
type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const text = (value: unknown, limit = 200) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const id = (value: unknown): number | undefined => typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
const list = (value: unknown) => Array.isArray(value) ? value.slice(0, 100) : [];
export function gameReleaseHistory(value: unknown): GameRelease[] {
  const releases = list(value).flatMap(item => {
    const v = row(item), identity = id(v.id), platform = row(v.platform), platformId = id(platform.id), name = text(platform.name);
    if (!identity || !platformId || !name) return [];
    const region = row(v.release_region), regionId = id(region.id), regionName = text(region.region, 80);
    const status = row(v.status), statusId = id(status.id), statusName = text(status.name, 80);
    const format = typeof v.date_format === "number" ? v.date_format : row(v.date_format).id;
    const formatName = text(row(v.date_format).format, 40);
    return [{ id: identity, platform: { id: platformId, name }, label: text(v.human, 80),
      ...(typeof v.date === "number" && Number.isSafeInteger(v.date) && v.date >= -2208988800 && v.date < 7258118400 ? { date: v.date } : {}),
      ...(typeof format === "number" && Number.isInteger(format) && format >= 0 && format <= 7 ? { dateFormat: format } : {}),
      ...(formatName ? { dateFormatName: formatName } : {}),
      ...(regionId && regionName ? { region: { id: regionId, name: regionName } } : {}),
      ...(statusId && statusName ? { status: { id: statusId, name: statusName } } : {}),
    }];
  });
  return [...new Map(releases.map(release => [release.id, release])).values()].sort((a, b) => (a.date ?? Infinity) - (b.date ?? Infinity) || a.platform.name.localeCompare(b.platform.name));
}
export function gameAlternativeTitles(value: unknown): AlternativeTitle[] {
  return [...new Map(list(value).flatMap(item => {
    const v = row(item), name = text(v.name); return name ? [[name, { name, comment: text(v.comment) }] as const] : [];
  })).values()];
}
export function releasedOn(releases: readonly GameRelease[] | undefined, platforms: readonly number[], now = Date.now()): boolean {
  // Keep the platform, status and date on the same release. Nested provider
  // filters can match a released PC edition AND a cancelled Dreamcast port.
  return !!releases?.some(release => platforms.includes(release.platform.id) && release.date !== undefined && release.date * 1000 <= now && release.dateFormat !== 7 && release.status?.id !== 5 && !/cancel/i.test(release.status?.name ?? ""));
}
export const RELEASE_METADATA_FIELDS = "release_dates.date,release_dates.human,release_dates.date_format,release_dates.date_format.format,release_dates.platform.name,release_dates.release_region.region,release_dates.status.name,alternative_names.name,alternative_names.comment";
