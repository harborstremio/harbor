/** Explicit app region wins; otherwise retain the region reported by the runtime locale. */
export function resolveUiRegion(region: unknown, locale: unknown): string | undefined {
  if (typeof region === "string" && /^[a-z]{2}$/i.test(region.trim()))
    return region.trim().toUpperCase();
  if (typeof locale !== "string" || !locale.trim()) return undefined;
  try {
    return new Intl.Locale(locale.trim().replaceAll("_", "-")).region;
  } catch {
    return undefined;
  }
}

export function associationFootballEnglishLabel(
  language: string,
  region?: string,
): "Soccer" | "Football" {
  const normalized = language.trim().toLowerCase().split(/[-_]/, 1)[0];
  return normalized === "en" && resolveUiRegion(region, language) === "US" ? "Soccer" : "Football";
}
