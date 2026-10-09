import { refreshToken, sessionRefreshDelay, subscribeAuthor } from "@/lib/theme-auth";

export function startSessionRefresh(): () => void {
  let stopped = false;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const schedule = () => {
    clearTimeout(timer);
    const delay = sessionRefreshDelay();
    if (!stopped && delay !== null) {
      timer = setTimeout(run, Math.max(navigator.onLine ? 1_000 : 30_000, delay));
    }
  };
  const run = async () => {
    if (stopped || running) return;
    const delay = sessionRefreshDelay();
    if (navigator.onLine && delay === 0) {
      running = true;
      try {
        await refreshToken();
      } finally {
        running = false;
      }
    }
    if (!stopped) schedule();
  };
  const onWake = () => {
    if (document.visibilityState === "visible") void run();
  };
  const unsubscribe = subscribeAuthor(schedule);
  window.addEventListener("online", run);
  window.addEventListener("focus", onWake);
  document.addEventListener("visibilitychange", onWake);
  void run();
  return () => {
    stopped = true;
    clearTimeout(timer);
    unsubscribe();
    window.removeEventListener("online", run);
    window.removeEventListener("focus", onWake);
    document.removeEventListener("visibilitychange", onWake);
  };
}
