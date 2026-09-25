import {
  createListWithItems,
  MAX_ITEMS,
  MAX_LISTS,
  readPersistedListSnapshot,
} from "@/lib/custom-lists";
import { captureMembershipProfile } from "@/lib/membership-operations";
import { membershipFailureMessage } from "@/lib/membership-actions";
import { fetchSharedList } from "./featured-lists";

export type SaveListResult = { ok: boolean; already?: boolean; full?: boolean };

export async function saveList(handle: string, listId: string): Promise<SaveListResult> {
  const profile = captureMembershipProfile();
  if (!profile) throw new Error("The active profile changed. Open the menu again.");
  const list = await fetchSharedList(handle, listId);
  if (!list || !list.items || list.items.length === 0) throw new Error("save list: not found");
  const nameLc = list.name.trim().toLowerCase();
  const snapshot = readPersistedListSnapshot(profile);
  if ("status" in snapshot) throw new Error(membershipFailureMessage(snapshot));
  const existing = snapshot.containers;
  if (nameLc && existing.some((l) => l.name.trim().toLowerCase() === nameLc))
    return { ok: true, already: true };
  if (existing.length >= MAX_LISTS) return { ok: false, full: true };
  if (list.items.length > MAX_ITEMS) throw new Error("This destination is full.");
  const saved = createListWithItems(
    list.name || "Saved list",
    list.items.map((it) => ({ id: it.id, type: it.type, name: it.name, poster: it.poster })),
    profile,
    list.description,
  );
  if (!saved.id) throw new Error(membershipFailureMessage(saved.result));
  return { ok: true };
}
