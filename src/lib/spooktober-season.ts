/** Local calendar dates; the early 2026 launch must never repeat. */
export function isSpooktoberSeason(date = new Date()): boolean {
  return date.getMonth() === 9 || (
    date.getFullYear() === 2026 && date.getMonth() === 8 && date.getDate() >= 28
  );
}

export function nextSpooktoberDateCheck(date = new Date()): number {
  const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return Math.max(1000, midnight.getTime() - date.getTime() + 100);
}
