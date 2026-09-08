import {
  MAX_COLLECTIONS,
  MAX_COLLECTION_ITEMS,
  readPersistedCollectionSnapshot,
  deleteCollectionWithResult,
  setCollectionSharedWithResult,
  type Collection,
} from "@/lib/collections";
import { isMembershipProfileCurrent, type MembershipProfile } from "@/lib/membership-operations";
import { authToken } from "@/lib/theme-auth";
import {
  notifyCommunityChanged,
  publishCollectionSnapshot,
  readOwnedCollectionMirror,
} from "@/lib/social/collections-sync";
import { queueCollectionPublication } from "@/lib/collection-publication-queue";

export async function setCollectionPublication(request: {
  collectionId: string;
  shared: boolean;
  profile: MembershipProfile;
  token: string;
}): Promise<void> {
  const { collectionId, shared, profile, token } = request;
  return queueCollectionPublication(profile, token, async () => {
    if (!isMembershipProfileCurrent(profile) || !token || authToken() !== token) {
      throw new Error("The active profile or Harbor account changed. Reopen the share dialog.");
    }
    const snapshot = readPersistedCollectionSnapshot(profile);
    if ("status" in snapshot)
      throw new Error(
        "Could not read saved collections safely. Resolve pending storage changes and try again.",
      );
    const collection = snapshot.containers.find((entry) => entry.id === collectionId);
    if (!collection) throw new Error("This collection no longer exists.");
    if (collection.sourceHandle || collection.sourceId)
      throw new Error("Only the original author can publish a saved community collection.");
    if (
      snapshot.containers.length > MAX_COLLECTIONS ||
      snapshot.containers.some((entry) => entry.items.length > MAX_COLLECTION_ITEMS)
    ) {
      throw new Error(
        "The collections exceed the publication limit. No collections were published.",
      );
    }
    const candidate = snapshot.containers.map((entry) =>
      entry.id === collectionId ? { ...entry, shared, updatedAt: Date.now() } : entry,
    );
    await publishCollectionSnapshot(candidate as unknown as Collection[], token);
    notifyCommunityChanged();
    if (!isMembershipProfileCurrent(profile) || authToken() !== token) {
      throw new Error(
        "The server accepted the publication change, but the local profile or account changed. Reopen this collection to reconcile its sharing state.",
      );
    }
    const saved = setCollectionSharedWithResult(collectionId, shared, profile, snapshot.raw);
    if (saved.status === "error") {
      throw new Error(
        "The server accepted the publication change, but local storage could not be updated. Your local collection was preserved; retry after resolving storage or concurrent edits.",
      );
    }
  });
}

export class CollectionMirrorUnavailableError extends Error {
  constructor() {
    super(
      "Your Harbor account copy could not be checked. Nothing was deleted. You can retry, or delete only the local copy and leave any account copy unchanged.",
    );
  }
}

export async function deleteCollectionAcknowledged(request: {
  collectionId: string;
  profile: MembershipProfile;
  token: string | null;
  localOnly?: boolean;
}): Promise<void> {
  const { collectionId, profile, token, localOnly = false } = request;
  return queueCollectionPublication(profile, localOnly ? null : token, async () => {
    const snapshot = readPersistedCollectionSnapshot(profile);
    if ("status" in snapshot)
      throw new Error(
        "Could not read saved collections safely. Reopen the menu after resolving storage changes.",
      );
    const collection = snapshot.containers.find((entry) => entry.id === collectionId);
    if (!collection) throw new Error("This collection no longer exists.");
    const authored = !collection.sourceHandle && !collection.sourceId;
    let accountRemoved = false;
    if (authored && !localOnly) {
      if (!token || authToken() !== token) throw new CollectionMirrorUnavailableError();
      let mirror: Collection[];
      try {
        mirror = await readOwnedCollectionMirror(token);
      } catch {
        throw new CollectionMirrorUnavailableError();
      }
      if (!isMembershipProfileCurrent(profile) || authToken() !== token)
        throw new Error(
          "The active profile or Harbor account changed. Reopen the collection action.",
        );
      const exists = mirror.some((entry) => entry.id === collectionId);
      const kept = mirror.filter((entry) => entry.id !== collectionId);
      if (
        exists &&
        (kept.length > MAX_COLLECTIONS ||
          kept.some((entry) => entry.items.length > MAX_COLLECTION_ITEMS))
      )
        throw new Error("The saved collections exceed the publication limit.");
      if (exists) {
        // Use the verified account mirror, never publish unrelated local-only collections here.
        await publishCollectionSnapshot(kept, token, kept.length === 0);
        accountRemoved = true;
        notifyCommunityChanged();
      }
      if (!isMembershipProfileCurrent(profile) || authToken() !== token)
        throw new Error(
          "The collection was unpublished, but the local profile or account changed. Your local collection was preserved.",
        );
    }
    const removed = deleteCollectionWithResult(collectionId, profile, snapshot.raw);
    if (removed.status === "error")
      throw new Error(
        accountRemoved
          ? "The collection was unpublished, but local deletion could not be saved. Your local collection was preserved; retry after resolving storage or concurrent edits."
          : "Could not save the collection deletion. Your local collection was preserved.",
      );
  });
}
