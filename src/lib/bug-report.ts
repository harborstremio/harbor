import { HARBOR_BUGS_BASE } from "@/lib/config/endpoints";

declare const __APP_VERSION__: string;

const ENDPOINT =
  (import.meta.env.VITE_BUG_REPORT_ENDPOINT as string | undefined) || HARBOR_BUGS_BASE;

export type Severity = "low" | "normal" | "high" | "critical";

export type BugReportInput = {
  summary: string;
  severity: Severity;
  steps: string;
  expected: string;
  actual: string;
  reporterName: string;
  reporterGithub: string;
  reporterContact: string;
  consentCredit: boolean;
  files: File[];
};

export type Diagnostics = {
  appVersion: string;
  os: string;
  osVersion: string;
  ua: string;
  viewport: string;
  locale: string;
  flags: {
    playerEngine: string;
    region: string;
    hasTmdb: boolean;
    hasRpdb: boolean;
    hasTrakt: boolean;
    hasStremio: boolean;
    debridCount: number;
    addonCount: number;
    iptvCount: number;
  };
  recentErrors: Array<{ ts: number; msg: string; src?: string }>;
};

const ERR_BUFFER: Array<{ ts: number; msg: string; src?: string }> = [];
const MAX_ERRORS = 50;
let installed = false;

export function installBugReportErrorCapture() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => {
    push(
      `${e.message}${e.filename ? ` (${e.filename}:${e.lineno ?? "?"})` : ""}`,
      "window.onerror",
    );
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason as unknown;
    const msg = r instanceof Error ? `${r.name}: ${r.message}` : String(r);
    push(msg, "unhandledrejection");
  });
}

function push(msg: string, src?: string) {
  ERR_BUFFER.push({ ts: Date.now(), msg: msg.slice(0, 600), src });
  while (ERR_BUFFER.length > MAX_ERRORS) ERR_BUFFER.shift();
}

export function getRecentErrors() {
  return ERR_BUFFER.slice();
}

export async function collectDiagnostics(opts: {
  playerEngine: string;
  region: string;
  hasTmdb: boolean;
  hasRpdb: boolean;
  hasTrakt: boolean;
  hasStremio: boolean;
  debridCount: number;
  addonCount: number;
  iptvCount: number;
}): Promise<Diagnostics> {
  let osName = "unknown";
  let osVer = "";
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (/windows nt 10/i.test(ua)) osName = "Windows";
  else if (/mac os x/i.test(ua)) osName = "macOS";
  else if (/linux/i.test(ua)) osName = "Linux";
  try {
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      const modName = "@tauri-apps/plugin-os";
      const osMod: { platform?: () => Promise<string>; version?: () => Promise<string> } =
        await import(/* @vite-ignore */ modName).catch(() => ({}));
      try {
        osName = (await osMod.platform?.()) || osName;
      } catch {}
      try {
        osVer = (await osMod.version?.()) || "";
      } catch {}
    }
  } catch {}

  const viewport =
    typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "";

  return {
    appVersion: typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev",
    os: osName,
    osVersion: osVer,
    ua,
    viewport,
    locale: typeof navigator !== "undefined" ? navigator.language : "",
    flags: opts,
    recentErrors: getRecentErrors().slice(-20),
  };
}

export async function submitErrorReport(args: {
  code: string;
  title: string;
  message: string;
  detail?: string;
}): Promise<{ id: string }> {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const winMatch = ua.match(/Windows NT ([\d.]+)/i);
  const macMatch = ua.match(/Mac OS X ([\d_.]+)/i);
  let os = "unknown";
  let osVersion = "";
  if (winMatch) {
    os = "Windows";
    osVersion = winMatch[1] === "10.0" ? "10/11" : winMatch[1];
  } else if (macMatch) {
    os = "macOS";
    osVersion = macMatch[1].replace(/_/g, ".");
  } else if (/linux/i.test(ua)) {
    os = "Linux";
  }
  const summary = `[${args.code}] ${args.title}: ${args.message}`.slice(0, 240);
  const fd = new FormData();
  fd.set("summary", summary);
  fd.set("severity", "high");
  fd.set("steps", "");
  fd.set("expected", "");
  fd.set("actual", args.message);
  fd.set("reporter_name", "");
  fd.set("reporter_github", "");
  fd.set("reporter_contact", "");
  fd.set("consent_credit", "0");
  fd.set("app_version", typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "dev");
  fd.set("os", os);
  fd.set("os_version", osVersion);
  fd.set("ua", ua);
  fd.set(
    "viewport",
    typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "",
  );
  fd.set("locale", typeof navigator !== "undefined" ? navigator.language : "");
  fd.set(
    "diagnostics",
    JSON.stringify({
      source: "auto-error-report",
      code: args.code,
      title: args.title,
      detail: args.detail || null,
      path: typeof window !== "undefined" ? window.location.pathname + window.location.hash : "",
      recentErrors: getRecentErrors().slice(-20),
    }),
  );
  const res = await fetch(`${ENDPOINT}/v1/reports`, { method: "POST", body: fd });
  if (!res.ok) {
    const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(j.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as { id: string };
}

export async function submitBugReport(
  input: BugReportInput,
  diag: Diagnostics,
): Promise<{ id: string }> {
  const fd = new FormData();
  fd.set("summary", input.summary);
  fd.set("severity", input.severity);
  fd.set("steps", input.steps);
  fd.set("expected", input.expected);
  fd.set("actual", input.actual);
  fd.set("reporter_name", input.reporterName);
  fd.set("reporter_github", input.reporterGithub);
  fd.set("reporter_contact", input.reporterContact);
  fd.set("consent_credit", input.consentCredit ? "1" : "0");
  fd.set("app_version", diag.appVersion);
  fd.set("os", diag.os);
  fd.set("os_version", diag.osVersion);
  fd.set("ua", diag.ua);
  fd.set("viewport", diag.viewport);
  fd.set("locale", diag.locale);
  fd.set("diagnostics", JSON.stringify({ flags: diag.flags, recentErrors: diag.recentErrors }));
  for (const f of input.files) fd.append("files", f, f.name);

  const res = await fetch(`${ENDPOINT}/v1/reports`, { method: "POST", body: fd });
  if (!res.ok) {
    const j = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(j.error || `HTTP ${res.status}`);
  }
  return (await res.json()) as { id: string };
}
