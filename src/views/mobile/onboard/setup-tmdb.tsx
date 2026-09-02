import { useState } from "react";
import { useT } from "@/lib/i18n";
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
  SetupLinkOut,
  SetupOk,
  SetupWalkthrough,
} from "./setup-ui";
import type { HandoffClientReject } from "@/lib/tv-handoff/handoff-client";
import type { DeliveryState } from "./use-setup-link";

const TMDB_API_SETTINGS = "https://www.themoviedb.org/settings/api";
const TMDB_SIGNUP = "https://www.themoviedb.org/signup";
const VALIDATE_TIMEOUT_MS = 12000;

type Check = { ok: true } | { ok: false; kind: "rejected" | "offline" };

async function checkKey(key: string): Promise<Check> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), VALIDATE_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/configuration?api_key=${encodeURIComponent(key)}`,
      { signal: ctrl.signal },
    );
    return res.ok ? { ok: true } : { ok: false, kind: "rejected" };
  } catch {
    return { ok: false, kind: "offline" };
  } finally {
    clearTimeout(timer);
  }
}

/** The single most common paste on this screen is the v4 Read Access Token, a
    long JWT from the same page. Naming it beats a generic rejection. */
function looksLikeV4Token(key: string): boolean {
  return key.startsWith("eyJ") || key.length > 60;
}

export function SetupTmdb({
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
  onDeliver: (key: string) => void;
  onRetry: () => void;
  onSkip: () => void;
  onContinue: () => void;
}) {
  const t = useT();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmed = delivery === "confirmed";
  const trimmed = key.replace(/\s+/g, "");

  const submit = async () => {
    setError(null);
    if (!trimmed) return;
    if (looksLikeV4Token(trimmed)) {
      setError(
        t(
          'That looks like the v4 Read Access Token. Harbor needs the shorter "API Key (v3 auth)" from the same page.',
        ),
      );
      return;
    }
    setBusy(true);
    const result = await checkKey(trimmed);
    setBusy(false);
    if (result.ok) {
      onDeliver(trimmed);
      return;
    }
    setError(
      result.kind === "rejected"
        ? t(
            'TMDB did not accept that key. Check you copied the "API Key (v3 auth)" value, not the read access token.',
          )
        : t("Could not reach TMDB. Check your phone's connection and try again."),
    );
  };

  const action = confirmed ? (
    <SetupButton onClick={onContinue}>{t("Continue")}</SetupButton>
  ) : (
    <>
      <SetupButton onClick={submit} busy={busy} disabled={!trimmed || delivery === "sending"}>
        {delivery === "sending" ? t("Sending to your TV") : t("Connect TMDB")}
      </SetupButton>
      <SetupButton variant="quiet" onClick={onSkip}>
        {t("Do this later")}
      </SetupButton>
    </>
  );

  return (
    <SetupShell {...chrome} action={action}>
      <SetupSlipway step="tmdb" built={chrome.built} won={confirmed} />
      <SetupHeading
        title={confirmed ? t("TMDB is aboard.") : t("Connect TMDB")}
        body={
          confirmed
            ? undefined
            : t(
                "Free, about two minutes. It unlocks Trending, In Theaters, Top Rated and every streaming service row.",
              )
        }
      />

      {confirmed ? (
        <SetupOk>{t("TMDB is connected. Your TV has it.")}</SetupOk>
      ) : (
        <SetupForm onSubmit={submit}>
          <SetupCard>
            <div className="flex flex-col gap-2.5">
              <SetupLinkOut
                href={TMDB_API_SETTINGS}
                label={t("I already have a TMDB account")}
                detail={t("Opens your API settings page")}
              />
              <SetupLinkOut
                href={TMDB_SIGNUP}
                label={t("I need to sign up")}
                detail={t("Opens the free signup page")}
              />
            </div>
          </SetupCard>

          <SetupCard title={t("Where to find the key")}>
            <SetupWalkthrough
              steps={[
                t("On themoviedb.org, open Settings."),
                t("Choose API in the left sidebar."),
                t('Select "Request an API key" and pick Developer.'),
                t('Copy the value labelled "API Key (v3 auth)".'),
              ]}
            />
          </SetupCard>

          <SetupCard>
            <SetupField
              label={t("API key")}
              hint={t("Long-press the box to paste.")}
              value={key}
              onChange={(v) => {
                setKey(v);
                setError(null);
                if (delivery === "timeout" || delivery === "offline") onRetry();
              }}
              placeholder={t("Paste your v3 API key")}
              mono
              autoFocus
              enterKeyHint="go"
              invalid={!!error}
            />
          </SetupCard>

          {error && <SetupError>{error}</SetupError>}
          <SetupDeliveryError delivery={delivery} reject={reject} />
        </SetupForm>
      )}
    </SetupShell>
  );
}
