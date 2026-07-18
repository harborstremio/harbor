import { useCallback, useEffect, useRef, useState } from "react";
import snip404 from "@/assets/snip404.svg";
import { HarborMark } from "@/components/icons/harbor-mark";
import { submitErrorReport } from "@/lib/bug-report";
import { loadStartupCrashReport, startupCrashToHarborError } from "@/lib/startup-crash";
import { isStaleTauriListenerError } from "@/lib/tauri-unlisten";

export type HarborError = {
  code: string;
  title: string;
  message: string;
  detail?: string;
  fatal?: boolean;
};

export function showHarborError(error: HarborError): void {
  window.dispatchEvent(new CustomEvent("harbor:error", { detail: error }));
}

const APP_VERSION = __APP_VERSION__;

function isNoisyError(reason: unknown, message?: string): boolean {
  const r = reason as { name?: string; message?: string } | undefined;
  const m = ((message || r?.message) ?? "").toLowerCase();
  if (isStaleTauriListenerError(reason ?? message)) return true;
  if (m.includes("resizeobserver loop")) return true;
  if (m.includes("non-error promise rejection")) return true;
  if (m.includes("the resource id") && m.includes("is invalid")) return true;
  if (m.includes("a listener indicated an asynchronous response")) return true;
  if (m.includes("the message port closed before a response was received")) return true;
  if (m.includes("script error")) return true;
  if (m.includes("network request failed")) return true;
  if (m.includes("load failed") && m.length < 30) return true;
  if (r?.name === "AbortError") return true;
  if (r?.name === "NetworkError") return true;
  return false;
}

type ReportState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; id: string }
  | { kind: "error"; message: string };

export function ErrorView() {
  const [error, setError] = useState<HarborError | null>(null);
  const [report, setReport] = useState<ReportState>({ kind: "idle" });

  useEffect(() => {
    let cancelled = false;
    const onError = (e: Event) => {
      const ce = e as CustomEvent<HarborError>;
      setError(ce.detail);
    };
    const onWindowError = (e: ErrorEvent) => {
      if (isNoisyError(e.error, e.message)) return;
      const err = e.error as Error | undefined;
      showHarborError({
        code: err?.name || "RuntimeError",
        title: "RuntimeError",
        message: e.message || err?.message || "An unexpected runtime error occurred.",
        detail: [
          `${err?.name ?? "Error"}: ${err?.message ?? e.message}`,
          err?.stack ? `\n${err.stack}` : "",
          `\nSource: ${e.filename}:${e.lineno}:${e.colno}`,
        ].join(""),
      });
    };
    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason as
        | { name?: string; message?: string; stack?: string }
        | string
        | undefined;
      const message =
        typeof reason === "string" ? reason : (reason?.message ?? "Unhandled promise rejection.");
      const name = typeof reason === "object" ? (reason?.name ?? "Rejection") : "Rejection";
      if (isNoisyError(reason, message)) return;
      showHarborError({
        code: name,
        title: "Promise rejection",
        message,
        detail: [
          `${name}: ${message}`,
          typeof reason === "object" && reason?.stack ? `\n${reason.stack}` : "",
        ].join(""),
      });
    };
    window.addEventListener("harbor:error", onError);
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    void loadStartupCrashReport().then((startupReport) => {
      if (!cancelled && startupReport) setError(startupCrashToHarborError(startupReport));
    });
    return () => {
      cancelled = true;
      window.removeEventListener("harbor:error", onError);
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    if (!error) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (error?.fatal) window.location.reload();
      else setError(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [error]);

  const dismiss = useCallback(() => {
    setError(null);
    setReport({ kind: "idle" });
  }, []);

  const reportBug = useCallback(async () => {
    if (!error || report.kind === "sending" || report.kind === "sent") return;
    setReport({ kind: "sending" });
    try {
      const { id } = await submitErrorReport({
        code: error.code,
        title: error.title,
        message: error.message,
        detail: error.detail,
      });
      setReport({ kind: "sent", id });
    } catch (e) {
      setReport({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    }
  }, [error, report.kind]);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  const goBack = useCallback(() => {
    if (error?.fatal) {
      window.location.reload();
      return;
    }
    dismiss();
  }, [error, dismiss]);

  if (!error) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-stretch overflow-y-auto bg-canvas lg:flex-row lg:items-center lg:overflow-hidden"
      style={{ animation: "harbor-fade-in 280ms cubic-bezier(0.32, 0.72, 0.24, 1) both" }}
    >
      <div
        data-tauri-drag-region
        className="pointer-events-none absolute start-5 top-4 z-10 flex select-none items-center gap-1 text-ink sm:start-7 sm:top-5"
      >
        <HarborMark className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" />
        <span
          className="font-display text-[24px] font-medium leading-none tracking-tight sm:text-[28px]"
          style={{ transform: "translateY(1px)" }}
        >
          Harb
          <span
            className="inline-block"
            style={{ transform: "rotate(7deg)", transformOrigin: "50% 65%" }}
          >
            o
          </span>
          r
        </span>
      </div>

      <img
        src={snip404}
        alt=""
        aria-hidden
        draggable={false}
        className="pointer-events-none mx-auto mt-20 h-auto w-[min(92vw,440px)] shrink-0 select-none sm:mt-24 lg:absolute lg:top-1/2 lg:start-[-4vw] lg:mx-0 lg:mt-0 lg:h-auto lg:w-[42vw] lg:-translate-y-1/2 xl:w-[46vw] xl:start-[-3vw] 2xl:w-[48vw] 2xl:start-[-2vw]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-[560px] flex-col gap-5 px-6 pb-10 pt-6 sm:gap-6 sm:px-8 lg:ms-auto lg:me-[8vw] lg:gap-7 lg:py-0">
        <h1 className="font-display text-[80px] font-medium leading-[0.9] tracking-tight text-ink drop-shadow-[0_4px_22px_rgba(0,0,0,0.45)] sm:text-[110px] lg:text-[148px] lg:leading-[0.86]">
          Oops..
        </h1>

        <p className="max-w-[460px] text-[14.5px] leading-relaxed text-ink-muted sm:text-[15.5px]">
          {error.message}
        </p>

        {error.detail && <TechnicalDetail content={buildReportBody(error)} />}

        <div className="mt-1 flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[13.5px] font-semibold text-canvas transition-colors hover:bg-accent/90"
          >
            <ArrowLeftIcon className="dir-icon h-[16px] w-[16px]" />
            Take me back
          </button>
          <button
            type="button"
            onClick={reportBug}
            disabled={report.kind === "sending" || report.kind === "sent"}
            className={`inline-flex h-11 items-center gap-2 rounded-full border px-5 text-[13.5px] font-medium transition-[background-color,border-color,color] disabled:cursor-default ${
              report.kind === "sent"
                ? "border-accent/55 bg-accent/15 text-accent"
                : report.kind === "error"
                  ? "border-danger/55 bg-danger/10 text-danger hover:border-danger"
                  : "border-edge-soft bg-elevated/60 text-ink hover:border-ink-subtle hover:bg-elevated"
            }`}
          >
            {report.kind === "sent" ? (
              <CheckIcon className="h-[15px] w-[15px]" />
            ) : (
              <BugIcon className="h-[15px] w-[15px]" />
            )}
            {report.kind === "sending"
              ? "Sending…"
              : report.kind === "sent"
                ? "Report sent"
                : report.kind === "error"
                  ? "Try again"
                  : "Submit report"}
          </button>
          <button
            type="button"
            onClick={reload}
            aria-label="Reload"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-elevated/60 hover:text-ink"
          >
            <ReloadIcon className="h-[15px] w-[15px]" />
          </button>
        </div>

        <p className="text-[11.5px] text-ink-subtle">
          {report.kind === "sent" ? (
            <>
              Thanks. Tracked as <span className="font-mono text-ink-muted">{report.id}</span>.
            </>
          ) : report.kind === "error" ? (
            <span className="text-danger/80">Could not send: {report.message}</span>
          ) : (
            <>Sends the context above straight to the Harbor team. No keys or library data.</>
          )}
        </p>
      </div>
    </div>
  );
}

function buildReportBody(error: HarborError): string {
  return [
    `Code: ${error.code}`,
    `Title: ${error.title}`,
    `Message: ${error.message}`,
    error.detail ? `\nDetail:\n${error.detail}` : "",
    "",
    `Time: ${new Date().toISOString()}`,
    `Path: ${window.location.pathname}${window.location.hash}`,
    `Version: ${APP_VERSION}`,
    `Platform: ${navigator.platform}`,
    `User-Agent: ${navigator.userAgent}`,
  ]
    .filter(Boolean)
    .join("\n");
}

function TechnicalDetail({ content }: { content: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | null>(null);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {}
  }, [content]);

  useEffect(() => {
    return () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    };
  }, []);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex w-fit items-center gap-2 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink"
      >
        <ChevronIcon
          className={`h-[10px] w-[10px] transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
        Technical detail
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "mt-3 grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="relative rounded-xl border border-edge-soft/60 bg-canvas/40">
            <button
              type="button"
              onClick={onCopy}
              aria-label={copied ? "Copied" : "Copy to clipboard"}
              title={copied ? "Copied" : "Copy"}
              className={`absolute end-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-full transition-[background-color,color,transform] active:scale-95 ${
                copied
                  ? "bg-accent/20 text-accent"
                  : "text-ink-subtle hover:bg-elevated/70 hover:text-ink"
              }`}
            >
              <span className="relative inline-flex h-[14px] w-[14px] items-center justify-center">
                <CopyIcon
                  className={`absolute inset-0 h-full w-full transition-[opacity,transform] duration-200 ${
                    copied ? "scale-50 opacity-0" : "scale-100 opacity-100"
                  }`}
                />
                <CheckIcon
                  className={`absolute inset-0 h-full w-full transition-[opacity,transform] duration-200 ${
                    copied ? "scale-100 opacity-100" : "scale-50 opacity-0"
                  }`}
                />
              </span>
            </button>
            <pre className="max-h-[300px] overflow-auto whitespace-pre-wrap break-words p-5 pe-14 font-mono text-[13.5px] leading-[1.6] text-ink">
              {content}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}

type IconProps = { className?: string };

function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="11 6 5 12 11 18" />
    </svg>
  );
}

function BugIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="13.5" rx="5.5" ry="6.5" />
      <path d="M9 6.8c0-1.7 1.4-3 3-3s3 1.3 3 3" />
      <line x1="9" y1="6.8" x2="5" y2="2.5" />
      <line x1="15" y1="6.8" x2="19" y2="2.5" />
      <path d="M3 11h3.5M17.5 11h3.5" />
      <path d="M3 17.5l3.5-1M17.5 16.5l3.5 1" />
      <path d="M12 8.5v11" opacity="0.4" />
    </svg>
  );
}

function ReloadIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.7 10A8.25 8.25 0 0 1 17.4 6.7L21 9.5" />
      <polyline points="16 9.5 21 9.5 21 4.5" />
      <path d="M20.3 14A8.25 8.25 0 0 1 6.6 17.3L3 14.5" />
      <polyline points="8 14.5 3 14.5 3 19.5" />
    </svg>
  );
}

function CopyIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
      <path d="M15 8.5V6a2 2 0 0 0-2-2H6.5a2 2 0 0 0-2 2v6.5a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function CheckIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="5 13 10 18 19 7" />
    </svg>
  );
}

function ChevronIcon({ className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4 2 8 6 4 10" />
    </svg>
  );
}
