import type { LibraryItem } from "../stremio";

export const JL_LIBRARY_CHANGED = "jl:library-changed";
export const JL_LIBRARY_PREFIX = "harbor.jl.library.v1.";
const SCOPE_PREFIX = "jl-local:";

/** An opaque local routing key, never a credential or network authorization token. */
export function localLibraryScope(profileId: string): string {
  return SCOPE_PREFIX + encodeURIComponent(profileId || "default");
}

export function profileFromLocalScope(scope: string): string {
  if (!scope.startsWith(SCOPE_PREFIX))
    throw new Error("Choose a JL profile to access its library.");
  const id = decodeURIComponent(scope.slice(SCOPE_PREFIX.length));
  if (!id) throw new Error("No JL profile selected.");
  return id;
}

export function activeLocalLibraryScope(): string {
  let id = "default";
  try {
    const raw = localStorage.getItem("harbor.profiles.v1");
    const state = raw ? JSON.parse(raw) : null;
    if (typeof state?.activeId === "string" && state.activeId) id = state.activeId;
  } catch {
    /* The local default remains usable before onboarding. */
  }
  return localLibraryScope(id);
}

export function readJlLibrary(scope: string): LibraryItem[] {
  const key = JL_LIBRARY_PREFIX + profileFromLocalScope(scope);
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  const items: unknown = JSON.parse(raw);
  if (!Array.isArray(items)) throw new Error("The local library needs recovery from a backup.");
  return items.filter(
    (item): item is LibraryItem =>
      !!item && typeof item === "object" && typeof item._id === "string",
  );
}

export function putJlLibraryItem(scope: string, item: LibraryItem): void {
  const profileId = profileFromLocalScope(scope);
  if (!item._id) throw new Error("A library item needs its provider ID.");
  const items = readJlLibrary(scope);
  const index = items.findIndex((current) => current._id === item._id);
  if (index < 0) items.push(item);
  else items[index] = item;
  // A quota failure must propagate so callers can report and retry the write.
  localStorage.setItem(JL_LIBRARY_PREFIX + profileId, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(JL_LIBRARY_CHANGED, { detail: { profileId } }));
}
