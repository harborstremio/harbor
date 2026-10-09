import { Loader2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useT } from "@/lib/i18n";
import { resetJlPassword, signInJl, signUpJl } from "@/lib/jl/account/client";

type Mode = "signin" | "create";
const MIN_PASSWORD = 8;

const inputClass =
  "h-12 rounded-xl border border-edge bg-canvas px-4 text-[15px] text-ink outline-none placeholder:text-ink-subtle/60 focus:border-ink-subtle";

/** Turns Supabase auth errors into something a customer can act on. */
function friendly(err: unknown, mode: Mode): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (/not configured/i.test(msg))
    return "JL accounts aren't set up in this build. Contact JL Media Vision support.";
  if (/timed out/i.test(msg)) return "The account service took too long to respond. Try again.";
  if (/could not be saved/i.test(msg))
    return "Your account could not be saved on this device. Free some storage and try again.";
  if (/account changed/i.test(msg))
    return "Your sign-in changed while this request was running. Try again.";
  if (/invalid login|invalid credentials/i.test(msg))
    return "That email and password don't match an account.";
  if (/email not confirmed/i.test(msg))
    return "Confirm your email first. Check your inbox for the link we sent.";
  if (/already registered|already exists/i.test(msg))
    return "There's already an account with that email. Sign in instead.";
  if (/rate limit|too many/i.test(msg)) return "Too many tries. Wait a minute and try again.";
  if (/password/i.test(msg) && mode === "create")
    return `Use a password of at least ${MIN_PASSWORD} characters.`;
  return mode === "create"
    ? "Couldn't create the account. Check your internet and try again."
    : "Couldn't sign in. Check your internet and try again.";
}

/** Email and password sign-in or sign-up for a JL Media Vision account. */
export function JlAccountForm({ intro }: { intro?: string }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const valid =
    /\S+@\S+\.\S+/.test(email.trim()) && password.length >= (mode === "create" ? MIN_PASSWORD : 1);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signin") {
        await signInJl(email, password);
      } else {
        const session = await signUpJl(email, password);
        if (!session) {
          setNotice(
            "Check your email and tap the link to confirm your account, then sign in here.",
          );
          setMode("signin");
        }
      }
      setPassword("");
    } catch (err) {
      setError(friendly(err, mode));
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (busy) return;
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setError("Enter your email first, then tap Forgot password.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await resetJlPassword(email);
      setNotice("We emailed you a link to set a new password.");
    } catch {
      setError("Couldn't send the reset email. Try again in a minute.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      {intro && <p className="text-[14.5px] leading-relaxed text-ink-muted">{intro}</p>}
      <div
        role="tablist"
        className="flex w-fit gap-1 rounded-full border border-edge-soft bg-canvas/50 p-1"
      >
        {(["signin", "create"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            className={`h-9 rounded-full px-4 text-[13.5px] font-medium transition-colors ${
              mode === m ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
            }`}
          >
            {m === "signin" ? t("Sign in") : t("Create account")}
          </button>
        ))}
      </div>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t("Email")}
        autoComplete="email"
        className={inputClass}
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={mode === "create" ? t("Password (8+ characters)") : t("Password")}
        autoComplete={mode === "create" ? "new-password" : "current-password"}
        className={inputClass}
      />
      {error && <p className="text-[13px] leading-relaxed text-danger">{t(error)}</p>}
      {notice && <p className="text-[13px] leading-relaxed text-accent">{t(notice)}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!valid || busy}
          className="flex h-11 items-center gap-2 rounded-full bg-ink px-6 text-[14px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {busy && <Loader2 size={15} className="animate-spin" />}
          {mode === "signin" ? t("Sign in") : t("Create account")}
        </button>
        {mode === "signin" && (
          <button
            type="button"
            onClick={() => void forgot()}
            className="text-[13px] text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            {t("Forgot password?")}
          </button>
        )}
      </div>
    </form>
  );
}
