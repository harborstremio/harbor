import { invoke } from "@tauri-apps/api/core";

export type NativeMem = {
  harborRss: number;
  webviewRss: number;
  total: number;
  totalPhys: number;
};

export type RamTier = "tiny" | "low" | "mid" | "high";

const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const MB = 1024 * 1024;

let latest: NativeMem = { harborRss: 0, webviewRss: 0, total: 0, totalPhys: 0 };
let tier: RamTier = "high";
let tierResolved = false;
let timer: number | null = null;
let intervalMs = 8000;
const HIDDEN_INTERVAL_MS = 30000;
let sampling = false;
const listeners = new Set<() => void>();

function classifyTier(totalPhysBytes: number): RamTier {
  if (totalPhysBytes <= 0) {
    const dm = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    if (typeof dm === "number") {
      if (dm <= 1) return "tiny";
      if (dm <= 2) return "low";
      if (dm <= 4) return "mid";
    }
    return "high";
  }
  const gb = totalPhysBytes / (1024 * MB);
  if (gb < 1.5) return "tiny";
  if (gb < 3) return "low";
  if (gb < 6) return "mid";
  return "high";
}

async function sample(): Promise<void> {
  if (!isTauri || sampling) return;
  sampling = true;
  try {
    const m = await invoke<NativeMem>("harbor_process_memory");
    latest = {
      harborRss: m.harborRss / MB,
      webviewRss: m.webviewRss / MB,
      total: m.total / MB,
      totalPhys: m.totalPhys,
    };
    if (!tierResolved && m.totalPhys > 0) {
      tier = classifyTier(m.totalPhys);
      tierResolved = true;
    }
    for (const fn of listeners) {
      try {
        fn();
      } catch {}
    }
  } catch {
    // Sampling is best-effort; failing to read a process once must not stop the
    // memory guard from recovering on the next interval.
  } finally {
    sampling = false;
  }
}

export function startNativeMemory(): () => void {
  if (!isTauri || timer != null) return () => {};
  const arm = () => {
    const delay = document.visibilityState === "hidden" ? HIDDEN_INTERVAL_MS : intervalMs;
    timer = window.setTimeout(() => {
      void sample();
      arm();
    }, delay);
  };
  const onVisibility = () => {
    if (timer != null) window.clearTimeout(timer);
    timer = null;
    if (document.visibilityState === "visible") void sample();
    arm();
  };
  void sample();
  arm();
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    if (timer != null) window.clearTimeout(timer);
    timer = null;
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

export function setNativeMemoryActive(active: boolean): void {
  intervalMs = active ? 2500 : 8000;
}

export function getNativeMem(): NativeMem {
  return latest;
}

export function getNativeRssMB(): number {
  return latest.total;
}

export function getRamTier(): RamTier {
  return tier;
}

export function subscribeNativeMemory(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
