import { useState } from "react";
import { useT } from "@/lib/i18n";
import { loginIdentity, registerIdentity } from "@/lib/account/identity";
import { authToken, currentAuthor, refreshTokenValue } from "@/lib/theme-auth";
import { SetupShell, type SetupChrome } from "./setup-shell";
import { SetupSlipway } from "./setup-slipway";
import {
  SetupButton,
  SetupCard,
  SetupDeliveryError,
  SetupError,
  SetupField,
  SetupForm,
  SetupHeading,
  SetupOk,
} from "./setup-ui";
import type { HandoffClientReject } from "@/lib/tv-handoff/handoff-client";
import type { DeliveryState } from "./use-setup-link";

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export type HarborSession = { session: string; handle: string; refresh: string | null };

function readSession(): HarborSession | null {
  const token = authToken();
  const author = currentAuthor();
  if (!token || !author) return null;
  return {
    session: token,
    handle: author.handle || author.username,
    refresh: refreshTokenValue(),
  };
}

function reachFailed(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  return typeof (e as { status?: number } | undefined)?.status !== "number";
}

export function SetupHarbor({
  chrome,
  delivery,
  reject,
  onDeliver,
  onRecovery,
  onRetry,
  onSkip,
  onContinue,
}: {
  chrome: SetupChrome;
  delivery: DeliveryState;
  reject: HandoffClientReject | null;
  onDeliver: (s: HarborSession) => void;
  onRecovery: (code: string, s: HarborSession) => void;
  onRetry: () => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = delivery === "confirmed";
  const nameOk = USERNAME_RE.test(username);
  const nameBad = username.length > 0 && !nameOk;
  const ready = nameOk && password.length >= 6;

  const submit = async () => {
    setError(null);
    if (!ready) return;
    setBusy(true);
    try {
      if (mode === "create") {
        const { recoveryCode } = await registerIdentity(username, password);
        setPassword("");
        const s = readSession();
        if (!s) {
          setError(t("Harbor signed you up but returned no session. Try signing in instead."));
          return;
        }
        onRecovery(recoveryCode, s);
        return;
      }
      await loginIdentity(username, password);
      setPassword("");
      const s = readSession();
      if (!s) {
        setError(t("Harbor accepted that but returned no session. Try again."));
        return;
      }
      onDeliver(s);
    } catch (e) {
      setError(
        reachFailed(e)
          ? t("Could not reach Harbor. Check your phone's connection and try again.")
          : ((e as { message?: string })?.message ?? t("That did not work. Check your details.")),
      );
    } finally {
      setBusy(false);
    }
  };

  const action = confirmed ? (
    <SetupButton onClick={onContinue}>{t("Continue")}</SetupButton>
  ) : (
    <>
      <SetupButton onClick={submit} busy={busy} disabled={!ready || delivery === "sending"}>
        {delivery === "sending"
          ? t("Sending to your TV")
          : mode === "create"
            ? t("Create account")
            : t("Sign in")}
      </SetupButton>
      <SetupButton variant="quiet" onClick={onSkip}>
        {t("Skip, I can do this later")}
      </SetupButton>
    </>
  );

  return (
    <SetupShell {...chrome} action={action}>
      <SetupSlipway step="harbor" built={chrome.built} won={confirmed} />
      <SetupHeading
        title={confirmed ? t("You are aboard.") : t("Your Harbor account")}
        body={
          confirmed
            ? undefined
            : t(
                "Syncs your profile, themes, lists and friends. Optional, and you can do it later.",
              )
        }
      />

      {confirmed ? (
        <SetupOk>{t("Your Harbor account is signed in on the TV.")}</SetupOk>
      ) : (
        <SetupForm onSubmit={submit}>
          <div className="flex gap-2" role="tablist">
            {(["create", "signin"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={`min-h-[48px] flex-1 rounded-xl border px-3 text-[15px] font-semibold ${
                  mode === m
                    ? "border-accent bg-accent-soft text-ink"
                    : "border-edge bg-surface text-ink-muted"
                }`}
              >
                {m === "create" ? t("Create account") : t("I have one")}
              </button>
            ))}
          </div>

          <SetupCard>
            <div className="flex flex-col gap-4">
              <SetupField
                label={t("Username")}
                hint={t("3 to 24 characters. Letters, numbers and underscores.")}
                value={username}
                onChange={(v) => {
                  setUsername(v);
                  setError(null);
                }}
                autoComplete="username"
                autoFocus
                enterKeyHint="next"
                invalid={nameBad || !!error}
              />
              <SetupField
                label={t("Password")}
                hint={mode === "create" ? t("At least 6 characters.") : undefined}
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  setError(null);
                  if (delivery === "timeout" || delivery === "offline") onRetry();
                }}
                type="password"
                autoComplete={mode === "create" ? "new-password" : "current-password"}
                enterKeyHint="go"
                invalid={!!error}
              />
            </div>
          </SetupCard>

          {nameBad && (
            <SetupError>
              {t("Usernames can only use letters, numbers and underscores, 3 to 24 long.")}
            </SetupError>
          )}
          {error && <SetupError>{error}</SetupError>}
          <SetupDeliveryError delivery={delivery} reject={reject} />
        </SetupForm>
      )}
    </SetupShell>
  );
}
