import { customLinkedGame, emptyLaunchConfig, type CustomGame } from "./custom-library";
import { downloadGame as sanitizeDownloadGame, type DownloadGame } from "./transfers";

export type SetupEntry = { id: string; path: string; relativePath: string; bytes: number; kind: "installer" | "archive" | "torrent" | "game" | "externalArchive" | "rom"; engine?: "inno" | null };
export type SetupPlan = { token: string; root: string; entries: SetupEntry[]; truncated: boolean };
export type SetupVerification = { checkedFiles?: number | null; totalFiles?: number | null; badFiles?: number | null; missingFiles?: number | null };
export type SetupProgress = { stage?: "installing" | "checking"; verification?: SetupVerification | null; percent?: number | null; phase?: string | null; currentFile?: string | null; elapsedSeconds?: number | null; remainingSeconds?: number | null; ioBytesPerSecond?: number | null; observedAt: number; canReveal?: boolean; canObserve?: boolean };
export type SetupJob = { id: string; profile: string; source: string; installer: string; startedAt: number; updatedAt: number; reconnectedAt?: number | null; status: "running" | "finished" | "failed" | "interrupted" | "external"; exitCode: number | null; error: string | null; engine?: "inno" | null; destination?: string | null; activity?: { bytes: number; files: number; truncated: boolean } | null; gameCandidates?: string[]; scanTruncated?: boolean; rootGameCandidates?: string[]; rootCandidatesComplete?: boolean; progress?: SetupProgress | null };
export type SetupSource = { source: string; originSource?: string; name: string; game?: DownloadGame };
export const setupPath = (path: string) => {
  const plain = path.replace(/^\\\\\?\\UNC\\/i, "\\\\").replace(/^\\\\\?\\/, "");
  return /^[a-z]:[\\/]/i.test(plain) || plain.startsWith("\\\\") ? plain.replace(/\//g, "\\").replace(/\\+$/, "").toLowerCase() : plain.replace(/\/+$/, "");
};
export function setupJobForSource(jobs: SetupJob[], source: string) {
  return jobs.filter(job => setupPath(job.source) === setupPath(source)).sort((a, b) => b.startedAt - a.startedAt || b.updatedAt - a.updatedAt)[0];
}
export function mergeSetupJob(jobs: SetupJob[], incoming: SetupJob, profile: string) {
  if (incoming.profile !== profile) return jobs;
  const previous = jobs.find(job => job.id === incoming.id);
  const reconnects = previous?.status === "interrupted" && incoming.status === "running" &&
    Number.isSafeInteger(incoming.reconnectedAt) && incoming.reconnectedAt! > previous.updatedAt && incoming.reconnectedAt! <= incoming.updatedAt;
  if (previous && (previous.updatedAt > incoming.updatedAt || previous.status !== "running" && incoming.status === "running" && !reconnects)) return jobs;
  return [incoming, ...jobs.filter(job => job.id !== incoming.id)].sort((a, b) => b.startedAt - a.startedAt).slice(0, 200);
}
const executableName = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/\.(?:exe|app|appimage)$/i, "").replace(/[-_ ](?:win(?:32|64)|shipping)(?:[-_ ]shipping)?$/i, "").replace(/[^\p{L}\p{N}]/gu, "");
export function setupGameCandidates(paths: string[]) {
  return [...new Map(paths.filter(path => !/(?:^|[\\/])(?:engine|redist|_redist|__redist|tools|support)[\\/]/i.test(path) && !/^(?:unins|setup|install|vcredist|vc_redist|dxsetup|dxwebsetup|quicksfv|dotnet|ueprereq|unitycrashhandler|crashreport|easyanticheat|battleye)/i.test(path.split(/[\\/]/).at(-1) ?? "")).map(path => [setupPath(path), path])).values()];
}
/** Select only a unique game or an exact title match; size alone is not identity. */
export function setupExecutable(paths: string[], name: string) {
  const candidates = setupGameCandidates(paths);
  if (candidates.length === 1) return candidates[0];
  const title = executableName(name);
  const exact = title ? candidates.filter(path => executableName(path.split(/[\\/]/).at(-1) ?? "") === title) : [];
  // A game's top-level bootstrap owns prerequisites/launch parameters for its deeper binary.
  const shortest = exact.sort((a, b) => a.split(/[\\/]/).length - b.split(/[\\/]/).length);
  return shortest.length === 1 || shortest.length > 1 && shortest[0].split(/[\\/]/).length < shortest[1].split(/[\\/]/).length ? shortest[0] : undefined;
}
export function setupDetectedExecutable(plan: SetupPlan, name: string) {
  return !plan.truncated && !plan.entries.some(entry => entry.kind !== "game") ? setupExecutable(plan.entries.map(entry => entry.path), name) : undefined;
}
/** A complete root scan can prove an exact launcher even when deep game data exceeds scan limits. */
export function setupInstalledExecutable(job: SetupJob, name: string) {
  if (!job.scanTruncated) return setupExecutable(job.gameCandidates ?? [], name);
  if (!job.rootCandidatesComplete || !job.destination) return;
  const title = executableName(name);
  const roots = setupGameCandidates(job.rootGameCandidates ?? []).filter(path =>
    setupPath(path.slice(0, Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\")))) === setupPath(job.destination!) &&
    executableName(path.split(/[\\/]/).at(-1) ?? "") === title);
  return title && roots.length === 1 ? roots[0] : undefined;
}
export function setupInstallFolder(parent: string, name: string) {
  const folder = name.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").slice(0, 120).replace(/[. ]+$/, "");
  if (!folder || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(folder)) return "";
  return `${parent.replace(/[\\/]+$/, "")}${/^[a-z]:|^\\\\/i.test(parent) ? "\\" : "/"}${folder}`;
}
export function setupLibraryGame(source: SetupSource, executable: string, name: string, games: CustomGame[], now = Date.now()): CustomGame {
  const previous = games.find(game => setupPath(game.config.executable) === setupPath(executable));
  if (previous) return previous;
  const game = sanitizeDownloadGame(source.game), match = game?.id.match(/^(steam|igdb):(\d+)$/);
  const linked = match && game ? customLinkedGame({ [match[1] === "steam" ? "steamId" : "igdbId"]: Number(match[2]), name: game.name, capsule: game.artwork ?? "", platforms: [] }) : null;
  return { id: crypto.randomUUID(), name: name.trim().slice(0, 160), config: { ...emptyLaunchConfig(), executable }, linked, artwork: null, pinned: false, hidden: false, addedAt: now, lastPlayed: 0, measuredSeconds: 0 };
}
const setupErrors = new Set(["setup_profile", "setup_path", "setup_read", "setup_review", "setup_limit", "setup_changed", "setup_expired", "setup_selection", "setup_busy", "setup_store", "setup_start", "setup_platform", "setup_canceled", "setup_destination", "setup_engine", "setup_candidates", "setup_verification", "setup_verification_unknown"]);
export function setupError(error: unknown) {
  const code = error instanceof Error ? error.message : String(error);
  if (/command.*not found|unknown command/i.test(code)) return "games.setup.unavailable";
  return `games.setup.${setupErrors.has(code) ? code : "setup_read"}`;
}
