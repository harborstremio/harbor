import { useEffect, useState, useSyncExternalStore } from "react";
import { useT } from "@/lib/i18n";
import { DEFAULT_SYNC_ENDPOINT } from "@/lib/sync/api";
import {
  deleteSyncAccount,
  getSyncStatus,
  signInSync,
  signOutSync,
  signUpSync,
  subscribeSyncStatus,
  syncNow,
} from "@/lib/sync/engine";
import { loadSyncSession, setSyncEndpoint, syncEndpoint } from "@/lib/sync/session";
import { Section } from "../shared";
import { SyncAdoptionModal } from "./sync-adoption-modal";

type AuthMode = "signIn" | "create";
type PendingAction = "auth" | "sync" | "signOut" | "delete" | null;
type Translate = (key: string, vars?: Record<string, string | number>) => string;

const ERROR_KEYS: Record<string, string> = {
  invalid_credentials: "settings.sync.error.invalidCredentials",
  email_taken: "settings.sync.error.emailTaken",
  rate_limited: "settings.sync.error.rateLimited",
  unauthorized: "settings.sync.error.unauthorized",
  network: "settings.sync.error.network",
  network_failure: "settings.sync.error.network",
};

function syncErrorKey(error: unknown): string {
  if (typeof error === "string") {
    const normalized = error.toLowerCase();
    if (ERROR_KEYS[normalized]) return ERROR_KEYS[normalized];
    if (normalized.includes("network") || normalized.includes("fetch"))
      return "settings.sync.error.network";
    return "settings.sync.error.generic";
  }

  if (error instanceof TypeError) return "settings.sync.error.network";

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return syncErrorKey(error.code);
  }

  return "settings.sync.error.generic";
}

function relativeSyncTime(lastSyncAt: number | null, now: number, t: Translate): string {
  if (lastSyncAt === null) return t("settings.sync.never");

  const elapsedMinutes = Math.max(0, Math.floor((now - lastSyncAt) / 60_000));
  if (elapsedMinutes < 1) return t("settings.sync.justNow");
  if (elapsedMinutes < 60) return t("settings.sync.minutesAgo", { count: elapsedMinutes });

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return t("settings.sync.hoursAgo", { count: elapsedHours });

  return t("settings.sync.daysAgo", { count: Math.floor(elapsedHours / 24) });
}

/** Trimmed http(s) URL without trailing slashes, or null when unusable. */
function normalizeEndpoint(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.protocol === "http:" || url.protocol === "https:" ? trimmed : null;
  } catch {
    return null;
  }
}

export function HarborSyncCard() {
  const t = useT();
  const status = useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getSyncStatus);
  const [mode, setMode] = useState<AuthMode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // The hosted "Official" server isn't live yet, so custom is the only choice.
  const [serverMode, setServerMode] = useState<"official" | "custom">("custom");
  const [customServer, setCustomServer] = useState(() => {
    const endpoint = syncEndpoint();
    return endpoint === DEFAULT_SYNC_ENDPOINT ? "" : endpoint;
  });

  useEffect(() => {
    if (!status.signedIn || status.lastSyncAt === null) return;
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, [status.lastSyncAt, status.signedIn]);

  const busy = pending !== null || status.syncing || status.pendingAdoption !== null;
  const displayedError = errorKey ?? (status.error ? syncErrorKey(status.error) : null);
  const lastSynced = relativeSyncTime(status.lastSyncAt, now, t);

  const submitAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;

    if (mode === "create" && password !== confirmPassword) {
      setErrorKey("settings.sync.passwordsDoNotMatch");
      return;
    }

    // Persist the server choice before the engine reads it for this attempt.
    const normalized = normalizeEndpoint(customServer);
    if (!normalized) {
      setErrorKey("settings.sync.error.invalidEndpoint");
      return;
    }
    setSyncEndpoint(normalized);
    setCustomServer(normalized);

    setErrorKey(null);
    setPending("auth");
    try {
      if (mode === "create") {
        await signUpSync(email, password);
      } else {
        await signInSync(email, password);
      }
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setErrorKey(syncErrorKey(error));
    } finally {
      setPending(null);
    }
  };

  const runAction = async (
    action: Exclude<PendingAction, "auth" | null>,
    run: () => Promise<void>,
  ) => {
    if (busy) return;
    setErrorKey(null);
    setPending(action);
    try {
      await run();
    } catch (error) {
      setErrorKey(syncErrorKey(error));
    } finally {
      setPending(null);
    }
  };

  const submitDelete = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction("delete", async () => {
      await deleteSyncAccount(deletePassword);
      setDeletePassword("");
      setDeleteOpen(false);
    });
  };

  const inputClassName =
    "h-10 w-full rounded-xl border border-edge-soft bg-elevated px-3 text-[14px] text-ink outline-none transition-colors placeholder:text-ink-subtle/55 focus:border-ink";

  let serverLabel = t("settings.sync.serverOfficial");
  let serverDetail: string | null = null;
  if (status.signedIn) {
    const endpoint = loadSyncSession()?.endpoint ?? syncEndpoint();
    if (endpoint !== DEFAULT_SYNC_ENDPOINT) {
      serverLabel = t("settings.sync.serverCustom");
      try {
        serverDetail = new URL(endpoint).host;
      } catch {
        serverDetail = endpoint;
      }
    }
  }

  return (
    <Section title={t("settings.sync.title")} subtitle={t("settings.sync.subtitle")}>
      <div className="flex flex-col gap-4 rounded-2xl border border-edge-soft bg-canvas/40 p-5">
        {status.signedIn ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
                  {t("settings.sync.email")}
                </span>
                <span className="truncate font-mono text-[14.5px] text-ink">{status.email}</span>
              </div>
              <div className="flex flex-col text-end">
                <span className="text-[10.5px] font-semibold uppercase tracking-[0.16em] text-ink-subtle">
                  {t("settings.sync.lastSynced")}
                </span>
                <span className="text-[12.5px] text-ink-muted">{lastSynced}</span>
                <span title={serverDetail ?? undefined} className="text-[11px] text-ink-subtle">
                  {t("settings.sync.server")}: {serverLabel}
                  {serverDetail && <span className="text-ink-subtle/70"> · {serverDetail}</span>}
                </span>
              </div>
            </div>

            {displayedError && (
              <p
                role="alert"
                className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12.5px] text-danger"
              >
                {t(displayedError)}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-edge-soft/60 pt-3">
              <button
                type="button"
                onClick={() => runAction("sync", syncNow)}
                disabled={busy}
                className="flex h-10 items-center rounded-xl bg-ink px-4 text-[12.5px] font-semibold text-canvas transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {pending === "sync" || status.syncing
                  ? t("settings.sync.syncing")
                  : t("settings.sync.syncNow")}
              </button>
              <button
                type="button"
                onClick={() => runAction("signOut", signOutSync)}
                disabled={busy}
                className="flex h-10 items-center rounded-xl border border-edge-soft px-4 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink disabled:cursor-not-allowed disabled:opacity-55"
              >
                {pending === "signOut" ? t("settings.sync.signingOut") : t("settings.sync.signOut")}
              </button>
              <button
                type="button"
                onClick={() => setDeleteOpen((open) => !open)}
                disabled={busy}
                className="flex h-10 items-center rounded-xl border border-edge-soft px-4 text-[12.5px] font-medium text-ink-subtle transition-colors hover:border-danger/40 hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-55"
              >
                {t("settings.sync.deleteAccount")}
              </button>
            </div>

            {deleteOpen && (
              <form
                onSubmit={submitDelete}
                className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger/5 p-4"
              >
                <p className="text-[12.5px] leading-relaxed text-ink-muted">
                  {t("settings.sync.deleteWarning")}
                </p>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                    {t("settings.sync.password")}
                  </span>
                  <input
                    id="harbor-sync-delete-password"
                    type="password"
                    value={deletePassword}
                    onChange={(event) => setDeletePassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    disabled={busy}
                    className={inputClassName}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="flex h-10 items-center rounded-xl bg-danger px-4 text-[12.5px] font-semibold text-white transition-colors hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {pending === "delete"
                      ? t("settings.sync.deletingAccount")
                      : t("settings.sync.confirmDelete")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteOpen(false);
                      setDeletePassword("");
                    }}
                    disabled={busy}
                    className="flex h-10 items-center rounded-xl border border-edge-soft px-4 text-[12.5px] font-medium text-ink-muted transition-colors hover:border-edge hover:text-ink disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {t("settings.sync.cancel")}
                  </button>
                </div>
              </form>
            )}
          </>
        ) : (
          <form onSubmit={submitAuth} className="flex flex-col gap-4">
            <div className="flex w-fit flex-wrap gap-1 rounded-2xl bg-elevated/40 p-1 ring-1 ring-edge-soft/60">
              {(["signIn", "create"] as const).map((nextMode) => (
                <button
                  key={nextMode}
                  type="button"
                  onClick={() => {
                    setMode(nextMode);
                    setErrorKey(null);
                  }}
                  disabled={busy}
                  className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
                    mode === nextMode
                      ? "bg-ink text-canvas"
                      : "text-ink-muted hover:bg-raised hover:text-ink"
                  }`}
                >
                  {t(
                    nextMode === "signIn" ? "settings.sync.signIn" : "settings.sync.createAccount",
                  )}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-edge-soft/70 bg-elevated/30 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                  {t("settings.sync.server")}
                </span>
                <div className="flex gap-1 rounded-full bg-elevated/60 p-0.5 ring-1 ring-edge-soft/60">
                  <button
                    type="button"
                    disabled
                    aria-disabled="true"
                    title={t("settings.sync.serverComingSoon")}
                    className="flex cursor-not-allowed items-center gap-1.5 rounded-full px-3 py-1 text-[11.5px] font-semibold text-ink-subtle/60"
                  >
                    {t("settings.sync.serverOfficial")}
                    <span className="rounded-full bg-raised/80 px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-ink-subtle">
                      {t("settings.sync.serverComingSoon")}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setServerMode("custom");
                      setErrorKey(null);
                    }}
                    disabled={busy}
                    className={`rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:cursor-not-allowed disabled:opacity-55 ${
                      serverMode === "custom"
                        ? "bg-ink text-canvas"
                        : "text-ink-muted hover:bg-raised hover:text-ink"
                    }`}
                  >
                    {t("settings.sync.serverCustom")}
                  </button>
                </div>
              </div>
              <label className="flex flex-col gap-1.5">
                <span className="sr-only">{t("settings.sync.serverUrl")}</span>
                <input
                  id="harbor-sync-server-url"
                  type="url"
                  value={customServer}
                  onChange={(event) => setCustomServer(event.target.value)}
                  placeholder="https://sync.example.com"
                  autoComplete="url"
                  spellCheck={false}
                  required
                  disabled={busy}
                  className={inputClassName}
                />
              </label>
              <p className="text-[11.5px] leading-relaxed text-ink-subtle">
                {t("settings.sync.serverHint")}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                  {t("settings.sync.email")}
                </span>
                <input
                  id="harbor-sync-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  required
                  disabled={busy}
                  className={inputClassName}
                />
              </label>
              <label
                className={`flex flex-col gap-1.5 ${mode === "create" ? "" : "sm:col-span-2"}`}
              >
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                  {t("settings.sync.password")}
                </span>
                <input
                  id="harbor-sync-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "create" ? "new-password" : "current-password"}
                  required
                  disabled={busy}
                  className={inputClassName}
                />
              </label>
              {mode === "create" && (
                <label className="flex flex-col gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-subtle">
                    {t("settings.sync.confirmPassword")}
                  </span>
                  <input
                    id="harbor-sync-confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    required
                    disabled={busy}
                    className={inputClassName}
                  />
                </label>
              )}
            </div>

            {mode === "create" && (
              <p className="rounded-xl border border-edge-soft/70 bg-elevated/50 px-3 py-2 text-[12.5px] leading-relaxed text-ink-muted">
                {t("settings.sync.e2eWarning")}
              </p>
            )}

            {displayedError && (
              <p
                role="alert"
                className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2 text-[12.5px] text-danger"
              >
                {t(displayedError)}
              </p>
            )}

            <div>
              <button
                type="submit"
                disabled={busy}
                className="flex h-10 items-center rounded-xl bg-ink px-4 text-[13px] font-semibold text-canvas transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-55"
              >
                {pending === "auth"
                  ? mode === "create"
                    ? t("settings.sync.creatingAccount")
                    : t("settings.sync.signingIn")
                  : mode === "create"
                    ? t("settings.sync.createAccount")
                    : t("settings.sync.signIn")}
              </button>
            </div>
          </form>
        )}
      </div>
      {status.pendingAdoption && <SyncAdoptionModal summary={status.pendingAdoption} />}
    </Section>
  );
}
