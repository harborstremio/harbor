const GROUP_FROM = 10_000;

export function formatStatValue(value: string, locale: string): string {
  const raw = value.trim();
  if (!/^-?\d+$/.test(raw)) return value;
  const amount = Number(raw);
  if (!Number.isFinite(amount) || Math.abs(amount) < GROUP_FROM) return value;
  try {
    return amount.toLocaleString(locale);
  } catch {
    return value;
  }
}
