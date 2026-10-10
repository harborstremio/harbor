export function releaseText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

export function releaseYear(value: unknown): number {
  const year = Number.parseInt(releaseText(value).slice(0, 4), 10);
  return Number.isFinite(year) ? year : NaN;
}
