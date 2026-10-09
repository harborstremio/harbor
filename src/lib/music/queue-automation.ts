let session: { owner: symbol; started: boolean; stop: () => void } | null = null;

/** Explicit playback/queue edits own the player before any asynchronous work starts. */
export function cancelMusicQueueAutomation(): boolean {
  const previous = session;
  session = null;
  previous?.stop();
  return previous?.started ?? false;
}

export function ownMusicQueueAutomation(stop: () => void): symbol {
  cancelMusicQueueAutomation();
  const owner = Symbol("music queue");
  session = { owner, started: false, stop };
  return owner;
}

export const ownsMusicQueueAutomation = (owner: symbol): boolean => session?.owner === owner;
export const musicQueueAutomationStarted = (owner: symbol): boolean => session?.owner === owner && session.started;

export function markMusicQueueAutomationStarted(owner: symbol): void {
  if (session?.owner === owner) session.started = true;
}

export function releaseMusicQueueAutomation(owner: symbol): void {
  if (ownsMusicQueueAutomation(owner)) cancelMusicQueueAutomation();
}
