import { invoke } from "@tauri-apps/api/core";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { localLibraryReady, readLocalLibrary, type LocalEntry } from "@/lib/local-library";

export async function existingLocalEntry(
  target: Pick<LocalEntry, "id" | "path">,
): Promise<LocalEntry> {
  await localLibraryReady();
  const read = () =>
    readLocalLibrary().find((entry) => entry.id === target.id && entry.path === target.path);
  const entry = read();
  if (!entry || !entry.path.trim()) throw new Error("This local file is no longer available.");
  const file = await invoke<{ exists: boolean; isFile: boolean }>("download_file_info", {
    path: entry.path,
  });
  if (!file.exists || !file.isFile)
    throw new Error("This local file is missing or is not a regular file.");
  const current = read();
  if (!current) throw new Error("This local library entry changed. Open the menu again.");
  return current;
}

export async function revealLocalEntry(target: Pick<LocalEntry, "id" | "path">): Promise<void> {
  const current = await existingLocalEntry(target);
  await revealItemInDir(current.path);
}
