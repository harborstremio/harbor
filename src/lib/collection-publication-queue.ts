import { authToken, currentAuthor } from "./theme-auth";
import { isMembershipProfileCurrent, type MembershipProfile } from "./membership-operations";

const queues = new Map<string, Promise<void>>();

/** All account-mirror writers hold this queue from fresh read through local acknowledgement. */
export function queueCollectionPublication<T>(
  profile: MembershipProfile,
  token: string | null,
  operation: () => Promise<T>,
): Promise<T> {
  const author = currentAuthor();
  // Token refresh must not open a second queue for the same account.
  const key = author?.id
    ? `account:${author.id}`
    : author?.handle
      ? `handle:${author.handle.toLowerCase()}`
      : (token ?? authToken() ?? `local:${profile.activeId ?? "default"}`);
  const previous = queues.get(key) ?? Promise.resolve();
  const result = previous.then(async () => {
    if (!isMembershipProfileCurrent(profile) || (token != null && authToken() !== token))
      throw new Error(
        "The active profile or Harbor account changed. Reopen the collection action.",
      );
    return operation();
  });
  const settled = result.then(
    () => {},
    () => {},
  );
  queues.set(key, settled);
  void settled.then(() => {
    if (queues.get(key) === settled) queues.delete(key);
  });
  return result;
}
