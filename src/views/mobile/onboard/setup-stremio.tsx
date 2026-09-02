import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useT } from "@/lib/i18n";
import { login } from "@/lib/stremio";
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

function isReachFailure(e: unknown): boolean {
  if (e instanceof TypeError) return true;
  const msg = (e as { message?: string } | undefined)?.message ?? "";
  return /failed to fetch|load failed|networkerror|invalid response|failed \(\d+\)/i.test(msg);
}

export function SetupStremio({
  chrome,
  delivery,
  reject,
  onDeliver,
  onRetry,
  onSkip,
  onContinue,
}: {
  chrome: SetupChrome;
  delivery: DeliveryState;
  reject: HandoffClientReject | null;
  onDeliver: (authKey: string) => void;
  onRetry: () => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = delivery === "confirmed";
  const ready = email.trim().length > 2 && password.length > 0;

  const submit = async () => {
    setError(null);
    if (!ready) return;
    setBusy(true);
    try {
      const res = await login(email.trim(), password);
      setPassword("");
      onDeliver(res.authKey);
    } catch (e) {
      setError(
        isReachFailure(e)
          ? t("Could not reach Stremio. Check your phone's connection and try again.")
          : ((e as { message?: string })?.message ??
            t("Stremio did not accept that email and password.")),
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
        {delivery === "sending" ? t("Sending to your TV") : t("Sign in")}
      </SetupButton>
      <SetupButton variant="quiet" onClick={onSkip}>
        {t("Not now")}
      </SetupButton>
    </>
  );

  return (
    <SetupShell {...chrome} action={action}>
      <SetupSlipway step="stremio" built={chrome.built} won={confirmed} />
      <SetupHeading
        title={confirmed ? t("Your library is aboard.") : t("Bring in your Stremio library")}
        body={
          confirmed
            ? undefined
            : t("Your Continue Watching, your watchlist and your addons, on this TV.")
        }
      />

      {confirmed ? (
        <SetupOk>{t("Signed in. Your library is on the TV.")}</SetupOk>
      ) : (
        <SetupForm onSubmit={submit}>
          <SetupCard>
            <div className="flex flex-col gap-4">
              <SetupField
                label={t("Email")}
                value={email}
                onChange={(v) => {
                  setEmail(v);
                  setError(null);
                }}
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder={t("you@example.com")}
                autoFocus
                enterKeyHint="next"
                invalid={!!error}
              />
              <SetupField
                label={t("Password")}
                value={password}
                onChange={(v) => {
                  setPassword(v);
                  setError(null);
                  if (delivery === "timeout" || delivery === "offline") onRetry();
                }}
                type="password"
                autoComplete="current-password"
                enterKeyHint="go"
                invalid={!!error}
              />
            </div>
          </SetupCard>

          <p className="flex items-start gap-2 px-1 text-[13px] leading-relaxed text-ink-subtle">
            <ShieldCheck size={16} className="mt-0.5 shrink-0" />
            <span>
              {t(
                "Your password stays on this phone. Only the sign-in token Stremio returns is sent to your TV.",
              )}
            </span>
          </p>

          {error && <SetupError>{error}</SetupError>}
          <SetupDeliveryError delivery={delivery} reject={reject} />
        </SetupForm>
      )}
    </SetupShell>
  );
}
