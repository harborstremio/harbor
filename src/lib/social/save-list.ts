import { addToList, createList, MAX_LISTS, readLists } from "@/lib/custom-lists";
import { fetchSharedList } from "./featured-lists";

export type SaveListResult = { ok: boolean; already?: boolean; full?: boolean };

export async function saveList(handle: string, listId: string): Promise<SaveListResult> {
  const list = await fetchSharedList(handle, listId);
  if (!list || !list.items || list.items.length === 0) throw new Error("save list: not found");
  const nameLc = list.name.trim().toLowerCase();
  const existing = readLists();
  if (nameLc && existing.some((l) => l.name.trim().toLowerCase() === nameLc))
    return { ok: true, already: true };
  if (existing.length >= MAX_LISTS) return { ok: false, full: true };
  const newId = createList(list.name || "Saved list", list.description);
  if (!newId) return { ok: false, full: true };
  for (const it of list.items)
    addToList(newId, { id: it.id, type: it.type, name: it.name, poster: it.poster });
  return { ok: true };
}
