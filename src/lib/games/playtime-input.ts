export const PLAYTIME_UNITS = ["days", "hours", "minutes", "seconds"] as const;
export type PlaytimeFields = Record<typeof PLAYTIME_UNITS[number], string>;
const factors = { days: 86400, hours: 3600, minutes: 60, seconds: 1 };
export function playtimeFields(total: number): PlaytimeFields {
  return { days: String(Math.floor(total / 86400)), hours: String(Math.floor(total % 86400 / 3600)), minutes: String(Math.floor(total % 3600 / 60)), seconds: String(total % 60) };
}
/** No grouping, signs or exponent syntax: a mistyped correction must not silently change magnitude. */
export function parsePlaytimeFields(fields: PlaytimeFields, locale: string): number | null {
  const number = new Intl.NumberFormat(locale, { useGrouping: false });
  const decimal = number.formatToParts(1.1).find(part => part.type === "decimal")?.value ?? ".";
  let total = 0n;
  for (const unit of PLAYTIME_UNITS) {
    let text = fields[unit].trim();
    if (text.length > 24) return null;
    for (let digit = 0; digit <= 9; digit++) text = text.replaceAll(number.format(digit), String(digit));
    text = text.replace(/[\u0660-\u0669\u06f0-\u06f9]/g, digit => String(digit.charCodeAt(0) % 16));
    if (/^(ar|fa)(-|$)/.test(locale)) text = text.replace("\u066b", decimal);
    if (!text) continue;
    if (decimal !== "." && text.includes(".")) return null;
    text = text.replace(decimal, ".");
    if (!/^\d{1,10}(?:\.\d{1,6})?$/.test(text)) return null;
    const [whole, fraction = ""] = text.split(".");
    total += (BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0"))) * BigInt(factors[unit]);
  }
  if (total > 3_600_000_000n * 1_000_000n) return null;
  return Number((total + 500_000n) / 1_000_000n);
}
