function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function toLocalDateISO(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  return `${y}-${m}-${day}`;
}

export function toLocalTimeLabel(d: Date): string {
  if (Number.isNaN(d.getTime())) return "";
  const hour = d.getHours();
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const period = hour >= 12 ? "PM" : "AM";
  return `${hour12}:${pad(d.getMinutes())} ${period}`;
}

export function localDateTimeFromIso(
  iso: string | null | undefined,
): { date: string; time?: string; atMs?: number } {
  if (!iso) return { date: "" };
  if (!iso.includes("T")) return { date: iso.slice(0, 10) };
  const d = new Date(iso);
  const date = toLocalDateISO(d);
  if (!date) return { date: iso.slice(0, 10) };
  return { date, time: toLocalTimeLabel(d) || undefined, atMs: d.getTime() };
}
