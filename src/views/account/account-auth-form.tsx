import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { HarborMark } from "@/components/icons/harbor-mark";
import { loginIdentity, registerIdentity } from "@/lib/account/identity";
import { accountErrorMessage } from "@/lib/account/error-messages";
import { PasswordField, TextField } from "./fields";
import { AccountRecoverForm } from "./account-recover-form";
import { AccountValueProps } from "./account-value-props";
import { useT } from "@/lib/i18n";

type Mode = "signin" | "register";

const MODES: { id: Mode; label: string; action: string }[] = [
  { id: "signin", label: "Sign in", action: "Sign in" },
  { id: "register", label: "Create account", action: "Create my account" },
];

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

export function AccountAuthForm({ onRecovery }: { onRecovery?: (code: string) => void }) {
  const t = useT();
  const [view, setView] = useState<"auth" | "recover">("auth");
  const [mode, setMode] = useState<Mode>("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = username.trim();
  const usernameOk = USERNAME_RE.test(trimmed);
  const passwordOk = mode === "register" ? password.length >= 8 : password.length > 0;
  const ready = usernameOk && passwordOk;
  const usernameHint =
    mode === "register" && trimmed.length > 0 && !usernameOk
      ? "3 to 24 letters, numbers, or underscores."
      : undefined;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "register") {
        const { recoveryCode } = await registerIdentity(trimmed, password);
        onRecovery?.(recoveryCode);
      } else {
        await loginIdentity(trimmed, password);
      }
    } catch (err) {
      setError(accountErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const active = MODES.find((m) => m.id === mode)!;

  if (view === "recover") {
    return (
      <AccountRecoverForm
        onBack={() => setView("auth")}
        onReset={(code) => {
          setView("auth");
          onRecovery?.(code);
        }}
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-[18px] border border-edge-soft bg-surface">
      <div className="flex items-center gap-3.5 border-b border-edge-soft/70 px-6 pt-6 pb-5">
        <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-elevated text-ink ring-1 ring-edge-soft">
          <HarborMark className="h-6 w-6" />
        </span>
        <div className="flex min-w-0 flex-col">
          <h3 className="font-display text-[19px] font-medium tracking-tight text-ink">
            {mode === "register" ? t("Join Harbor") : t("Welcome back")}
          </h3>
          <p className="text-[12.5px] text-ink-subtle">
            {mode === "register"
              ? t("One free account for your handle, themes, and sync.")
              : t("Sign in to pick up where you left off.")}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-6">
        {mode === "register" && <AccountValueProps />}

        <div className="flex items-center gap-1 rounded-[11px] border border-edge-soft bg-elevated/40 p-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => {
                setMode(m.id);
                setError(null);
              }}
              className={`h-9 flex-1 rounded-[8px] text-[12.5px] font-semibold transition-colors duration-150 ${
                mode === m.id ? "bg-ink text-canvas" : "text-ink-muted hover:text-ink"
              }`}
            >
            {t(m.label)}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="flex flex-col gap-4"
        >
          <TextField
            label={t("Username")}
            value={username}
            onChange={setUsername}
            placeholder={t("yourname")}
            maxLength={24}
            hint={usernameHint}
            tone={usernameHint ? "danger" : "muted"}
            autoComplete="username"
          />
          <PasswordField
            label={t("Password")}
            value={password}
            onChange={setPassword}
            placeholder={mode === "register" ? t("At least 8 characters") : t("Your password")}
            onEnter={submit}
          />

          {mode === "signin" && (
            <button
              type="button"
              onClick={() => {
                setView("recover");
                setError(null);
              }}
              className="-mt-1 self-end text-[12px] font-medium text-ink-subtle transition-colors hover:text-ink"
            >
              {t("Forgot password ?")}
            </button>
          )}

          {error && (
            <p className="rounded-[10px] border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-[12.5px] leading-snug text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!ready || busy}
            className="flex h-11 items-center justify-center gap-2 rounded-[11px] bg-ink text-[14px] font-semibold text-canvas transition-all duration-150 hover:opacity-90 active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
          >
            {busy && <Loader2 size={16} className="animate-spin" />}
            {t(active.action)}
          </button>

          {mode === "register" && (
            <p className="flex items-start gap-2 text-[11.5px] leading-snug text-ink-subtle">
              <KeyRound size={13} className="mt-0.5 shrink-0" />
              {t("We'll show a one-time recovery key right after you sign up. Save it: it's the only way back in if you forget your password.")}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
