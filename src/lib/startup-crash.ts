import type { HarborError } from "@/components/error-view";

export type StartupCrashReport = {
  kind: "panic";
  version: string;
  platform: string;
  message: string | null;
  location: string | null;
  backtrace: string | null;
};

let startupReportPromise: Promise<StartupCrashReport | null> | null = null;

export function loadStartupCrashReport(): Promise<StartupCrashReport | null> {
  if (!("__TAURI_INTERNALS__" in window)) return Promise.resolve(null);
  startupReportPromise ??= import("@tauri-apps/api/core")
    .then(({ invoke }) => invoke<StartupCrashReport | null>("take_startup_crash_report"))
    .catch(() => null);
  return startupReportPromise;
}

export function startupCrashToHarborError(report: StartupCrashReport): HarborError {
  return {
    code: "NativePanic",
    title: "Previous native crash",
    message:
      "Sorry — Harbor crashed the last time it was running. You can review the details and choose whether to send a report.",
    detail: [
      `Version: ${report.version}`,
      `Platform: ${report.platform}`,
      report.message ? `Message: ${report.message}` : "",
      report.location ? `Location: ${report.location}` : "",
      report.backtrace ? `Backtrace:\n${report.backtrace}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    fatal: false,
  };
}
