import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import type { BpOnboardStepProps } from "../../bp-onboarding-frame";
import { useBpT } from "../../bp-i18n";
import { BpOnboardField } from "../bp-onboard-field";
import { BpOnboardKeyboard } from "../bp-onboard-keyboard";
import { BpStremioShowcase } from "../bp-stremio-showcase";
import {
  BpDecisionAction,
  BpDecisionNote,
  BpDecisionRow,
  BpDecisionScroll,
  BpStepConfirmed,
} from "../bp-step-parts";

const MAX = 120;

export function BpStepStremio({ setSatisfied, setPrimaryGuard }: BpOnboardStepProps) {
  const t = useBpT();
  const { user, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [active, setActive] = useState<"email" | "password">("email");
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signedIn = user !== null;
  useEffect(() => {
    setSatisfied(signedIn);
  }, [signedIn, setSatisfied]);

  const write = (next: string) => {
    setError(null);
    if (active === "email") setEmail(next.slice(0, MAX));
    else setPassword(next.slice(0, MAX));
  };
  const current = active === "email" ? email : password;

  const submit = async (): Promise<boolean> => {
    if (!email.trim() || !password || busy) return false;
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      setPassword("");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Sign-in failed"));
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Continue signs in with what is typed. Otherwise the obvious button throws
  // away an email and a password entered on a grid keyboard.
  const filled = useRef({ email, password });
  filled.current = { email, password };
  useEffect(() => {
    if (signedIn) {
      setPrimaryGuard(null);
      return;
    }
    setPrimaryGuard(async () => {
      const f = filled.current;
      if (!f.email.trim() || !f.password) return true;
      return submit();
    });
    return () => setPrimaryGuard(null);
  });

  if (user) {
    return (
      <BpDecisionScroll>
        <BpStepConfirmed
          title={t("Signed in as {name}", { name: user.fullname || user.email })}
          detail={user.fullname ? user.email : undefined}
        />
      </BpDecisionScroll>
    );
  }

  return (
    <BpDecisionScroll>
      <BpOnboardField
        label={t("Email")}
        value={email}
        placeholder={t("you@example.com")}
        onChange={(next) => {
          setError(null);
          setEmail(next.slice(0, MAX));
        }}
        onFocus={() => setActive("email")}
        onSubmit={() => void submit()}
        active={active === "email"}
      />
      <BpOnboardField
        label={t("Password")}
        value={password}
        placeholder={t("Your Stremio password")}
        secret
        revealed={reveal}
        onReveal={() => setReveal((r) => !r)}
        onChange={(next) => {
          setError(null);
          setPassword(next.slice(0, MAX));
        }}
        onFocus={() => setActive("password")}
        onSubmit={() => void submit()}
        active={active === "password"}
      />
      <BpDecisionRow>
        <BpDecisionAction
          label={busy ? t("Signing in…") : t("Sign in")}
          onSelect={() => void submit()}
          disabled={busy || !email.trim() || !password}
        />
      </BpDecisionRow>
      <BpDecisionNote
        text={error ?? t("Skip this and Harbor still works. Your library just stays local.")}
        alert={error !== null}
      />
      <BpOnboardKeyboard
        onChar={(c) => write(current + c)}
        onBackspace={() => write(current.slice(0, -1))}
        onClear={() => write("")}
      />
      <BpStremioShowcase />
    </BpDecisionScroll>
  );
}
