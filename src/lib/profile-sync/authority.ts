/** Community sign-in must never become a second owner of a JL household. */
export function legacyProfileSyncAllowed(): boolean {
  // The public build setting covers startup before workspace reconciliation. The
  // marker also covers signed-out JL use and builds awaiting account configuration.
  if (import.meta.env?.VITE_JL_SUPABASE_URL) return false;
  try {
    return localStorage.getItem("jl.account.workspace.owner.v1") === null &&
      localStorage.getItem("jl.account.session.v1") === null;
  } catch {
    // An unreadable owner cannot authorize a competing roster writer.
    return false;
  }
}

export function assertLegacyProfileSyncAllowed(): void {
  if (!legacyProfileSyncAllowed()) {
    throw Object.assign(new Error("JL account profiles own this workspace."), { status: 403 });
  }
}
