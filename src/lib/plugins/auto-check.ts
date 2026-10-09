import { isAndroidTv } from "@/lib/platform";
import { pluginKinds } from "./index";

const STAMP = "harbor.plugins.lastCheck.v1";
const DAY_MS = 86_400_000;
const BOOT_DELAY_MS = 60_000;

let timer: number | null = null;

async function refreshAll(): Promise<void> {
  for (const kind of pluginKinds()) {
    await kind.load().catch(() => undefined);
    for (const repo of kind.repos()) {
      await kind.refreshRepo(repo.url).catch(() => undefined);
    }
  }
}

export function schedulePluginAutoCheck(enabled: boolean): void {
  if (timer != null) {
    window.clearTimeout(timer);
    timer = null;
  }
  if (!enabled || typeof window === "undefined" || isAndroidTv()) return;
  let last = 0;
  try {
    last = Number(localStorage.getItem(STAMP) ?? 0);
  } catch {
    last = 0;
  }
  if (Date.now() - last < DAY_MS) return;
  timer = window.setTimeout(() => {
    timer = null;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;
    try {
      localStorage.setItem(STAMP, String(Date.now()));
    } catch {
      /* ignore */
    }
    void refreshAll();
  }, BOOT_DELAY_MS);
}
