/** Account ownership is part of every local-to-remote profile binding. Names are display data. */
export type JlLink = { accountId: string; profileId: string; name: string; merged: boolean };
export type LinkState = JlLink & { status: "linked" | "pending" | "manual" };
const PREFIX = "jl.account.link.v2.";
const LEGACY_PREFIX = "jl.account.link.v1.";

export function createJlLinkStore(storage: Pick<Storage, "getItem" | "setItem">) {
  const cache = new Map<string, { raw: string | null; state: LinkState | null; memoryOnly?: boolean }>();
  const listeners = new Set<() => void>();
  let revision = 0;
  function read(localId: string): LinkState | null {
    const previous = cache.get(localId);
    if (previous?.memoryOnly) return previous.state;
    let raw: string | null;
    try { raw = storage.getItem(`${PREFIX}${localId}`); }
    catch { return previous?.state ?? null; }
    if (previous?.raw === raw) return previous.state;
    let state: LinkState | null = null;
    try {
      const v = raw ? JSON.parse(raw) as LinkState : null;
      if (v && typeof v.accountId === "string" && typeof v.profileId === "string" &&
          typeof v.name === "string" && ["linked", "pending", "manual"].includes(v.status)) {
        state = { accountId: v.accountId, profileId: v.profileId, name: v.name, merged: v.merged === true, status: v.status };
      }
    } catch { /* An untrusted/damaged link must be selected again. */ }
    if (previous) revision++;
    cache.set(localId, { raw, state });
    return state;
  }
  function write(localId: string, state: LinkState, requirePersistence = false): void {
    const raw = JSON.stringify(state);
    let memoryOnly = false;
    try { storage.setItem(`${PREFIX}${localId}`, raw); } catch (error) {
      if (requirePersistence) throw error;
      memoryOnly = true;
    }
    cache.set(localId, { raw, state, memoryOnly });
    revision++;
    for (const listener of listeners) listener();
  }
  return {
    read, write,
    revision: () => revision,
    link(localId: string, accountId: string): JlLink | null {
      const state = read(localId);
      return state?.accountId === accountId && state.status === "linked" ? state : null;
    },
    canAutoCreate(localId: string, accountId: string): boolean {
      const state = read(localId);
      if (state) return state.accountId === accountId && state.status === "pending";
      // V1 has no owner: never migrate by assuming that the current account owns it.
      try { return storage.getItem(`${LEGACY_PREFIX}${localId}`) === null; } catch { return false; }
    },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    changedExternally() { cache.clear(); revision++; for (const listener of listeners) listener(); },
  };
}
