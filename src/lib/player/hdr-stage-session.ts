export const HDR_COLD_BOOT_TIMEOUT_MS = 12000;
export const HDR_LIVENESS_TIMEOUT_MS = 8000;
const MAX_BOOT_RETRIES = 2;
const MAX_LIVENESS_REOPENS = 3;

type Dependencies = {
  id: () => string;
  open: (id: string) => Promise<void>;
  show: (id: string) => Promise<boolean>;
  close: (id: string) => Promise<void>;
  ready: (handler: (id: string) => void) => Promise<() => void>;
  dead: (handler: (id: string) => void) => Promise<() => void>;
  confirmed: (active: boolean) => void;
  fallback: () => void;
  schedule: (callback: () => void, ms: number) => () => void;
};

/** One owner for boot, handoff, recovery and cancellation of the native HDR UI. */
export function startHdrStageSession(deps: Dependencies): () => void {
  let stopped = false;
  let stageId = "";
  let shown = false;
  let showing = false;
  let bootRetries = 0;
  let reopens = 0;
  let cancelTimer = () => {};
  const listeners: Array<() => void> = [];

  const arm = (ms: number, callback: () => void) => {
    cancelTimer();
    cancelTimer = deps.schedule(callback, ms);
  };
  const close = (id: string) => {
    if (id) void deps.close(id).catch(() => {});
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelTimer();
    for (const off of listeners) off();
    deps.confirmed(false);
    close(stageId);
  };
  const fail = () => {
    if (stopped) return;
    stop();
    deps.fallback();
  };
  const boot = async () => {
    shown = false;
    showing = false;
    deps.confirmed(false);
    const previous = stageId;
    const current = deps.id();
    stageId = current;
    arm(HDR_COLD_BOOT_TIMEOUT_MS, () => {
      if (bootRetries++ < MAX_BOOT_RETRIES) void boot();
      else fail();
    });
    try {
      if (previous) await deps.close(previous);
      if (stopped || stageId !== current) return;
      await deps.open(current);
      // Opening is asynchronous; exiting playback while WebView2 starts must
      // not leave a late window behind, nor close a newer session's window.
      if (stopped || stageId !== current) close(current);
    } catch {
      if (!stopped && stageId === current) fail();
    }
  };
  const lost = () => {
    if (reopens++ < MAX_LIVENESS_REOPENS) {
      bootRetries = 0;
      void boot();
    } else fail();
  };
  const ready = (id: string) => {
    if (stopped || id !== stageId) return;
    if (shown) {
      arm(HDR_LIVENESS_TIMEOUT_MS, lost);
      return;
    }
    if (showing) return;
    showing = true;
    void deps
      .show(id)
      .then((visible) => {
        if (stopped || id !== stageId) {
          close(id);
          return;
        }
        showing = false;
        if (!visible) {
          fail();
          return;
        }
        shown = true;
        deps.confirmed(true);
        arm(HDR_LIVENESS_TIMEOUT_MS, lost);
      })
      .catch(() => {
        if (!stopped && id === stageId) fail();
      });
  };

  void (async () => {
    try {
      for (const subscribe of [
        () => deps.ready(ready),
        () =>
          deps.dead((id) => {
            if (id === stageId) fail();
          }),
      ]) {
        const off = await subscribe();
        if (stopped) {
          off();
          return;
        }
        listeners.push(off);
      }
      await boot();
    } catch {
      fail();
    }
  })();
  return stop;
}
