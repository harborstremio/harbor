export type LockableProfile = { id: string; passwordHash?: string | null };

export function isProfileLocked(profile: LockableProfile | null | undefined): boolean {
  return typeof profile?.passwordHash === "string" && profile.passwordHash.length > 0;
}

/**
 * selectProfile does not check passwordHash today. The gate is duplicated in two UI call
 * sites (picker-modal.tsx and use-account-menu.ts), and there is a third caller that has
 * neither: RemoteOpenBridge calls selectProfile(id) straight off a harbor:remote-set-profile
 * event, so a paired phone walks past every profile PIN including a kid profile's.
 *
 * Move the gate into selectProfile and this helper is the whole decision:
 *
 *   if (refuseProfileSelect(target, sessionUnlockedIds, opts)) return false;
 *
 * Every existing gated caller keeps working unchanged because they already pass
 * { unlocked: true } after verifying, and the remote then fails closed with no edit.
 */
export function refuseProfileSelect(
  target: LockableProfile | null | undefined,
  sessionUnlockedIds: ReadonlySet<string>,
  opts?: { unlocked?: boolean },
): boolean {
  if (!target) return true;
  if (opts?.unlocked === true) return false;
  if (!isProfileLocked(target)) return false;
  return !sessionUnlockedIds.has(target.id);
}
