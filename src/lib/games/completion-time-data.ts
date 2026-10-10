export type GameCompletionTimes = { gameId: number; count: number; main?: number; extras?: number; complete?: number };
export function completionTimeQuery(gameId: number) {
  if (!Number.isSafeInteger(gameId) || gameId < 1) throw Error("Invalid IGDB game ID");
  return `fields game_id,hastily,normally,completely,count; where game_id = ${gameId}; limit 2;`;
}
export function parseCompletionTimes(value: unknown, gameId: number): GameCompletionTimes | null {
  completionTimeQuery(gameId);
  if (!Array.isArray(value)) throw Error("Invalid completion response");
  const rows = value.filter(row => row && typeof row === "object" && row.game_id === gameId);
  if (!rows.length) return null;
  if (rows.length !== 1) throw Error("Ambiguous completion identity");
  const row = rows[0];
  if (!Number.isSafeInteger(row.count) || row.count < 1) return null;
  const seconds = (input: unknown) => typeof input === "number" && Number.isSafeInteger(input) && input > 0 ? input : undefined;
  const main = seconds(row.hastily), extras = seconds(row.normally), complete = seconds(row.completely);
  return main || extras || complete ? { gameId, count: row.count, main, extras, complete } : null;
}
