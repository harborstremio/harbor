export type CastLease = Readonly<{ owner: "music" | "video"; generation: number }>;
type Owner = { lease: CastLease; stop: () => Promise<void> };
let current: Owner | null = null;
let generation = 0;
let transitions: Promise<unknown> = Promise.resolve();
let commands: Promise<unknown> = Promise.resolve();

function transition<T>(work: () => Promise<T>) {
  const result = transitions.then(work);
  transitions = result.catch(() => {});
  return result;
}

/** A replacement cannot own the native singleton until the prior owner acknowledges STOP. */
export function claimCastSession(
  owner: CastLease["owner"],
  stop: () => Promise<void>,
): Promise<CastLease> {
  return transition(async () => {
    const previous = current;
    if (previous) await previous.stop();
    await commands;
    const lease = Object.freeze({ owner, generation: ++generation });
    current = { lease, stop };
    return lease;
  });
}

export function ownsCastSession(lease: CastLease | null | undefined): boolean {
  return !!lease && current?.lease === lease;
}

/** Release only after STOP succeeded; stale cleanup cannot release a newer owner. */
export function releaseCastSession(lease: CastLease | null | undefined) {
  if (ownsCastSession(lease)) current = null;
}

/** Serialize native commands as well as ownership changes, and reject stale work before IPC. */
export function withCastSession<T>(lease: CastLease, work: () => Promise<T>): Promise<T> {
  const result = commands.then(async () => {
    if (!ownsCastSession(lease)) throw new Error("Cast session was replaced.");
    return work();
  });
  commands = result.catch(() => {});
  return result;
}

/** Used when local playback replaces another surface's remote session. */
export function stopCastOwner(owner: CastLease["owner"]): Promise<void> {
  return transition(async () => {
    const previous = current;
    if (previous?.lease.owner !== owner) return;
    await previous.stop();
    await commands;
    if (current === previous) current = null;
  });
}
