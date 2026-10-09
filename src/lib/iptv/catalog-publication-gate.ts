type Schedule = (task: () => void) => void;

function scheduleNextPaint(task: () => void): void {
  const hidden = typeof document !== "undefined" && document.hidden;
  if (!hidden && typeof requestAnimationFrame === "function") {
    requestAnimationFrame(() => task());
    return;
  }
  setTimeout(task, 0);
}

export function createCatalogPublicationGate<T>(
  publish: (items: readonly T[]) => void,
  schedule: Schedule = scheduleNextPaint,
) {
  let latest: readonly T[] | null = null;
  let releaseRequested = false;
  let released = false;
  let scheduled = false;
  let resolveReleased: (() => void) | null = null;
  const releasedPromise = new Promise<void>((resolve) => {
    resolveReleased = resolve;
  });

  const scheduleRelease = () => {
    if (released || scheduled || !releaseRequested || latest == null) return;
    scheduled = true;
    schedule(() => {
      scheduled = false;
      released = true;
      if (latest != null) publish(latest);
      resolveReleased?.();
      resolveReleased = null;
    });
  };

  return {
    update(items: readonly T[]) {
      latest = items;
      if (released) publish(items);
      else scheduleRelease();
    },
    release() {
      releaseRequested = true;
      scheduleRelease();
    },
    whenReleased() {
      return releasedPromise;
    },
  };
}
