import { safeFetchBytes } from "@/lib/safe-fetch";
import { GameRequestPool } from "./request-pool";
import { parseSpeedrunBoard, parseSpeedrunGame, speedrunSearch, type SpeedrunCategory, type SpeedrunGame } from "./speedrun-data";

const pool = new GameRequestPool(2), cache = new Map<string, { at: number; data: unknown }>();
const TTL = 30 * 60_000, LIMIT = 2 * 1024 * 1024;
async function request(path: string, signal: AbortSignal): Promise<unknown> {
  signal.throwIfAborted();
  const held = cache.get(path);
  if (held && Date.now() - held.at < TTL) return held.data;
  return pool.run(async () => {
    const response = await safeFetchBytes(`https://www.speedrun.com/api/v1/${path}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]) }, 12_000, LIMIT);
    if (!response.ok) throw Error(`Speedrun ${response.status}`);
    const reader = response.body?.getReader(), decoder = new TextDecoder(); let body = "", size = 0;
    if (reader) {
      try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > LIMIT) throw Error("Speedrun response too large"); body += decoder.decode(part.value, { stream: true }); } body += decoder.decode(); }
      finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
    } else { body = await response.text(); if (body.length > LIMIT) throw Error("Speedrun response too large"); }
    const data: unknown = JSON.parse(body); signal.throwIfAborted();
    cache.delete(path); cache.set(path, { at: Date.now(), data });
    if (cache.size > 40) cache.delete(cache.keys().next().value!);
    return data;
  }, signal);
}
export async function loadSpeedrunGame(name: string, signal: AbortSignal) {
  if (!name.trim() || name.length > 200) return null;
  return parseSpeedrunGame(await request(`games?name=${encodeURIComponent(speedrunSearch(name))}&max=20&embed=categories,variables`, signal), name);
}
export async function loadSpeedrunBoard(game: SpeedrunGame, category: SpeedrunCategory, signal: AbortSignal) {
  if (!/^[a-z0-9]{8}$/.test(game.id) || !game.categories.some(item => item.id === category.id)) throw Error("Invalid speedrun selection");
  const query = new URLSearchParams({ top: "1", embed: "players,variables,platforms" });
  for (const [key, value] of Object.entries(category.filters)) query.set(`var-${key}`, value);
  return parseSpeedrunBoard(await request(`leaderboards/${game.id}/category/${category.id}?${query}`, signal), game, category);
}
