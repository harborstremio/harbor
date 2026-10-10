const FINISHED =
  /^(?:FT|AET|PEN|Finished|Match Finished|Final|Finals|After Extra Time|Match Ended|Ended|Complete|Completed|Result|Results)$/i;

export function isFinishedStatus(status: string | null | undefined): boolean {
  return FINISHED.test((status ?? "").trim());
}

export function publishedDateOnly(
  timestamp: string | null | undefined,
  date: string | null | undefined,
  time: string | null | undefined,
): string | undefined {
  if (timestamp) return undefined;
  const clock = (time ?? "").trim();
  if (clock && clock !== "00:00:00" && clock !== "00:00") return undefined;
  const day = (date ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : undefined;
}
