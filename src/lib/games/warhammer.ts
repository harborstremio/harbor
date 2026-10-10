import { queryIgdb, readIgdbSnapshot } from "./atlas";
import { parseWarhammerConnections, WARHAMMER_CONNECTION_QUERY } from "./warhammer-data";

export async function loadWarhammerConnections(signal: AbortSignal) {
  return parseWarhammerConnections(await queryIgdb(WARHAMMER_CONNECTION_QUERY, signal));
}
export async function readWarhammerConnections() {
  try { const rows = await readIgdbSnapshot(WARHAMMER_CONNECTION_QUERY); return rows ? parseWarhammerConnections(rows) : null; }
  catch { return null; }
}
