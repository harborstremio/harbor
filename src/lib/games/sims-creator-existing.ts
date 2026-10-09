import type { SimsWorkspace } from "./sims";

export type SimsCreatorTarget = { key: string; label: string; groupId?: string; sources?: string[]; version?: string };
const core = ["mc_cmd_center.package", "mc_cmd_center.ts4script"];
const basename = (path: string) => path.split("/").at(-1)!.toLowerCase();
const hasCore = (names: string[]) => core.every(name => names.includes(name));

// Suggestions identify files to review, not a verified creator or installed version.
export function simsCreatorExisting(data: SimsWorkspace | null) {
  const targets: SimsCreatorTarget[] = [];
  if (!data) return { targets, found: false };
  for (const group of data.state.groups) {
    if (group.source?.provider === "mccc" || hasCore(group.files.map(f => f.name.toLowerCase()))) {
      targets.push({ key: group.id, label: group.title, groupId: group.id, version: group.source?.version });
    }
  }
  const folders = new Map<string, typeof data.folder.files>();
  for (const file of data.folder.files) {
    if (file.path.split("/")[0].toLowerCase().startsWith("harbor-")) continue;
    const parent = file.path.includes("/") ? file.path.slice(0, file.path.lastIndexOf("/")) : "";
    const siblings = folders.get(parent) ?? [];
    siblings.push(file); folders.set(parent, siblings);
  }
  for (const [parent, files] of folders) {
    if (!hasCore(files.map(f => basename(f.path)))) continue;
    const selected = files.filter(f => /^mc_[a-z0-9_]+\.(?:package|ts4script|cfg|json)$/i.test(basename(f.path)));
    // Canonical Windows paths can carry the \\?\ prefix, which requires backslashes.
    const separator = data.folder.path.includes("\\") ? "\\" : "/";
    const root = data.folder.path.replace(/[\\/]$/, "");
    targets.push({ key: `files:${parent}`, label: parent || "Mods", sources: selected.map(f => [root, "Mods", ...f.path.split("/")].join(separator)) });
  }
  const found = data.folder.partial || targets.length > 0
    || data.folder.files.some(f => core.includes(basename(f.path)))
    || data.state.groups.some(g => g.files.some(f => core.includes(f.name.toLowerCase())));
  return { targets, found };
}
