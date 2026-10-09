import { setupPath, type SetupEntry } from "./setup";

/** Naming only: the native review verifies completeness, format and every part's hash. */
export function archivePartName(filename: string) {
  const split = /^(.+)\.(7z|zip)\.(\d{3,})$/i.exec(filename);
  if (split) return { name: split[1], key: `${split[2].toLowerCase() === "7z" ? "sevenzip" : "zip"}:${split[1].toLowerCase()}`, index: Number(split[3]) };
  const modern = /^(.*)\.part(\d+)\.rar$/i.exec(filename);
  if (modern?.[1]) return { name: modern[1], key: `modern:${modern[1].toLowerCase()}`, index: Number(modern[2]) };
  const legacy = /^(.*)\.(rar|[r-z]\d{2})$/i.exec(filename);
  if (!legacy?.[1]) return;
  const extension = legacy[2].toLowerCase();
  return { name: legacy[1], key: `legacy:${legacy[1].toLowerCase()}`, index: extension === "rar" ? 0 : (extension.charCodeAt(0) - 114) * 100 + Number(extension.slice(1)) + 1 };
}

export type SetupArchiveEntry = SetupEntry & { archiveParts: number; archiveName?: string };
export function groupSetupArchives(entries: SetupEntry[]): SetupArchiveEntry[] {
  const groups = new Map<string, { position: number; index: number }>();
  const result: SetupArchiveEntry[] = [];
  for (const entry of entries) {
    const filename = entry.path.split(/[\\/]/).at(-1) ?? "";
    const part = entry.kind === "archive" ? archivePartName(filename) : undefined;
    if (!part) { result.push({ ...entry, archiveParts: 1 }); continue; }
    const parent = entry.path.slice(0, entry.path.length - filename.length);
    const key = `${setupPath(parent)}\0${part.key}`, previous = groups.get(key);
    if (!previous) {
      groups.set(key, { position: result.length, index: part.index });
      result.push({ ...entry, archiveParts: 1, archiveName: part.name });
    } else {
      const current = result[previous.position], first = part.index < previous.index ? entry : current;
      result[previous.position] = { ...first, bytes: current.bytes + entry.bytes, archiveParts: current.archiveParts + 1, archiveName: part.name };
      previous.index = Math.min(part.index, previous.index);
    }
  }
  return result;
}
