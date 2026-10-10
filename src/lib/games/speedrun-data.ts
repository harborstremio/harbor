import { parseSpeedrunVideo, type SpeedrunVideo } from "./speedrun-videos";

type Row = Record<string, unknown>;
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const text = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 200) : "";
const id = (value: unknown) => /^[a-z0-9]{8}$/.test(text(value)) ? text(value) : "";
const roman: Record<string, string> = { I: "1", II: "2", III: "3", IV: "4", V: "5", VI: "6", VII: "7", VIII: "8", IX: "9", X: "10" };
const identity = (name: string) => name.replace(/\b(?:VIII|VII|III|VI|IV|II|IX|I|V|X)\b/g, token => roman[token]!).normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
export function speedrunSearch(name: string) { return name.trim().replace(/\s+(?:VIII|VII|III|VI|IV|II|IX|I|V|X)$/, ""); }
export function speedrunUrl(value: unknown): string {
  try { const url = new URL(text(value)); return url.protocol === "https:" && ["www.speedrun.com", "speedrun.com"].includes(url.hostname) && !url.username && !url.password ? url.href : ""; } catch { return ""; }
}
export type SpeedrunCategory = { id: string; name: string; filters: Record<string, string> };
export type SpeedrunGame = { id: string; name: string; url: string; categories: SpeedrunCategory[] };
export type SpeedrunRecord = { id: string; url: string; seconds: number; timing: string; date: string; runners: { name: string; url: string; country: string }[]; qualifiers: string[]; platform: string; videos: SpeedrunVideo[] };
export type SpeedrunBoard = { url: string; records: SpeedrunRecord[]; at: number };

export function parseSpeedrunGame(value: unknown, name: string): SpeedrunGame | null {
  const data = row(value).data;
  if (!Array.isArray(data)) throw Error("Invalid speedrun game response");
  // No fuzzy first-result joins: category extensions and similarly named games are different identities.
  const matches = data.map(row).filter(game => identity(text(row(game.names).international)) === identity(name));
  if (matches.length !== 1) return null;
  const game = matches[0]!, gameId = id(game.id), url = speedrunUrl(game.weblink);
  if (!gameId || !url) return null;
  const variables = list(row(game.variables).data).map(row);
  const categories = list(row(game.categories).data).map(row).flatMap(category => {
    const categoryId = id(category.id), categoryName = text(category.name);
    if (!categoryId || !categoryName || category.type !== "per-game" || category.miscellaneous === true) return [];
    const filters: Record<string, string> = {};
    for (const variable of variables) {
      // Game embeds also include IL rules with no category; those never apply to full-game boards.
      const scope = row(variable.scope).type;
      if (scope !== "global" && scope !== "full-game") continue;
      const variableId = id(variable.id), choice = id(row(variable.values).default);
      if (variable["is-subcategory"] === true && (!variable.category || variable.category === categoryId) && variableId && choice && row(row(variable.values).values)[choice]) filters[variableId] = choice;
    }
    return [{ id: categoryId, name: categoryName, filters }];
  });
  return categories.length ? { id: gameId, name: text(row(game.names).international), url, categories } : null;
}

export function parseSpeedrunBoard(value: unknown, game: SpeedrunGame, category: SpeedrunCategory, at = Date.now()): SpeedrunBoard {
  const data = row(row(value).data), url = speedrunUrl(data.weblink);
  if (data.game !== game.id || data.category !== category.id || data.level != null || !url || !Array.isArray(data.runs)) throw Error("Speedrun leaderboard identity mismatch");
  const players = list(row(data.players).data).map(row), variables = list(row(data.variables).data).map(row), platforms = list(row(data.platforms).data).map(row);
  const timing = text(data.timing);
  if (!["realtime", "realtime_noloads", "ingame"].includes(timing)) throw Error("Unknown timing method");
  const records = data.runs.map(row).filter(place => place.place === 1).flatMap(place => {
    const run = row(place.run), runId = id(run.id), runUrl = speedrunUrl(run.weblink), seconds = row(run.times)[`${timing}_t`];
    if (run.game !== game.id || run.category !== category.id || run.level != null || row(run.status).status !== "verified" || !runId || !runUrl || typeof seconds !== "number" || !Number.isFinite(seconds) || seconds <= 0 || seconds > 31_536_000) return [];
    if (Object.entries(category.filters).some(([key, selected]) => row(run.values)[key] !== selected)) return [];
    const runners = list(run.players).map(row).flatMap(player => {
      const user = players.find(item => item.id === player.id && !!player.id), name = text(user ? row(user.names).international : player.name);
      return name ? [{ name, url: speedrunUrl(user?.weblink), country: /^[a-z]{2}$/i.test(text(row(row(user?.location).country).code)) ? text(row(row(user?.location).country).code).toUpperCase() : "" }] : [];
    });
    if (!runners.length) return [];
    const qualifiers = variables.flatMap(variable => { const selected = row(run.values)[text(variable.id)]; const label = text(row(row(row(variable.values).values)[text(selected)]).label); return label ? [`${text(variable.name)}: ${label}`] : []; });
    const videos = [...new Map(list(row(run.videos).links).slice(0, 20).flatMap(link => { const video = parseSpeedrunVideo(row(link).uri); return video ? [[video.url, video] as const] : []; })).values()].slice(0, 8);
    return [{ id: runId, url: runUrl, seconds, timing, date: /^\d{4}-\d{2}-\d{2}$/.test(text(run.date)) ? text(run.date) : "", runners, qualifiers, platform: text(platforms.find(platform => platform.id === row(run.system).platform)?.name), videos }];
  }).slice(0, 3);
  return { url, records, at };
}

export function speedrunTime(seconds: number): string {
  const milliseconds = Math.round(seconds * 1000), hours = Math.floor(milliseconds / 3_600_000), minutes = Math.floor(milliseconds % 3_600_000 / 60_000), rest = Math.floor(milliseconds % 60_000 / 1000), fraction = milliseconds % 1000;
  return `${hours ? `${hours}:` : ""}${String(minutes).padStart(hours ? 2 : 1, "0")}:${String(rest).padStart(2, "0")}${fraction ? `.${String(fraction).padStart(3, "0")}` : ""}`;
}
