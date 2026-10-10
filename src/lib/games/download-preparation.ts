import { archiveError, archiveFolder } from "./archives";
import { archivePartName } from "./archive-parts";
import { downloadDestination } from "./download-locations";
import type { DownloadItem, DownloadGroup } from "./download-presentation";

export type PreparationEngine = "direct" | "torrent";
export type PreparationTarget = { profile: string; engine: PreparationEngine; downloadId: string; archive: string; members: string[] };
export type PreparationDraft = { archive: string; parent: string; name: string; members: string[] };
export type PreparationChoice = { id: string; target: PreparationTarget; identity: string; parent: string; name: string; status: "waiting" | "queued" | "dispatching" | "started" | "failed" | "disabled"; error: string | null; updatedAt: number };
export type PreparationFile = { path: string; selected: boolean };
export type PreparationOption = { archive: string; members: string[]; complete: boolean };
export type PreparationForm = { enabled: boolean; archive?: string; parent?: string; name?: string };
export const preparationFilename = (path: string) => path.split(/[\\/]/).at(-1) ?? "";
export const preparationOutput = (choice: PreparationChoice) => downloadDestination(choice.parent, choice.name);
export const preparationError = (reason: unknown) => (reason instanceof Error ? reason.message : String(reason)) === "archive_store" ? "games.preparation.storeError" : archiveError(reason);

/** Naming and selection only; native code verifies metadata, hashes and paths. */
export function preparationOptions(files: readonly PreparationFile[]): PreparationOption[] {
  const groups = new Map<string, { path: string; index: number; selected: boolean }[]>();
  const seen = new Set<string>();
  for (const file of files) {
    if (seen.has(file.path)) continue;
    seen.add(file.path);
    const name = preparationFilename(file.path), part = archivePartName(name);
    if (!part && !/\.(?:zip|7z|tar|tar\.gz|tgz|iso)$/i.test(name)) continue;
    const key = file.path.slice(0, file.path.length - name.length) + "\0" + (part?.key ?? name);
    const group = groups.get(key) ?? [];
    group.push({ path: file.path, index: part?.index ?? 0, selected: file.selected });
    groups.set(key, group);
  }
  return [...groups.values()].filter(group => group.some(file => file.selected)).map(group => {
    group.sort((a, b) => a.index - b.index || a.path.localeCompare(b.path));
    return { archive: group[0].path, members: group.slice(1).map(file => file.path), complete: group.every(file => file.selected) };
  });
}
export function preparationValues(form: PreparationForm, options: PreparationOption[], parent: string, folderName = (name: string) => name) {
  const archive = form.archive ?? (options.length === 1 ? options[0].archive : "");
  return { archive, parent: form.parent ?? parent, name: form.name ?? (archive ? folderName(archiveFolder(archive)).slice(0, 180).trimEnd() : "") };
}
export function preparationDraft(form: PreparationForm, options: PreparationOption[], parent: string, engine: PreparationEngine, folderName?: (name: string) => string): PreparationDraft | null {
  const value = preparationValues(form, options, parent, folderName), option = options.find(item => item.archive === value.archive);
  if (!form.enabled || !option?.complete || !value.parent || !value.name.trim() || /[<>:"/\\|?*\x00-\x1f]/.test(value.name) || /[. ]$/.test(value.name) || value.name.length > 180 || value.name.startsWith(".harbor-")) return null;
  return { ...value, members: engine === "direct" ? option.members : [] };
}
export function mergePreparation(choices: PreparationChoice[], choice: PreparationChoice, profile: string) {
  if (choice.target.profile !== profile) return choices;
  const same = (item: PreparationChoice) => item.target.engine === choice.target.engine && item.target.downloadId === choice.target.downloadId;
  const old = choices.find(same);
  if (old && old.updatedAt > choice.updatedAt) return choices;
  return [...choices.filter(item => !same(item)), choice];
}
export function downloadPreparation(item: DownloadItem, choices: PreparationChoice[]) {
  return choices.find(choice => choice.target.profile === item.record.profile && choice.target.engine === item.kind && choice.target.downloadId === item.record.id) ?? item.record.preparation ?? undefined;
}
export function preparationGroup(group: DownloadGroup, choice?: PreparationChoice): DownloadGroup {
  if (!choice || choice.status === "disabled" || choice.status === "started" || group === "canceled") return group;
  if (choice.status === "failed" || choice.error) return "attention";
  return group === "complete" ? "queue" : group;
}
