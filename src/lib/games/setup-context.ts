import { downloadGame } from "./transfers";
import { setupInstalledExecutable, setupPath, type SetupJob, type SetupSource } from "./setup";
import type { CustomGame } from "./custom-library";
import { setupVerificationFailed } from "./setup-progress";
import { archiveSetupSource, type ArchiveJob } from "./archives";

const PREFIX = "harbor.game-setup-context.v1:";
const MAX_ENTRIES = 200;
type SetupContext = SetupSource & { executable?: string };
const memory = new Map<string, Record<string, SetupContext>>();
const text = (value: unknown, limit: number): value is string => typeof value === "string" && value.length > 0 && value.length <= limit && !/[\x00-\x1f]/.test(value);

export function readSetupContexts(profile: string): Record<string, SetupContext> {
  if (memory.has(profile)) return memory.get(profile)!;
  const result: Record<string, SetupContext> = Object.create(null);
  try {
    const raw = localStorage.getItem(PREFIX + profile);
    if (raw && raw.length <= 2_000_000) {
      const stored: unknown = JSON.parse(raw);
      if (Array.isArray(stored)) for (const entry of stored.slice(-MAX_ENTRIES)) {
        if (entry && text(entry.id, 100) && text(entry.source, 8192) && text(entry.name, 500)) result[entry.id] = { source: entry.source, name: entry.name, game: downloadGame(entry.game), executable: text(entry.executable, 8192) ? entry.executable : undefined };
      }
    }
  } catch { /* Native setup history still works when display metadata cannot be restored. */ }
  memory.set(profile, result);
  while (memory.size > 8) memory.delete(memory.keys().next().value!);
  return result;
}

export function rememberSetupContext(profile: string, id: string, source: SetupSource, executable?: string) {
  if (!text(profile, 200) || !text(id, 100) || !text(source.source, 8192) || !text(source.name, 500)) return;
  const previous = readSetupContexts(profile)[id];
  const selection = text(executable, 8192) ? executable : previous && setupPath(previous.source) === setupPath(source.source) ? previous.executable : undefined;
  const entries = Object.entries({ ...readSetupContexts(profile), [id]: { source: source.source, name: source.name, game: downloadGame(source.game), executable: selection } }).slice(-MAX_ENTRIES);
  memory.set(profile, Object.fromEntries(entries));
  try { localStorage.setItem(PREFIX + profile, JSON.stringify(entries.map(([id, value]) => ({ id, ...value })))); }
  catch { /* Retain the exact association for this session if local storage is full. */ }
}

/** An explicit, validated library choice survives rescans and reopening a completed setup. */
export function registeredSetupGame(job: SetupJob, name: string, games: CustomGame[]) {
  if (job.status === "running" || job.error && job.error !== "setup_review" || setupVerificationFailed(job)) return;
  const context = readSetupContexts(job.profile)[job.id];
  const selected = context && setupPath(context.source) === setupPath(job.source) ? context.executable : undefined;
  const executable = selected ?? (job.status === "finished" && job.exitCode === 0 ? setupInstalledExecutable(job, name) : undefined);
  return executable ? games.find(game => setupPath(game.config.executable) === setupPath(executable)) : undefined;
}

/** Portable games have no installer job; keep the explicit choice tied to this extraction. */
export function registeredArchiveGame(job: ArchiveJob, games: CustomGame[]) {
  const source = archiveSetupSource(job), context = readSetupContexts(job.profile)[`archive:${job.id}`];
  if (!source || !context?.executable || setupPath(context.source) !== setupPath(source.source)) return;
  return games.find(game => setupPath(game.config.executable) === setupPath(context.executable!));
}
