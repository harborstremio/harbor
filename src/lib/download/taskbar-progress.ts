import { isTauri } from "@tauri-apps/api/core";
import { downloadsSnapshot, subscribeDownloads, type DownloadItem } from "./downloads-store";

type BarStatus = "none" | "normal" | "indeterminate" | "paused";
type Bar = { status: BarStatus; progress?: number };

function compute(items: DownloadItem[]): Bar {
  const active = items.filter((d) => d.status === "downloading" || d.status === "paused");
  if (active.length === 0) return { status: "none" };
  const running = active.some((d) => d.status === "downloading");
  const sized = active.filter((d) => typeof d.totalBytes === "number" && d.totalBytes > 0);
  if (sized.length === 0) return { status: running ? "indeterminate" : "paused" };
  const total = sized.reduce((n, d) => n + (d.totalBytes ?? 0), 0);
  const got = sized.reduce((n, d) => n + d.receivedBytes, 0);
  const progress = Math.max(0, Math.min(100, Math.round((got / total) * 100)));
  return { status: running ? "normal" : "paused", progress };
}

async function push(bar: Bar): Promise<void> {
  const { getCurrentWindow, ProgressBarStatus } = await import("@tauri-apps/api/window");
  const status = {
    none: ProgressBarStatus.None,
    normal: ProgressBarStatus.Normal,
    indeterminate: ProgressBarStatus.Indeterminate,
    paused: ProgressBarStatus.Paused,
  }[bar.status];
  await getCurrentWindow().setProgressBar({ status, progress: bar.progress });
}

let started = false;
let last = "";
let pending: Bar | null = null;
let flushing = false;

async function flush(): Promise<void> {
  if (flushing || !pending) return;
  flushing = true;
  const bar = pending;
  pending = null;
  try {
    await push(bar);
  } catch {
    /* window gone, or a platform with no taskbar progress */
  }
  flushing = false;
  if (pending) void flush();
}

function apply(bar: Bar): void {
  const key = `${bar.status}:${bar.progress ?? ""}`;
  if (key === last) return;
  last = key;
  pending = bar;
  void flush();
}

export function startTaskbarProgress(): void {
  if (started || !isTauri()) return;
  started = true;
  const tick = () => apply(compute(downloadsSnapshot()));
  subscribeDownloads(tick);
  window.addEventListener("beforeunload", () => {
    void push({ status: "none" }).catch(() => {});
  });
  tick();
}
